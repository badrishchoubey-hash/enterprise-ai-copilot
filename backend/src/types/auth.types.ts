import type { SignOptions } from 'jsonwebtoken';

export type UserRole = 'employee' | 'support_agent' | 'admin';
export type JwtExpiresIn = NonNullable<SignOptions['expiresIn']>;

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
  department?: string;
}

export interface JwtPayload extends AccessTokenClaims {
  iat?: number;
  exp?: number;
  sub?: string;
}

export interface RefreshJwtPayload {
  sub: string;
  jti: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  department?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: JwtExpiresIn;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}
