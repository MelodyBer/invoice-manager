const MAX_CONCURRENT_EXTRACTIONS = 3;

let activeCount = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT_EXTRACTIONS) {
    activeCount += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  activeCount += 1;
}

function releaseSlot(): void {
  activeCount -= 1;
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

export async function withExtractionConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await task();
  } finally {
    releaseSlot();
  }
}
