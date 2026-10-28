export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code = 'REQUEST_FAILED', options?: { cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    if (options?.cause) this.cause = options.cause;
  }
}
