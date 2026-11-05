/** A sliding window over the last `windowMs`. Every counted unit is one billed agent run. */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #spent = new Map<string, number[]>();

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  has(key: string, count: number): boolean {
    return this.#recent(key).length + count <= this.#limit;
  }

  take(key: string, count: number): boolean {
    if (!this.has(key, count)) return false;
    const stamp = this.#now();
    this.#spent.set(key, [...this.#recent(key), ...Array.from({ length: count }, () => stamp)]);
    return true;
  }

  #recent(key: string): number[] {
    const cutoff = this.#now() - this.#windowMs;
    return (this.#spent.get(key) ?? []).filter((stamp) => stamp > cutoff);
  }
}
