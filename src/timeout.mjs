/**
 * Wrap a promise with a timeout. If the promise does not settle within the
 * given time, it will be rejected with a timeout Error.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms timeout in milliseconds
 * @param {string} [context] optional description for error message
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, context = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(
          new Error(
            `[Timeout] ${context} timed out after ${ms} ms`
          )
        );
      }, ms);
    }),
  ]);
}

