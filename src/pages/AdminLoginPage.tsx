import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, KeyRound, Lock, Mail, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export const AdminLoginPage: React.FC = () => {
  const { user, loading, needsSetup, mongoStatus, login, setup, refreshAuth } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('TITAN X Owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808] text-sm text-[#A0A0A0]">
        Verifying session...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await setup(name, email, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setInfoMsg(res.message);
      setMode('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });
      setInfoMsg(res.message);
      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#080808] px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-[#A0A0A0] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to TITAN X Website
        </Link>

        <div className="rounded-lg border border-white/10 bg-[#151515] p-6 sm:p-8">
          <div className="flex items-center gap-3.5 border-b border-white/10 pb-6">
            <img
              src="/src/assets/images/titanx_logo_1795517847867.jpg"
              alt="TITAN X Logo"
              className="h-12 w-12 rounded object-cover border border-white/15"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                TITAN <span className="text-[#EF1717]">X</span> Admin
              </h1>
              <p className="text-xs text-[#A0A0A0]">
                {needsSetup
                  ? 'Initial Owner Account Setup'
                  : mode === 'login'
                    ? 'Sign in to Gym Management Console'
                    : 'Reset Admin Password'}
              </p>
            </div>
          </div>

          {mongoStatus && !mongoStatus.connected && (
            <div className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Database className="h-4 w-4 text-amber-400 shrink-0" />
                MongoDB Connection Required
              </div>
              <p className="leading-relaxed">
                {mongoStatus.configured
                  ? 'Could not connect to MongoDB. Please verify your MONGODB_URI secret and network access.'
                  : 'MONGODB_URI is not configured yet. Add your MongoDB Atlas or server URI under Secrets as MONGODB_URI, then restart or retry.'}
              </p>
              {mongoStatus.error && (
                <p className="font-mono-tabular text-[11px] text-amber-300/90 break-all">
                  {mongoStatus.error}
                </p>
              )}
              <button
                type="button"
                onClick={() => void refreshAuth()}
                className="inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white hover:border-white/50"
              >
                <RefreshCw className="h-3 w-3" />
                Retry MongoDB Check
              </button>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-md border border-[#EF1717]/40 bg-[#EF1717]/10 px-4 py-3 text-xs text-[#ff8080]">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="mt-5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              {infoMsg}
            </div>
          )}

          {needsSetup ? (
            <form onSubmit={(e) => void handleSetup(e)} className="mt-6 space-y-4">
              <div className="rounded-md border border-white/10 bg-[#080808] p-3 text-xs text-[#A0A0A0]">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-[#EF1717]" />
                  First-Run Admin Setup
                </div>
                <p className="mt-1">
                  Create your gym owner credentials below. This setup form locks permanently once
                  registered.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Owner Name</label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-[#080808] py-2.5 pl-9 pr-3 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Admin Email</label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@titanxgym.in"
                    className="w-full rounded-md border border-white/10 bg-[#080808] py-2.5 pl-9 pr-3 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">
                  Password (min 8 characters)
                </label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-md border border-white/10 bg-[#080808] py-2.5 pl-9 pr-3 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-[#EF1717] py-2.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#d11313] disabled:opacity-60"
              >
                {submitting ? 'Creating Owner Account...' : 'Create Owner Account'}
              </button>
            </form>
          ) : mode === 'login' ? (
            <form onSubmit={(e) => void handleLogin(e)} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Admin Email</label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@titanxgym.in"
                    className="w-full rounded-md border border-white/10 bg-[#080808] py-2.5 pl-9 pr-3 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#A0A0A0]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfoMsg(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-[#EF1717] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-md border border-white/10 bg-[#080808] py-2.5 pl-9 pr-3 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-[#EF1717] py-2.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#d11313] disabled:opacity-60"
              >
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : mode === 'forgot' ? (
            <form onSubmit={(e) => void handleForgot(e)} className="mt-6 space-y-4">
              <p className="text-xs text-[#A0A0A0]">
                Enter your admin email to receive a 6-digit verification code via the configured
                email service.
              </p>
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Admin Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-[#EF1717] py-2.5 text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] disabled:opacity-60"
              >
                {submitting ? 'Sending Code...' : 'Send Reset Code'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-xs text-[#A0A0A0] hover:text-white"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleReset(e)} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">6-Digit Code</label>
                <div className="relative mt-1.5">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-[#080808] py-2.5 pl-9 pr-3 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-[#EF1717] py-2.5 text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] disabled:opacity-60"
              >
                {submitting ? 'Updating...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-xs text-[#A0A0A0] hover:text-white"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
