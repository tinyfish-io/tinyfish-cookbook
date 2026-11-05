export class QueueCancelledError extends Error {
  constructor() {
    super("Cancelled while waiting in the queue");
    this.name = "QueueCancelledError";
  }
}

interface Waiter {
  start: () => void;
  onPosition: ((position: number) => void) | undefined;
}

/** The account allows a fixed number of concurrent runs, so the rest wait their turn here. */
export class RunQueue {
  readonly #limit: number;
  readonly #waiters: Waiter[] = [];
  #active = 0;

  constructor(limit: number) {
    this.#limit = limit;
  }

  get waiting(): number {
    return this.#waiters.length;
  }

  async enqueue<T>(
    job: () => Promise<T>,
    onPosition?: (position: number) => void,
    signal?: AbortSignal,
  ): Promise<T> {
    await this.#turn(onPosition, signal);
    try {
      return await job();
    } finally {
      this.#active -= 1;
      this.#startNext();
    }
  }

  #turn(onPosition?: (position: number) => void, signal?: AbortSignal): Promise<void> {
    if (this.#active < this.#limit) {
      this.#active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.#waiters.splice(this.#waiters.indexOf(waiter), 1);
        this.#announce();
        reject(new QueueCancelledError());
      };
      const waiter: Waiter = {
        onPosition,
        start: () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.#waiters.push(waiter);
      onPosition?.(this.#waiters.length);
    });
  }

  #startNext(): void {
    const next = this.#waiters.shift();
    if (!next) return;
    this.#active += 1;
    next.start();
    this.#announce();
  }

  #announce(): void {
    this.#waiters.forEach((waiter, index) => waiter.onPosition?.(index + 1));
  }
}
