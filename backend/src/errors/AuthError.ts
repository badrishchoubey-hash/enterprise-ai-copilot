import { AppError } from '../middleware/appError.js';

export class AuthError extends AppError {
  constructor(message: string, statusCode: 400 | 401 | 409) {
    super(
      statusCode,
      message,
      statusCode === 401
        ? 'AUTHENTICATION_FAILED'
        : statusCode === 409
          ? 'CONFLICT'
          : 'VALIDATION_ERROR'
    );
    this.name = 'AuthError';
  }
}
