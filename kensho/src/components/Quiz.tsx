"use client";

import { useState } from "react";
import type { Claim, QuizQuestion } from "@/lib/types";
import { library } from "@/lib/library";
import { Character } from "./manga/characters";

export function Quiz({ paperId, questions, claims, onClaim }: { paperId: string; questions: QuizQuestion[]; claims: Claim[]; onClaim?: (id: string) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const done = answers.every((a) => a !== null);
  const score = answers.filter((a, i) => a === questions[i].answer).length;

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const picked = answers[qi];
        const claim = q.claimId ? claims.find((c) => c.id === q.claimId) : null;
        return (
          <fieldset key={qi} className="ink-frame p-5">
            <legend className="sr-only">Question {qi + 1}</legend>
            <div className="flex gap-3 items-start">
              <span className="font-display bg-ink text-white w-8 h-8 grid place-items-center shrink-0">{qi + 1}</span>
              <p className="font-bold text-lg leading-snug">{q.question}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {q.options.map((opt, oi) => {
                const isPicked = picked === oi;
                const isRight = oi === q.answer;
                const reveal = picked !== null;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={reveal}
                    onClick={() => {
                      const next = answers.map((a, i) => (i === qi ? oi : a));
                      setAnswers(next);
                      if (next.every((a) => a !== null))
                        library.saveQuiz(paperId, next.filter((a, i) => a === questions[i].answer).length, questions.length);
                    }}
                    className={`text-left border-2 px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      reveal && isRight ? "bg-ink text-white border-ink" : reveal && isPicked ? "border-red text-red bg-white line-through" : "border-ink bg-white hover:bg-paper-2"
                    }`}
                  >
                    <span className="font-mono text-xs w-5">{String.fromCharCode(65 + oi)}</span>
                    <span className="flex-1">{opt}</span>
                    {reveal && isRight && <span className="font-display text-xs">正解</span>}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="mt-4 border-l-[3px] border-ink pl-3 text-[15px] leading-relaxed ink-in">
                <span className={`font-black ${picked === q.answer ? "" : "text-red"}`}>{picked === q.answer ? "Correct. " : "Not quite. "}</span>
                {q.explanation}
                {claim && (
                  <button type="button" onClick={() => onClaim?.(claim.id)} className="ml-2 font-mono text-[11px] bg-ink text-white px-1.5 py-0.5 hover:bg-red">
                    {claim.id} · see the paper
                  </button>
                )}
              </div>
            )}
          </fieldset>
        );
      })}
      {done && (
        <div className="ink-frame ink-shadow p-5 flex items-center gap-5 ink-in">
          <div className="w-24 shrink-0">
            <Character id="kai" expression={score === questions.length ? "excited" : score >= questions.length / 2 ? "happy" : "worried"} pose={score === questions.length ? "cheer" : "idle"} />
          </div>
          <div>
            <div className="font-display text-3xl">
              {score} / {questions.length}
            </div>
            <p className="text-ink-2 mt-1">
              {score === questions.length ? "Perfect — you understood the paper." : score >= questions.length / 2 ? "Solid. Revisit the cited panels for the ones you missed." : "Worth a reread — the citation chips point to the exact passages."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
