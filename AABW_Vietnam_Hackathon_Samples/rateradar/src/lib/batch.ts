// Runs async work in waves rather than firing every call at once — keeps
// concurrent TinyFish agent count sane (5 at a time, then the remaining
// 2), matching TinyFish's plan-based concurrency limits instead of
// assuming unlimited parallelism.
export async function runInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 5
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
