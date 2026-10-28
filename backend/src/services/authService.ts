import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import mongoose, { Types, type ClientSession } from 'mongoose';
import Users, { type UserDocument } from '../models/User.js';
import RefreshTokens from '../models/RefreshToken.js';
import type { JwtPayload, UserRole } from '../types/auth.js';
import { AppError } from '../middleware/appError.js';

const ACCESS_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const accessSecret = (): string => {
  if (!process.env.JWT_SECRET) throw new AppError(503, 'Authentication service is not configured.', 'AUTH_CONFIGURATION_ERROR');
  return process.env.JWT_SECRET;
};
const refreshSecret = (): string => {
  if (!process.env.JWT_REFRESH_SECRET) throw new AppError(503, 'Authentication service is not configured.', 'AUTH_CONFIGURATION_ERROR');
  return process.env.JWT_REFRESH_SECRET;
};

interface RefreshJwtPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string | number;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

export class AuthError extends AppError {
  constructor(message: string, statusCode: 400 | 401 | 409) {
    super(statusCode, message, statusCode === 401 ? 'AUTHENTICATION_FAILED' : statusCode === 409 ? 'CONFLICT' : 'VALIDATION_ERROR');
    this.name = 'AuthError';
  }
}

const publicUser = (user: UserDocument): PublicUser => ({
  id: user._id.toString(), name: user.name, email: user.email,
  role: user.role, department: user.department,
});

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const expiresAtFrom = (value: string | number): Date => {
  if (typeof value === 'number') return new Date(Date.now() + value * 1000);
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) throw new AppError(503, 'Authentication service is not configured.', 'AUTH_CONFIGURATION_ERROR');
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + Number(match[1]) * multipliers[match[2]]);
};

const issueTokens = async (user: UserDocument, session?: ClientSession): Promise<AuthTokens> => {
  try {
    const accessToken = jwt.sign({ userId: user._id.toString(), role: user.role, department: user.department }, accessSecret(), {
      subject: user._id.toString(), expiresIn: ACCESS_EXPIRES_IN,
    });
    const jti = crypto.randomUUID();
    const refreshToken = jwt.sign({ sub: user._id.toString(), jti, type: 'refresh' }, refreshSecret(), {
      subject: user._id.toString(), expiresIn: REFRESH_EXPIRES_IN,
    });
    const refreshTokenDocument = new RefreshTokens({ userId: user._id, tokenHash: hashRefreshToken(refreshToken), expiresAt: expiresAtFrom(REFRESH_EXPIRES_IN ?? '7d') });
    await refreshTokenDocument.save({ session });
    return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES_IN ?? '15m' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const errorName = (error as { name?: string })?.name ?? '';
    if (errorName.startsWith('Mongo') || errorName.startsWith('Mongoose') || errorName === 'ValidationError' || errorName === 'CastError') {
      throw error;
    }
    throw new AppError(503, 'Authentication service is temporarily unavailable.', 'AUTH_SERVICE_UNAVAILABLE', { cause: error });
  }
};

export async function registerUser(input: { name: string; email: string; password: string; role?: UserRole; department?: string }): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!input.name.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || input.password.length < 8) {
    throw new AuthError('Name, a valid email, and a password of at least 8 characters are required.', 400);
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const session = await mongoose.startSession();
  let result: { user: UserDocument; tokens: AuthTokens } | undefined;
  try {
    await session.withTransaction(async () => {
      const [user] = await Users.create([{ name: input.name.trim(), email: normalizedEmail, passwordHash, role: input.role ?? 'employee', department: input.department?.trim() }], { session });
      result = { user, tokens: await issueTokens(user, session) };
    });
    if (!result) throw new AppError(503, 'Registration could not be completed.', 'REGISTRATION_FAILED');
    return { user: publicUser(result.user), tokens: result.tokens };
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) throw new AuthError('An account with that email already exists.', 409);
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function loginUser(email: string, password: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await Users.findOne({ email: email.trim().toLowerCase(), isActive: true });
  let valid = false;
  try {
    valid = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  } catch {
    // Treat malformed legacy hashes exactly like bad credentials.
    throw new AuthError('Invalid email or password.', 401);
  }
  if (!user || !valid) throw new AuthError('Invalid email or password.', 401);
  const session = await mongoose.startSession();
  try {
    let tokens: AuthTokens;
    await session.withTransaction(async () => {
      user.lastLoginAt = new Date();
      await user.save({ session });
      tokens = await issueTokens(user, session);
    });
    return { user: publicUser(user), tokens: tokens! };
  } finally {
    await session.endSession();
  }
}

export async function refreshAccessToken(token: string): Promise<AuthTokens> {
  let payload: RefreshJwtPayload;
  try {
    payload = jwt.verify(token, refreshSecret()) as unknown as RefreshJwtPayload;
  } catch { throw new AuthError('Invalid or expired refresh token.', 401); }
  if (payload.type !== 'refresh' || !payload.sub || !payload.jti) throw new AuthError('Invalid refresh token.', 401);

  if (!Types.ObjectId.isValid(payload.sub)) throw new AuthError('Invalid refresh token.', 401);
  const tokenHash = hashRefreshToken(token);
  const stored = await RefreshTokens.findOne({ tokenHash, userId: new Types.ObjectId(payload.sub), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
  if (!stored) throw new AuthError('Invalid or expired refresh token.', 401);
  const user = await Users.findOne({ _id: payload.sub, isActive: true });
  if (!user) throw new AuthError('User account is inactive.', 401);

  const session = await mongoose.startSession();
  try {
    let tokens: AuthTokens;
    await session.withTransaction(async () => {
      tokens = await issueTokens(user, session);
      stored.revokedAt = new Date();
      stored.replacedByTokenHash = hashRefreshToken(tokens.refreshToken);
      await stored.save({ session });
    });
    return tokens!;
  } finally {
    await session.endSession();
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await RefreshTokens.updateOne({ tokenHash: hashRefreshToken(token), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, accessSecret()) as JwtPayload;
    if (!decoded.userId || !decoded.role) throw new Error('Invalid token.');
    return decoded;
  } catch { throw new AuthError('Invalid or expired access token.', 401); }
};
