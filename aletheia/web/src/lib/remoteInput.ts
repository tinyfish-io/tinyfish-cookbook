export type RemoteInput =
  | { kind: "click"; x: number; y: number }
  | { kind: "key"; key: string }
  | { kind: "text"; text: string }
  | { kind: "scroll"; dx: number; dy: number };

interface Point {
  clientX: number;
  clientY: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function toRemotePoint(
  { clientX, clientY }: Point,
  shown: Box,
  page: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: Math.round(((clientX - shown.left) / shown.width) * page.width),
    y: Math.round(((clientY - shown.top) / shown.height) * page.height),
  };
}

const NAMED_KEYS = new Set([
  "Enter",
  "Tab",
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}

export function keyToInput({
  key,
  ctrlKey,
  metaKey,
  altKey,
  isComposing,
}: KeyPress): RemoteInput | null {
  if (isComposing) return null;
  // AltGr reports as control plus alt, and it types characters such as @ on many layouts.
  const altGraph = ctrlKey && altKey;
  if ((ctrlKey || metaKey) && !altGraph) return null;
  if (key.length === 1) return { kind: "text", text: key };
  return NAMED_KEYS.has(key) ? { kind: "key", key } : null;
}

const MAX_TEXT = 256;

/**
 * Sends input in strict order, one request at a time, because a phone number or code must not
 * arrive scrambled. Nothing is kept once it is sent or dropped.
 */
export class InputRelay {
  readonly #send: (input: RemoteInput) => Promise<void>;
  readonly #onError: (error: unknown) => void;
  #waiting: RemoteInput[] = [];
  #busy = false;

  constructor(send: (input: RemoteInput) => Promise<void>, onError: (error: unknown) => void) {
    this.#send = send;
    this.#onError = onError;
  }

  push(input: RemoteInput): void {
    const last = this.#waiting.at(-1);
    if (input.kind === "text" && last?.kind === "text") last.text += input.text;
    else if (input.kind === "scroll" && last?.kind === "scroll") {
      last.dx += input.dx;
      last.dy += input.dy;
    } else this.#waiting.push({ ...input });
    void this.#drain();
  }

  #next(): RemoteInput | undefined {
    const input = this.#waiting[0];
    if (input?.kind !== "text" || input.text.length <= MAX_TEXT) return this.#waiting.shift();
    const head = input.text.slice(0, MAX_TEXT);
    input.text = input.text.slice(MAX_TEXT);
    return { kind: "text", text: head };
  }

  async #drain(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      for (let input = this.#next(); input; input = this.#next()) await this.#send(input);
    } catch (error) {
      this.#waiting = [];
      this.#onError(error);
    } finally {
      this.#busy = false;
    }
  }
}
