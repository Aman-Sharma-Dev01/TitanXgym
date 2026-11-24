import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { connectMongo, getMongoStatus, isMongoConnected } from '../db/mongo.ts';
import { AdminModel } from '../models/index.ts';
import {
  claimInitialAdmin,
  clearSessionCookie,
  needsInitialSetup,
  requireAuth,
  requireRole,
  setSessionCookie,
  signAuthToken,
  verifyAdminLogin,
  type AuthenticatedRequest,
} from '../services/authService.ts';
import { getEmailConfigStatus, sendEmailMessage } from '../services/messagingService.ts';

export const authRouter = Router();

authRouter.get('/status', async (_req, res) => {
  if (!isMongoConnected() && process.env.MONGODB_URI?.trim()) {
    await connectMongo();
  }
  const mongo = getMongoStatus();
  res.json({
    needsSetup: mongo.connected ? await needsInitialSetup() : false,
    mongo,
  });
});

authRouter.post('/setup', async (req, res) => {
  if (!isMongoConnected()) {
    res.status(503).json({
      error: 'MongoDB is not connected. Please add MONGODB_URI in Secrets or .env.',
    });
    return;
  }
  if (!(await needsInitialSetup())) {
    res.status(409).json({ error: 'Admin account is already set up. Please sign in.' });
    return;
  }
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    res.status(400).json({ error: 'Please provide a valid admin email address.' });
    return;
  }
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  try {
    const admin = await claimInitialAdmin(String(name || 'TITAN X Owner'), String(email), String(password));
    const token = signAuthToken(admin);
    setSessionCookie(req, res, token);
    res.status(201).json({ user: admin, token });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Setup failed' });
  }
});

authRouter.post('/login', async (req, res) => {
  if (!isMongoConnected()) {
    res.status(503).json({
      error: 'MongoDB is not connected. Please add MONGODB_URI in Secrets or .env.',
    });
    return;
  }

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = await verifyAdminLogin(String(email), String(password));
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signAuthToken(user);
  setSessionCookie(req, res, token);
  res.json({ user, token });
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.admin });
});

authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: 'MongoDB not connected.' });
    return;
  }
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword || String(newPassword).length < 8) {
    res.status(400).json({ error: 'Current password and new password (min 8 chars) are required.' });
    return;
  }

  const row = await AdminModel.findById(req.admin!.id);
  if (!row) {
    res.status(404).json({ error: 'Admin account not found.' });
    return;
  }

  const valid = await bcrypt.compare(String(currentPassword), row.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  row.password_hash = await bcrypt.hash(String(newPassword), 10);
  await row.save();
  res.json({ ok: true, message: 'Password updated successfully.' });
});

authRouter.post('/forgot-password', async (req, res) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: 'MongoDB not connected.' });
    return;
  }
  const { email } = req.body as { email?: string };
  if (!email || !String(email).trim()) {
    res.status(400).json({ error: 'Email address is required.' });
    return;
  }

  const emailConfig = await getEmailConfigStatus();
  if (!emailConfig.configured) {
    res.status(503).json({
      error:
        'Email integration is not configured yet. Set Resend credentials in environment variables.',
    });
    return;
  }

  const normalized = String(email).trim().toLowerCase();
  const admin = await AdminModel.findOne({ email: normalized });

  if (admin) {
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    admin.reset_token_hash = codeHash;
    admin.reset_expires_at = new Date(Date.now() + 15 * 60 * 1000);
    await admin.save();

    await sendEmailMessage({
      toEmail: admin.email,
      subject: 'TITAN X Admin Password Reset Code',
      bodyText: `Hello ${admin.name},\n\nYour password reset verification code is: ${code}\n\nThis code expires in 15 minutes.`,
      type: 'password_reset',
      title: 'Admin Password Reset',
    });
  }

  res.json({
    ok: true,
    message: 'If an admin account matches that email, a 6-digit reset code has been dispatched.',
  });
});

authRouter.post('/reset-password', async (req, res) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: 'MongoDB not connected.' });
    return;
  }
  const { email, code, newPassword } = req.body as {
    email?: string;
    code?: string;
    newPassword?: string;
  };
  if (!email || !code || !newPassword || String(newPassword).length < 8) {
    res.status(400).json({ error: 'Email, 6-digit code, and new password (min 8 chars) are required.' });
    return;
  }

  const normalized = String(email).trim().toLowerCase();
  const row = await AdminModel.findOne({ email: normalized });

  if (!row || !row.reset_token_hash || !row.reset_expires_at) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  if (new Date(row.reset_expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset code has expired.' });
    return;
  }

  const incomingHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  if (incomingHash !== row.reset_token_hash) {
    res.status(400).json({ error: 'Invalid reset code.' });
    return;
  }

  row.password_hash = await bcrypt.hash(String(newPassword), 10);
  row.reset_token_hash = null;
  row.reset_expires_at = null;
  await row.save();

  res.json({ ok: true, message: 'Password reset successful. You can now log in.' });
});

// Role-based architecture for future receptionist access (owner-only)
authRouter.get('/staff', requireAuth, requireRole('owner'), async (_req, res) => {
  const rows = (await AdminModel.find().select('name email role created_at').sort({ _id: 1 }).lean()) as Array<
    Record<string, unknown>
  >;
  res.json({
    staff: rows.map((r) => ({
      id: String(r._id),
      name: r.name,
      email: r.email,
      role: r.role,
      created_at: r.created_at,
    })),
  });
});

authRouter.post('/staff', requireAuth, requireRole('owner'), async (req, res) => {
  const { name, email, password, role } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };
  if (!name || !email || !password || String(password).length < 8) {
    res.status(400).json({ error: 'Name, valid email, and password (min 8 chars) are required.' });
    return;
  }
  const safeRole = role === 'receptionist' ? 'receptionist' : 'owner';
  const normalized = String(email).trim().toLowerCase();
  const exists = await AdminModel.findOne({ email: normalized }).lean();
  if (exists) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  const created = await AdminModel.create({
    name: String(name).trim(),
    email: normalized,
    password_hash: hash,
    role: safeRole,
  });
  res.status(201).json({
    id: String(created._id),
    name: created.name,
    email: created.email,
    role: safeRole,
  });
});
