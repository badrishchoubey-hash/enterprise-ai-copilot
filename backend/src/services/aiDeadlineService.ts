import { AppError } from "../middleware/appError.js";

export async function withAiDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutError: AppError,
  requestSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const signal = requestSignal ? AbortSignal.any([requestSignal, controller.signal]) : controller.signal;
  signal.throwIfAborted();
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([operation(signal), cancelled]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
