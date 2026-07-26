export async function restoreWithRetry(operation, options = {}) {
  const {
    timeoutMs = 3500,
    label = "OpeningFit data restore",
    attempts = 1,
  } = options;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeoutId;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(`${label} timed out after ${timeoutMs}ms`);
          error.name = "WorkspaceRestoreTimeout";
          reject(error);
        }, timeoutMs);
      });
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}
