import { useId, useState } from "react";
import { submitChallenge } from "../api";
import { verdicts } from "../lib";

const CHALLENGE_TYPES = [
  { value: "verdict_wrong", label: "The verdict is wrong" },
  { value: "missing_context", label: "Important context is missing" },
  { value: "outdated_evidence", label: "The evidence is outdated" },
  { value: "misread_source", label: "A source was misread or misrepresented" },
  { value: "other", label: "Something else" },
];

const EXPLANATION_MIN = 20;
const EXPLANATION_MAX = 2000;
const MAX_SOURCES = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

// Collects everything needed to store a challenge: what is wrong, why, a
// source to verify it, and a contact email. `claim` is a community card.
export default function ChallengeForm({ claim, onCancel, onSubmitted }) {
  const uid = useId();
  const [type, setType] = useState("verdict_wrong");
  const [suggested, setSuggested] = useState("");
  const [explanation, setExplanation] = useState("");
  const [sources, setSources] = useState([""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateSource = (index, value) =>
    setSources((list) => list.map((s, i) => (i === index ? value : s)));
  const removeSource = (index) =>
    setSources((list) => list.filter((_, i) => i !== index));

  // Mirrors the server's rules so mistakes are caught before sending.
  function validate() {
    if (explanation.trim().length < EXPLANATION_MIN) {
      return `Please explain in at least ${EXPLANATION_MIN} characters.`;
    }
    const links = sources.map((s) => s.trim()).filter(Boolean);
    if (links.length === 0) return "Add at least one source we can check.";
    const badLink = links.find((link) => !isHttpUrl(link));
    if (badLink) {
      return `"${badLink}" is not a valid link. Use a full address starting with http:// or https://.`;
    }
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (!consent) return "Please agree to be contacted about your challenge.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const receipt = await submitChallenge(claim.id, {
        challenge_type: type,
        suggested_verdict: suggested || null,
        explanation: explanation.trim(),
        sources: sources.map((s) => s.trim()).filter(Boolean),
        email: email.trim(),
        name: name.trim() || null,
        contact_consent: consent,
      });
      onSubmitted(receipt);
    } catch (err) {
      setError(err.message || "Could not submit your challenge.");
      setSubmitting(false);
    }
  }

  return (
    <form className="cfc-form" onSubmit={handleSubmit} noValidate>
      <h3>Challenge this fact-check</h3>
      <p className="cfc-form-hint">
        Think this result is wrong, or that something is missing? Tell us why
        and point to a source we can check.
      </p>
      <p className="cfc-form-claim">{claim.claim}</p>

      <div className="cfc-field">
        <label htmlFor={`${uid}-type`}>What is the problem?</label>
        <select id={`${uid}-type`} value={type} onChange={(e) => setType(e.target.value)}>
          {CHALLENGE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="cfc-field">
        <label htmlFor={`${uid}-verdict`}>
          What should the verdict be? <span className="optional">(optional)</span>
        </label>
        <select
          id={`${uid}-verdict`}
          value={suggested}
          onChange={(e) => setSuggested(e.target.value)}
        >
          <option value="">No suggestion</option>
          {Object.entries(verdicts).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="cfc-field">
        <label htmlFor={`${uid}-explanation`}>Your challenge</label>
        <textarea
          id={`${uid}-explanation`}
          value={explanation}
          maxLength={EXPLANATION_MAX}
          placeholder="What is incorrect or missing, and what is the correct information?"
          onChange={(e) => setExplanation(e.target.value)}
        />
        <div className="cfc-field-meta">
          <span>At least {EXPLANATION_MIN} characters</span>
          <span>
            {explanation.length}/{EXPLANATION_MAX}
          </span>
        </div>
      </div>

      <div className="cfc-field">
        <span className="cfc-field-label">Sources to verify it</span>
        {sources.map((source, index) => (
          <div className="cfc-source-row" key={index}>
            <input
              type="url"
              value={source}
              placeholder="https://example.com/article"
              aria-label={`Source link ${index + 1}`}
              onChange={(e) => updateSource(index, e.target.value)}
            />
            {sources.length > 1 && (
              <button
                type="button"
                className="cfc-mini-button"
                aria-label={`Remove source link ${index + 1}`}
                onClick={() => removeSource(index)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {sources.length < MAX_SOURCES && (
          <button
            type="button"
            className="cfc-mini-button cfc-add-source"
            onClick={() => setSources((list) => [...list, ""])}
          >
            + Add another source
          </button>
        )}
      </div>

      <div className="cfc-field">
        <label htmlFor={`${uid}-name`}>
          Your name <span className="optional">(optional)</span>
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="cfc-field">
        <label htmlFor={`${uid}-email`}>Your email</label>
        <input
          id={`${uid}-email`}
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <label className="cfc-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>I agree to be contacted at this email about my challenge.</span>
      </label>
      <p className="cfc-form-privacy">
        Your email is stored privately with your challenge and is never shown
        publicly.
      </p>

      {error && (
        <div className="cfc-form-error" role="alert">
          {error}
        </div>
      )}

      <div className="cfc-form-actions">
        <button type="button" className="text-button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit challenge"}
        </button>
      </div>
    </form>
  );
}
