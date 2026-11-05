// One queue per generation job, shared by every level and chapter.
export type GenerationScheduler = <T>(task: () => Promise<T>) => Promise<T>;
export function createGenerationQueue(limit = 3): GenerationScheduler {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Invalid concurrency limit.");
  let active = 0;
  const waiting: Array<() => void> = [];
  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        void (async () => {
          try {
            resolve(await task());
          } catch (error) {
            reject(error);
          } finally {
            active--;
            waiting.shift()?.();
          }
        })();
      };
      if (active < limit) start();
      else waiting.push(start);
    });
}
