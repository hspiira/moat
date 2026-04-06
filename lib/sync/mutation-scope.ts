let suppressedMutationDepth = 0;

export function shouldSuppressSyncMutation() {
  return suppressedMutationDepth > 0;
}

export async function runWithSyncMutationSuppressed<T>(
  task: () => Promise<T>,
): Promise<T> {
  suppressedMutationDepth += 1;
  try {
    return await task();
  } finally {
    suppressedMutationDepth -= 1;
  }
}

