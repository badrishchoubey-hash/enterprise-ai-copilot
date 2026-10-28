
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types, type ClientSession } from 'mongoose';

import Users from '../models/User.js';
import type { UserDocument } from '../types/modelTypes/User.js';
import RefreshTokens from '../models/RefreshToken.js';
import type {
  AuthTokens,
  JwtExpiresIn,
  JwtPayload,
  PublicUser,
  RefreshJwtPayload,
  RegisterUserInput,
} from '../types/auth.types.js';
import { AppError } from '../middleware/appError.js';
import { logError, logInfo } from '../utils/logger.js';
import { AuthError } from '../errors/AuthError.js';

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const ACCESS_EXPIRES_IN: JwtExpiresIn = (
  process.env.JWT_EXPIRES_IN ?? '15m'
) as JwtExpiresIn;

const REFRESH_EXPIRES_IN: JwtExpiresIn = (
  process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'
) as JwtExpiresIn;

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

// --------------------------------------------------
// Secrets
// --------------------------------------------------

const accessSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new AppError(
      503,
      'Authentication service is not configured.',
      'AUTH_CONFIGURATION_ERROR'
    );
  }

  return secret;
};

const refreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new AppError(
      503,
      'Authentication service is not configured.',
      'AUTH_CONFIGURATION_ERROR'
    );
  }

  return secret;
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const errorMetadata = (error: unknown): { errorType?: string; errorCode?: string | number } => {
  if (typeof error !== 'object' || error === null) {
    return {};
  }

  const candidate = error as { name?: unknown; code?: unknown };

  return {
    errorType: typeof candidate.name === 'string' ? candidate.name : undefined,
    errorCode:
      typeof candidate.code === 'string' || typeof candidate.code === 'number'
        ? candidate.code
        : undefined,
  };
};

const isUserRole = (value: unknown): value is JwtPayload['role'] =>
  value === 'employee' || value === 'support_agent' || value === 'admin';

const isRefreshJwtPayload = (value: unknown): value is RefreshJwtPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'refresh' &&
    typeof candidate.sub === 'string' &&
    typeof candidate.jti === 'string'
  );
};

const isAccessJwtPayload = (value: unknown): value is JwtPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === 'string' &&
    isUserRole(candidate.role) &&
    (candidate.department === undefined || typeof candidate.department === 'string')
  );
};

const publicUser = (user: UserDocument): PublicUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
});

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Converts a supported JWT duration into a database expiry date.
 *
 * Supported string formats: 15s, 15m, 2h, 7d.
 * Numeric values are interpreted as seconds, matching JWT semantics.
 */
const expiresAtFrom = (value: JwtExpiresIn): Date => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError(
        503,
        'Invalid JWT expiration configuration.',
        'AUTH_CONFIGURATION_ERROR'
      );
    }

    return new Date(Date.now() + value * 1000);
  }

  const match = String(value).match(/^(\d+)(s|m|h|d)$/);

  if (!match) {
    throw new AppError(
      503,
      'JWT expiration must use seconds, minutes, hours, or days.',
      'AUTH_CONFIGURATION_ERROR'
    );
  }

  const amount = Number(match[1]);

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  const durationMs = amount * multipliers[match[2]];

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new AppError(
      503,
      'Invalid JWT expiration configuration.',
      'AUTH_CONFIGURATION_ERROR'
    );
  }

  return new Date(Date.now() + durationMs);
};

// --------------------------------------------------
// Token issuance
// --------------------------------------------------

const issueTokens = async (
  user: UserDocument,
  session?: ClientSession
): Promise<AuthTokens> => {
  const userId = user._id.toString();
  logInfo('auth.tokens.issue.started', { userId, hasSession: Boolean(session) });

  const accessToken = jwt.sign(
    {
      userId,
      role: user.role,
      department: user.department,
    },
    accessSecret(),
    {
      subject: userId,
      expiresIn: ACCESS_EXPIRES_IN,
    }
  );

  const jti = crypto.randomUUID();

  // Do not include `sub` in the payload when using `subject`.
  const refreshToken = jwt.sign(
    {
      jti,
      type: 'refresh',
    },
    refreshSecret(),
    {
      subject: userId,
      expiresIn: REFRESH_EXPIRES_IN,
    }
  );

  const refreshTokenDocument = new RefreshTokens({
    userId: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: expiresAtFrom(REFRESH_EXPIRES_IN),
  });

  if (session) {
    await refreshTokenDocument.save({ session });
  } else {
    await refreshTokenDocument.save();
  }

  logInfo('auth.tokens.issue.completed', { userId, expiresIn: ACCESS_EXPIRES_IN });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_EXPIRES_IN,
  };
};

// --------------------------------------------------
// Register
// --------------------------------------------------

export async function registerUser(
  input: RegisterUserInput
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  logInfo('auth.register.started', { email: input.email, hasDepartment: Boolean(input.department) });
  const name = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const department = input.department?.trim();

  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    input.password.length < 8
  ) {
    throw new AuthError(
      'Name, a valid email, and a password of at least 8 characters are required.',
      400
    );
  }

  const passwordHash = await bcrypt.hash(
    input.password,
    BCRYPT_ROUNDS
  );

  const session = await mongoose.startSession();

  let result:
    | { user: UserDocument; tokens: AuthTokens }
    | undefined;

  try {
    await session.withTransaction(async () => {
      const [user] = await Users.create(
        [
          {
            name,
            email: normalizedEmail,
            passwordHash,
            role: input.role ?? 'employee',
            department: department || undefined,
          },
        ],
        { session }
      );

      result = {
        user,
        tokens: await issueTokens(user, session),
      };
      logInfo('auth.register.user_created', { userId: user._id.toString(), email: normalizedEmail });
    });

    if (!result) {
      throw new AppError(
        503,
        'Registration could not be completed.',
        'REGISTRATION_FAILED'
      );
    }

    return {
      user: publicUser(result.user),
      tokens: result.tokens,
    };
  } catch (error: unknown) {
    logError('auth.register.failed', { email: normalizedEmail, ...errorMetadata(error) });
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new AuthError(
        'An account with that email already exists.',
        409
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

// --------------------------------------------------
// Login
// --------------------------------------------------

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const normalizedEmail = email.trim().toLowerCase();
  logInfo('auth.login.started', { email: normalizedEmail });

  const user = await Users.findOne({
    email: normalizedEmail,
    isActive: true,
  });

  let valid = false;

  try {
    valid = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
  } catch {
    throw new AuthError('Invalid email or password.', 401);
  }

  if (!user || !valid) {
    logInfo('auth.login.rejected', { email: normalizedEmail, reason: 'invalid_credentials' });
    throw new AuthError('Invalid email or password.', 401);
  }

  logInfo('auth.login.user_verified', { userId: user._id.toString() });

  const session = await mongoose.startSession();

  let tokens: AuthTokens | undefined;

  try {
    await session.withTransaction(async () => {
      user.lastLoginAt = new Date();

      await user.save({ session });

      tokens = await issueTokens(user, session);
    });

    if (!tokens) {
      throw new AppError(
        503,
        'Login could not be completed.',
        'AUTH_SERVICE_UNAVAILABLE'
      );
    }

    return {
      user: publicUser(user),
      tokens,
    };
  } catch (error: unknown) {
    logError('auth.login.failed', { userId: user._id.toString(), ...errorMetadata(error) });
    throw error;
  } finally {
    await session.endSession();
  }
}

// --------------------------------------------------
// Refresh access token
// --------------------------------------------------

export async function refreshAccessToken(
  token: string
): Promise<AuthTokens> {
  logInfo('auth.refresh.started');
  let payload: RefreshJwtPayload;

  try {
    const decoded = jwt.verify(token, refreshSecret());
    if (!isRefreshJwtPayload(decoded)) {
      throw new Error('Invalid refresh token.');
    }
    payload = decoded;
  } catch {
    throw new AuthError(
      'Invalid or expired refresh token.',
      401
    );
  }

  if (
    payload.type !== 'refresh' ||
    !payload.sub ||
    !payload.jti ||
    !Types.ObjectId.isValid(payload.sub)
  ) {
    throw new AuthError('Invalid refresh token.', 401);
  }

  const tokenHash = hashRefreshToken(token);

  const stored = await RefreshTokens.findOne({
    tokenHash,
    userId: new Types.ObjectId(payload.sub),
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!stored) {
    throw new AuthError(
      'Invalid or expired refresh token.',
      401
    );
  }

  const user = await Users.findOne({
    _id: payload.sub,
    isActive: true,
  });

  if (!user) {
    throw new AuthError('User account is inactive.', 401);
  }

  const session = await mongoose.startSession();

  let tokens: AuthTokens | undefined;

  try {
    await session.withTransaction(async () => {
      // Atomically claim the existing refresh token.
      // A concurrent request must not rotate it again.
      const claimed = await RefreshTokens.findOneAndUpdate(
        {
          _id: stored._id,
          tokenHash,
          revokedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { revokedAt: new Date() },
        },
        {
          new: false,
          session,
        }
      );

      if (!claimed) {
        throw new AuthError(
          'Invalid or expired refresh token.',
          401
        );
      }

      tokens = await issueTokens(user, session);

      await RefreshTokens.updateOne(
        { _id: stored._id },
        {
          $set: {
            replacedByTokenHash: hashRefreshToken(
              tokens.refreshToken
            ),
          },
        },
        { session }
      );
    });

    if (!tokens) {
      throw new AppError(
        503,
        'Token refresh could not be completed.',
        'AUTH_SERVICE_UNAVAILABLE'
      );
    }

    return tokens;
  } catch (error: unknown) {
    logError('auth.refresh.failed', errorMetadata(error));
    throw error;
  } finally {
    await session.endSession();
  }
}

// --------------------------------------------------
// Logout / revoke refresh token
// --------------------------------------------------

export async function revokeRefreshToken(
  token: string
): Promise<void> {
  logInfo('auth.logout.started');
  await RefreshTokens.updateOne(
    {
      tokenHash: hashRefreshToken(token),
      revokedAt: { $exists: false },
    },
    {
      $set: { revokedAt: new Date() },
    }
  );
  logInfo('auth.logout.completed');
}

// --------------------------------------------------
// Verify access token
// --------------------------------------------------

export const verifyAccessToken = (
  token: string
): JwtPayload => {
  try {
    const decoded = jwt.verify(token, accessSecret());

    if (!isAccessJwtPayload(decoded)) {
      throw new Error('Invalid token.');
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AuthError(
      'Invalid or expired access token.',
      401
    );
  }
};
