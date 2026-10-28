import type { NextFunction, Request, Response } from 'express';
import { loginUser, refreshAccessToken, registerUser, revokeRefreshToken } from '../services/authService.js';

const bodyString = (value: unknown): value is string => typeof value === 'string';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, department } = req.body as Record<string, unknown>;
    if (!bodyString(name) || !bodyString(email) || !bodyString(password)) { res.status(400).json({ error: 'name, email, and password are required.' }); return; }
    // Public registration always creates an employee. Privileged roles must be
    // assigned by an authenticated administrator through a separate workflow.
    res.status(201).json(await registerUser({ name, email, password, department: bodyString(department) ? department : undefined }));
  } catch (error) { next(error); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as Record<string, unknown>;
    if (!bodyString(email) || !bodyString(password)) { res.status(400).json({ error: 'email and password are required.' }); return; }
    res.status(200).json(await loginUser(email, password));
  } catch (error) { next(error); }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.body as { refreshToken?: unknown }).refreshToken;
    if (!bodyString(token)) { res.status(400).json({ error: 'refreshToken is required.' }); return; }
    res.status(200).json(await refreshAccessToken(token));
  } catch (error) { next(error); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.body as { refreshToken?: unknown }).refreshToken;
    if (bodyString(token)) await revokeRefreshToken(token);
    res.status(204).send();
  } catch (error) { next(error); }
}
