import { describe, expect, it, vi } from "vite-plus/test";

import { RunQueue } from "./queue.ts";

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("RunQueue", () => {
  it("runs no more than the limit at once and starts the rest in order", async () => {
    const queue = new RunQueue(2);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    gates.forEach((gate, index) => {
      void queue.enqueue(async () => {
        started.push(index);
        await gate.promise;
      });
    });
    await tick();
    expect(started).toEqual([0, 1]);

    gates[0]?.resolve();
    await tick();
    expect(started).toEqual([0, 1, 2]);
  });

  it("tells a waiting job its place in line", async () => {
    const queue = new RunQueue(1);
    const gate = deferred();
    const positions: number[] = [];

    void queue.enqueue(() => gate.promise);
    void queue.enqueue(() => Promise.resolve());
    void queue.enqueue(
      () => Promise.resolve(),
      (position) => positions.push(position),
    );
    await tick();
    expect(positions).toEqual([2]);

    gate.resolve();
    await tick();
    expect(positions).toEqual([2, 1]);
  });

  it("moves on after a job fails", async () => {
    const queue = new RunQueue(1);
    const next = vi.fn(() => Promise.resolve());

    await expect(queue.enqueue(() => Promise.reject(new Error("bad")))).rejects.toThrow("bad");
    await queue.enqueue(next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("drops a waiting job when it is cancelled", async () => {
    const queue = new RunQueue(1);
    const gate = deferred();
    const dropped = vi.fn(() => Promise.resolve());
    const stop = new AbortController();

    void queue.enqueue(() => gate.promise);
    const waiting = queue.enqueue(dropped, undefined, stop.signal);
    stop.abort();
    gate.resolve();

    await expect(waiting).rejects.toThrow(/cancelled/i);
    expect(dropped).not.toHaveBeenCalled();
  });

  it("reports how many jobs are waiting", async () => {
    const queue = new RunQueue(1);
    const gate = deferred();

    void queue.enqueue(() => gate.promise);
    void queue.enqueue(() => Promise.resolve());
    await tick();

    expect(queue.waiting).toBe(1);
    gate.resolve();
  });
});
