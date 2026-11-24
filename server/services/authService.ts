import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { isMongoConnected } from '../db/mongo.ts';
import { AdminModel } from '../models/index.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  return process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16
    ? process.env.JWT_SECRET.trim()
    : EPHEMERAL_SECRET;
}

export const AUTH_COOKIE_NAME = 'titanx_admin_session';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'receptionist';
}

export interface AuthenticatedRequest extends Request {
  admin?: AuthUser;
}

export function hasEnvAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSWORD?.trim());
}

export async function hasClaimedAdmin(): Promise<boolean> {
  if (!isMongoConnected()) return false;
  const count = await AdminModel.countDocuments();
  return count > 0;
}

export async function needsInitialSetup(): Promise<boolean> {
  if (hasEnvAdminConfigured()) return false;
  if (!isMongoConnected()) return false;
  return !(await hasClaimedAdmin());
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    getJwtSecret(),
    { expiresIn: '7d' },
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    if (!decoded || typeof decoded.email !== 'string') return null;
    return {
      id: String(decoded.sub || ''),
      name: String(decoded.name || 'Admin'),
      email: decoded.email,
      role: decoded.role === 'receptionist' ? 'receptionist' : 'owner',
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];

  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  const parts = [`${AUTH_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractCookieToken(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function isSameOriginMutation(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  let usedCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = extractCookieToken(req);
    usedCookie = Boolean(token);
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (usedCookie && !isSameOriginMutation(req)) {
    res.status(403).json({ error: 'Cross-origin mutation blocked' });
    return;
  }

  const user = verifyAuthToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.admin = user;
  next();
}

export function requireRole(role: 'owner' | 'receptionist') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (role === 'owner' && req.admin.role !== 'owner') {
      res.status(403).json({ error: 'Owner permission required' });
      return;
    }
    next();
  };
}

export async function verifyAdminLogin(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = String(email).trim().toLowerCase();

  if (hasEnvAdminConfigured()) {
    const envEmail = process.env.ADMIN_EMAIL!.trim().toLowerCase();
    const envPassword = process.env.ADMIN_PASSWORD!;
    if (normalizedEmail === envEmail && password === envPassword) {
      let existing = await AdminModel.findOne({ email: envEmail }).lean() as
        | { _id: unknown; name: string; email: string; role: 'owner' | 'receptionist' }
        | null;
      if (!existing) {
        const hash = await bcrypt.hash(envPassword, 10);
        const created = await AdminModel.create({
          name: 'TITAN X Owner',
          email: envEmail,
          password_hash: hash,
          role: 'owner',
        });
        return {
          id: String(created._id),
          name: created.name,
          email: created.email,
          role: 'owner',
        };
      }
      return {
        id: String(existing._id),
        name: existing.name,
        email: existing.email,
        role: existing.role,
      };
    }
  }

  const row = (await AdminModel.findOne({ email: normalizedEmail }).lean()) as
    | { _id: unknown; name: string; email: string; password_hash: string; role: 'owner' | 'receptionist' }
    | null;

  if (!row) return null;
  const ok = await bcrypt.compare(String(password), row.password_hash);
  if (!ok) return null;

  return { id: String(row._id), name: row.name, email: row.email, role: row.role };
}

export async function claimInitialAdmin(name: string, email: string, password: string): Promise<AuthUser> {
  if (!(await needsInitialSetup())) {
    throw new Error('Admin account has already been configured.');
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const hash = await bcrypt.hash(String(password), 10);
  const created = await AdminModel.create({
    name: String(name).trim() || 'TITAN X Owner',
    email: normalizedEmail,
    password_hash: hash,
    role: 'owner',
  });
  return {
    id: String(created._id),
    name: created.name,
    email: created.email,
    role: 'owner',
  };
}
