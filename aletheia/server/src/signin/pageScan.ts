/// <reference lib="dom" />

/**
 * What one frame of a login page shows. This reads a field's traits and whether it is filled, never
 * its value, so what a person typed cannot leave the page through a scan.
 */
export interface ScannedField {
  ref: number;
  type: string;
  name: string;
  autocomplete: string;
  inputMode: string;
  /** Label, aria-label, placeholder and title together. */
  label: string;
  maxLength: number | null;
  pattern: string;
  filled: boolean;
  form: number | null;
  inDialog: boolean;
  /** The country code the site shows beside a phone field, and its picker when that is a select. */
  dial: { code: string; select: number | null } | null;
}

export interface ScannedControl {
  ref: number;
  text: string;
  kind: "button" | "link" | "checkbox";
  submit: boolean;
  disabled: boolean;
  checked: boolean;
  form: number | null;
}

export interface ScannedFrame {
  index: number;
  url: string;
  text: string;
  errors: string[];
  captcha: boolean;
  fields: ScannedField[];
  controls: ScannedControl[];
}

export interface PageScan {
  url: string;
  frames: ScannedFrame[];
}

export type FrameScan = Omit<ScannedFrame, "index">;

/** Runs inside the page, so it can use nothing from this file's scope. */
export function scanDocument(): { scan: FrameScan; elements: Element[] } {
  const TEXT_LIMIT = 3000;
  const CONTROL_TEXT_LIMIT = 60;
  const ERROR_TEXT_LIMIT = 200;
  const SHORT_CLICKABLE =
    /log ?in|sign ?in|account|resend|again|continue|use |send|email|text|call/i;
  const DIAL_CODE = /^\+\d{1,4}$/;
  const CAPTCHA_FRAME =
    /recaptcha\/.*(anchor|bframe)|hcaptcha\.com|challenges\.cloudflare\.com|arkoselabs|funcaptcha|geetest|captcha-delivery/i;
  const CAPTCHA_WORDS =
    /verify you are human|i'?m not a robot|press (and|&) hold|complete the (security )?(check|captcha)|solve the (puzzle|captcha)/i;
  const ERROR_LOOK =
    '[role="alert"],[aria-live="assertive"],[aria-live="polite"],.error,.errors,.invalid-feedback,[class*="error" i],[class*="invalid" i],[id*="error" i]';

  const elements: Element[] = [];
  const remember = (element: Element) => elements.push(element) - 1;

  const everything: Element[] = [];
  const walk = (root: ParentNode) => {
    for (const element of root.querySelectorAll("*")) {
      everything.push(element);
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(document);

  const shown = (element: Element) => {
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || box.right < 0 || box.bottom < 0) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const forms = [...document.forms];
  const formOf = (element: Element) => {
    const form = element.closest("form");
    return form ? forms.indexOf(form) : null;
  };
  const inDialog = (element: Element) =>
    element.closest('dialog,[role="dialog"],[aria-modal="true"],[class*="modal" i]') !== null;

  const squeeze = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

  const labelOf = (input: HTMLInputElement | HTMLTextAreaElement) => {
    const labels = [...(input.labels ?? [])].map(({ innerText }) => innerText);
    const named = (input.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .map((id) => (id ? document.getElementById(id)?.innerText : ""));
    return squeeze(
      [
        ...labels,
        ...named,
        input.getAttribute("aria-label"),
        input.getAttribute("placeholder"),
        input.getAttribute("title"),
      ].join(" "),
    );
  };

  const dialNear = (input: Element) => {
    let around = input.parentElement;
    for (let level = 0; level < 3 && around; level += 1, around = around.parentElement) {
      const select = around.querySelector("select");
      if (select && /\+\d/.test(select.selectedOptions[0]?.text ?? "")) {
        const code = /\+\d{1,4}/.exec(select.selectedOptions[0]?.text ?? "")?.[0] ?? "";
        return { code, select: remember(select) };
      }
      for (const element of around.querySelectorAll("*")) {
        if (element.children.length > 0 || element === input) continue;
        const text = squeeze(element.textContent);
        if (DIAL_CODE.test(text)) return { code: text, select: null };
      }
    }
    return null;
  };

  const fields: ScannedField[] = [];
  const controls: ScannedControl[] = [];
  const errors = new Set<string>();

  for (const element of everything) {
    if (
      (element instanceof HTMLInputElement &&
        !["hidden", "submit", "button", "checkbox", "radio", "file", "image", "reset"].includes(
          element.type,
        )) ||
      element instanceof HTMLTextAreaElement
    ) {
      if (!shown(element) || element.disabled || element.readOnly) continue;
      const input = element as HTMLInputElement;
      const phoneLike = input.type === "tel" || /phone|mobile/i.test(input.name + labelOf(input));
      fields.push({
        ref: remember(input),
        type: input.type,
        name: `${input.name} ${input.id}`.trim(),
        autocomplete: input.autocomplete,
        inputMode: input.inputMode,
        label: labelOf(input),
        maxLength: input.maxLength > 0 ? input.maxLength : null,
        pattern: input.pattern,
        filled: input.value.length > 0,
        form: formOf(input),
        inDialog: inDialog(input),
        dial: phoneLike ? dialNear(input) : null,
      });
    }
  }

  for (const element of everything) {
    const isInput = element instanceof HTMLInputElement;
    if (isInput && element.type === "checkbox") {
      const box = element.closest("label") ?? element.parentElement;
      if (!shown(box ?? element)) continue;
      controls.push({
        ref: remember(element),
        text: squeeze(box?.textContent ?? element.getAttribute("aria-label")),
        kind: "checkbox",
        submit: false,
        disabled: element.disabled,
        checked: element.checked,
        form: formOf(element),
      });
      continue;
    }

    const native =
      element instanceof HTMLButtonElement ||
      element instanceof HTMLAnchorElement ||
      (isInput && (element.type === "submit" || element.type === "button"));
    const role = element.getAttribute("role");
    const aria = role === "button" || role === "link" || role === "menuitem";
    const text = squeeze(
      isInput
        ? element.value
        : (element as HTMLElement).innerText || element.getAttribute("aria-label"),
    );
    if (!text || text.length > CONTROL_TEXT_LIMIT) continue;

    // Plenty of sites build their buttons from a bare div, which gives itself away by its cursor.
    const styledAsButton =
      !native &&
      !aria &&
      element.children.length <= 1 &&
      SHORT_CLICKABLE.test(text) &&
      getComputedStyle(element).cursor === "pointer" &&
      (element.parentElement === null ||
        getComputedStyle(element.parentElement).cursor !== "pointer");
    if ((!native && !aria && !styledAsButton) || !shown(element)) continue;

    const button = element as HTMLButtonElement;
    controls.push({
      ref: remember(element),
      text,
      kind: element instanceof HTMLAnchorElement || role === "link" ? "link" : "button",
      submit: (element instanceof HTMLButtonElement || isInput) && button.type === "submit",
      disabled: button.disabled === true || element.getAttribute("aria-disabled") === "true",
      checked: false,
      form: formOf(element),
    });
  }

  for (const element of everything) {
    if (!element.matches(ERROR_LOOK) || !shown(element)) continue;
    const text = squeeze((element as HTMLElement).innerText);
    const fits = text.length >= 3 && text.length <= ERROR_TEXT_LIMIT;
    if (fits && element.querySelector("input,button,select") === null) errors.add(text);
  }

  const captchaFrame = [...document.querySelectorAll("iframe")].some((frame) => {
    const box = frame.getBoundingClientRect();
    return (
      CAPTCHA_FRAME.test(frame.src) &&
      !/size=invisible/.test(frame.src) &&
      frame.closest(".grecaptcha-badge") === null &&
      box.width > 100 &&
      box.height > 50 &&
      shown(frame)
    );
  });
  const text = (document.body?.innerText ?? "").slice(0, TEXT_LIMIT);

  return {
    elements,
    scan: {
      url: location.href,
      text,
      errors: [...errors],
      captcha: captchaFrame || CAPTCHA_WORDS.test(text),
      fields,
      controls,
    },
  };
}
