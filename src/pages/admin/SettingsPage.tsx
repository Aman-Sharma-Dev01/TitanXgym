import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Mail, MessageCircle, Save, Shield, UserPlus } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { GymSettings } from '../../types/gym';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [waStatus, setWaStatus] = useState<{
    configured: boolean;
    apiVersion: string;
    phoneNumberIdMasked: string | null;
    wabaIdMasked: string | null;
    hasAccessToken: boolean;
  } | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    provider: string;
    fromName: string;
    fromAddress: string | null;
    smtpHost: string | null;
  } | null>(null);
  const [inquiries, setInquiries] = useState<
    Array<{ id: string; name: string; mobile: string; email: string | null; message: string; status: string; created_at: string }>
  >([]);
  const [schedulerRuns, setSchedulerRuns] = useState<
    Array<{ run_date_ist: string; status: string; summary: string; ran_at: string }>
  >([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  const [testWaPhone, setTestWaPhone] = useState('');
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'receptionist' });
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadSettings = useCallback(async () => {
    const res = await apiFetch<{
      settings: GymSettings;
      whatsappStatus: typeof waStatus;
      emailStatus: typeof emailStatus;
      inquiries: typeof inquiries;
      schedulerRuns: typeof schedulerRuns;
    }>('/api/admin/settings');
    setSettings(res.settings);
    setWaStatus(res.whatsappStatus);
    setEmailStatus(res.emailStatus);
    setInquiries(res.inquiries);
    setSchedulerRuns(res.schedulerRuns);

    if (user?.role === 'owner') {
      const staffRes = await apiFetch<{ staff: typeof staff }>('/api/auth/staff').catch(() => ({ staff: [] }));
      setStaff(staffRes.staff);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setToast(null);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setToast({ ok: true, msg: 'Settings saved successfully.' });
      await loadSettings();
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Failed to save settings' });
    }
  };

  const handleTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    try {
      await apiFetch('/api/admin/integrations/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ mobile: testWaPhone }),
      });
      setToast({ ok: true, msg: 'Test WhatsApp message dispatched via Meta Cloud API.' });
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'WhatsApp test failed' });
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    try {
      await apiFetch('/api/admin/integrations/email/test', {
        method: 'POST',
        body: JSON.stringify({ email: testEmailAddr }),
      });
      setToast({ ok: true, msg: 'Test email dispatched successfully.' });
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Email test failed' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pwdForm),
      });
      setToast({ ok: true, msg: res.message });
      setPwdForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Password update failed' });
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    try {
      await apiFetch('/api/auth/staff', {
        method: 'POST',
        body: JSON.stringify(staffForm),
      });
      setToast({ ok: true, msg: `Created ${staffForm.role} account for ${staffForm.email}.` });
      setStaffForm({ name: '', email: '', password: '', role: 'receptionist' });
      await loadSettings();
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Failed to create staff' });
    }
  };

  if (!settings) {
    return <div className="p-6 text-sm text-[#A0A0A0]">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
          System Settings & Integrations
        </h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          Configure gym info, automated reminder schedule (Asia/Kolkata), WhatsApp Cloud API, Email,
          and security.
        </p>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
            toast.ok
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
              : 'border-[#EF1717]/40 bg-[#EF1717]/10 text-[#ff8080]'
          }`}
        >
          {toast.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 1. Gym Profile & Scheduler */}
      <form
        onSubmit={(e) => void handleSaveSettings(e)}
        className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-5"
      >
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white border-b border-white/10 pb-2">
          Gym Information & Reminder Schedule
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs text-[#A0A0A0]">Gym Name</label>
            <input
              type="text"
              value={settings.gym_name}
              onChange={(e) => setSettings({ ...settings, gym_name: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Tagline</label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Contact Number</label>
            <input
              type="text"
              value={settings.contact_number}
              onChange={(e) => setSettings({ ...settings, contact_number: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Mon–Sat Hours</label>
            <input
              type="text"
              value={settings.hours_mon_sat}
              onChange={(e) => setSettings({ ...settings, hours_mon_sat: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Sunday Hours</label>
            <input
              type="text"
              value={settings.hours_sun}
              onChange={(e) => setSettings({ ...settings, hours_sun: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Daily Reminder Hour (IST 0–23)</label>
            <input
              type="number"
              min="0"
              max="23"
              value={settings.reminder_hour_ist ?? 9}
              onChange={(e) =>
                setSettings({ ...settings, reminder_hour_ist: Number(e.target.value) })
              }
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white font-mono-tabular"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-[#A0A0A0]">Google Maps URL</label>
            <input
              type="url"
              value={settings.maps_url}
              onChange={(e) => setSettings({ ...settings, maps_url: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Address</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Instagram URL (Optional)</label>
            <input
              type="url"
              value={settings.social_instagram || ''}
              onChange={(e) => setSettings({ ...settings, social_instagram: e.target.value })}
              placeholder="https://instagram.com/..."
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Facebook URL (Optional)</label>
            <input
              type="url"
              value={settings.social_facebook || ''}
              onChange={(e) => setSettings({ ...settings, social_facebook: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">YouTube URL (Optional)</label>
            <input
              type="url"
              value={settings.social_youtube || ''}
              onChange={(e) => setSettings({ ...settings, social_youtube: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-[#A0A0A0]">
          <span>Currency: {settings.currency} · Timezone: {settings.timezone}</span>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313]"
          >
            <Save className="h-3.5 w-3.5" />
            Save Gym Settings
          </button>
        </div>
      </form>

      {/* 2. WhatsApp & Email Integrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase text-white">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              WhatsApp Business Cloud API
            </div>
            <span
              className={`text-xs font-semibold ${
                waStatus?.configured ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {waStatus?.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-[#A0A0A0]">
            <div className="flex justify-between">
              <span>API Version</span>
              <span className="font-mono-tabular text-white">{waStatus?.apiVersion}</span>
            </div>
            <div className="flex justify-between">
              <span>Phone Number ID (env)</span>
              <span className="font-mono-tabular text-white">
                {waStatus?.phoneNumberIdMasked || 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>WABA ID (env)</span>
              <span className="font-mono-tabular text-white">{waStatus?.wabaIdMasked || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span>Access Token</span>
              <span className="text-white">
                {waStatus?.hasAccessToken ? 'Loaded in backend env' : 'Missing WHATSAPP_ACCESS_TOKEN'}
              </span>
            </div>
          </div>

          <form onSubmit={(e) => void handleTestWhatsApp(e)} className="flex gap-2 pt-2">
            <input
              type="tel"
              required
              value={testWaPhone}
              onChange={(e) => setTestWaPhone(e.target.value)}
              placeholder="10-digit test mobile"
              className="flex-1 rounded border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="rounded bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-[#EF1717]"
            >
              Send Test
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase text-white">
              <Mail className="h-5 w-5 text-[#EF1717]" />
              Resend / Email Integration
            </div>
            <span
              className={`text-xs font-semibold ${
                emailStatus?.configured ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {emailStatus?.configured ? `Configured (${emailStatus.provider})` : 'Not Configured'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-[#A0A0A0]">
            <div className="flex justify-between">
              <span>From Name</span>
              <span className="text-white">{emailStatus?.fromName}</span>
            </div>
            <div className="flex justify-between">
              <span>From Email</span>
              <span className="font-mono-tabular text-white">
                {emailStatus?.fromAddress || 'Not set in env'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Email Transport</span>
              <span className="font-mono-tabular text-white">
                {emailStatus?.smtpHost || 'Not configured'}
              </span>
            </div>
          </div>

          <form onSubmit={(e) => void handleTestEmail(e)} className="flex gap-2 pt-2">
            <input
              type="email"
              required
              value={testEmailAddr}
              onChange={(e) => setTestEmailAddr(e.target.value)}
              placeholder="Recipient test email"
              className="flex-1 rounded border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="rounded bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-[#EF1717]"
            >
              Send Test
            </button>
          </form>
        </div>
      </div>

      {/* 3. Password & Role Management */}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={(e) => void handleChangePassword(e)}
          className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase text-white border-b border-white/10 pb-2">
            <Shield className="h-5 w-5 text-[#EF1717]" />
            Change Admin Password
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">Current Password</label>
            <input
              type="password"
              required
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A0A0A0]">New Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold uppercase text-white hover:bg-[#d11313]"
          >
            Update Password
          </button>
        </form>

        {user?.role === 'owner' && (
          <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-4">
            <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase text-white border-b border-white/10 pb-2">
              <UserPlus className="h-5 w-5 text-[#EF1717]" />
              Staff & Receptionist Access
            </div>
            <div className="space-y-2 text-xs">
              {staff.map((st) => (
                <div key={st.id} className="flex items-center justify-between rounded border border-white/10 bg-[#080808] px-3 py-2">
                  <span className="text-white">{st.name} · {st.email}</span>
                  <span className="uppercase text-[#EF1717] font-semibold">{st.role}</span>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => void handleAddStaff(e)} className="grid gap-2 sm:grid-cols-2 pt-2">
              <input
                type="text"
                required
                placeholder="Staff Name"
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className="rounded border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="rounded border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Password (min 8)"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                className="rounded border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="rounded bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-[#EF1717]"
              >
                Add Receptionist
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 4. Website Contact Inquiries & Scheduler History */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-[#151515] p-6">
          <h2 className="font-display text-lg font-semibold uppercase text-white border-b border-white/10 pb-2">
            Website Contact Inquiries
          </h2>
          {inquiries.length === 0 ? (
            <p className="mt-4 text-xs text-[#A0A0A0]">No inquiries submitted from the website yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-white/10">
              {inquiries.map((inq) => (
                <div key={inq.id} className="py-3 text-xs">
                  <div className="flex justify-between font-semibold text-white">
                    <span>
                      {inq.name} · +91 {inq.mobile}
                    </span>
                    <span className="uppercase text-[#EF1717]">{inq.status}</span>
                  </div>
                  <p className="mt-1 text-[#A0A0A0]">{inq.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#151515] p-6">
          <h2 className="font-display text-lg font-semibold uppercase text-white border-b border-white/10 pb-2">
            Automated Scheduler Run Log (IST)
          </h2>
          {schedulerRuns.length === 0 ? (
            <p className="mt-4 text-xs text-[#A0A0A0]">No scheduled daily runs logged yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-white/10">
              {schedulerRuns.map((run) => (
                <div key={run.run_date_ist} className="py-2.5 text-xs">
                  <div className="flex justify-between font-mono-tabular text-white">
                    <span>{run.run_date_ist}</span>
                    <span className="text-emerald-400 uppercase">{run.status}</span>
                  </div>
                  <p className="mt-1 font-mono-tabular text-[11px] text-[#A0A0A0]">{run.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
