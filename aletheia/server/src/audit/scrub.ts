const PHONE = /(?<![\d.])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d.])/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const ONE_TIME_CODE = /\b(otp|one[- ]time (?:password|code|passcode))\b([^\d]{0,12})\d{4,8}\b/gi;
const REMOVED = "[removed]";

function scrubText(text: string): string {
  return text
    .replace(ONE_TIME_CODE, `$1$2${REMOVED}`)
    .replace(EMAIL, REMOVED)
    .replace(PHONE, REMOVED);
}

/** Agent text can repeat what was on a signed-in page, and none of that may be saved. */
export function scrubPersonal<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => scrubPersonal(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, scrubPersonal(entry)]),
    ) as T;
  }
  return value;
}
