import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCheck, Play, Save } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { NotificationRecord, NotificationTemplate } from '../../types/gym';

export const NotificationsPage: React.FC = () => {
  const [tab, setTab] = useState<'alerts' | 'logs' | 'templates'>('alerts');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [waStatus, setWaStatus] = useState<{ configured: boolean }>({ configured: false });
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean }>({ configured: false });
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState(false);

  const loadAll = useCallback(async () => {
    const [notifRes, tplRes] = await Promise.all([
      apiFetch<{
        notifications: NotificationRecord[];
        whatsappStatus: { configured: boolean };
        emailStatus: { configured: boolean };
      }>(`/api/admin/notifications?channel=${filterChannel}&status=${filterStatus}`),
      apiFetch<{ templates: NotificationTemplate[] }>('/api/admin/templates'),
    ]);
    setNotifications(notifRes.notifications);
    setWaStatus(notifRes.whatsappStatus);
    setEmailStatus(notifRes.emailStatus);
    setTemplates(tplRes.templates);
  }, [filterChannel, filterStatus]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const markRead = async (id?: string) => {
    await apiFetch('/api/admin/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await loadAll();
  };

  const handleRunDaily = async () => {
    setRunningJob(true);
    setToast(null);
    try {
      const res = await apiFetch<{
        dateIST: string;
        checkedSubscriptions: number;
        whatsappAttempted: number;
        emailAttempted: number;
        alertsCreated: number;
      }>('/api/admin/reminders/run-daily', { method: 'POST' });
      setToast(
        `Daily check (${res.dateIST}): ${res.checkedSubscriptions} subscriptions scanned · ${res.alertsCreated} in-app alerts · ${res.whatsappAttempted} WhatsApp · ${res.emailAttempted} Email.`,
      );
      await loadAll();
    } finally {
      setRunningJob(false);
    }
  };

  const saveTemplate = async (tpl: NotificationTemplate) => {
    await apiFetch(`/api/admin/templates/${tpl.id}`, {
      method: 'PUT',
      body: JSON.stringify(tpl),
    });
    setToast(`Saved template: ${tpl.name} (${tpl.channel.toUpperCase()})`);
    await loadAll();
  };

  const inAppList = notifications.filter((n) => n.channel === 'in_app');
  const deliveryLogs = notifications.filter((n) => n.channel !== 'in_app');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Reminders & Notifications
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            In-app alert center, WhatsApp & Email delivery logs, and customizable reminder templates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRunDaily()}
          disabled={runningJob}
          className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] disabled:opacity-60 whitespace-nowrap"
        >
          <Play className="h-3.5 w-3.5" />
          {runningJob ? 'Running Check...' : 'Run Daily Check Now'}
        </button>
      </div>

      {/* Integration Status Warnings */}
      {(!waStatus.configured || !emailStatus.configured) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {!waStatus.configured && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <div className="font-semibold text-white">WhatsApp integration not configured</div>
                <p className="mt-1 text-amber-200/80">
                  Set Meta Cloud API credentials in backend environment variables to enable automated
                  WhatsApp reminders.{' '}
                  <Link to="/admin/settings" className="underline text-white">
                    Configure in Settings
                  </Link>
                </p>
              </div>
            </div>
          )}
          {!emailStatus.configured && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Email integration not configured</div>
                <p className="mt-1 text-amber-200/80">
                  Configure Resend (or the legacy Gmail OAuth/SMTP fallback) on the server to dispatch
                  automated email reminders and receipts.{' '}
                  <Link to="/admin/settings" className="underline text-white">
                    View Email Settings
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-white/10">
        <div className="flex gap-2">
          {[
            { key: 'alerts', label: `Notification Center (${inAppList.length})` },
            { key: 'logs', label: `WhatsApp & Email Logs (${deliveryLogs.length})` },
            { key: 'templates', label: `Message Templates (${templates.length})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as typeof tab)}
              className={`border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === t.key ? 'border-[#EF1717] text-white' : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'alerts' && (
          <button
            type="button"
            onClick={() => void markRead()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#EF1717] hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark All Read
          </button>
        )}
      </div>

      {tab === 'alerts' && (
        <div className="space-y-3">
          {inAppList.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-[#151515] p-10 text-center text-sm text-[#A0A0A0]">
              No notifications in the inbox.
            </div>
          ) : (
            inAppList.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${
                  n.status === 'unread'
                    ? 'border-[#EF1717]/40 bg-[#151515]'
                    : 'border-white/10 bg-[#111111]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span>{n.title}</span>
                    {n.status === 'unread' && (
                      <span className="text-[11px] font-semibold text-[#EF1717]">· Unread</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#A0A0A0] leading-relaxed">{n.message}</p>
                  <div className="mt-2 font-mono-tabular text-[11px] text-[#737373]">
                    {n.created_at}
                  </div>
                </div>
                {n.status === 'unread' && (
                  <button
                    type="button"
                    onClick={() => void markRead(n.id)}
                    className="rounded border border-white/15 px-3 py-1 text-xs text-white hover:border-[#EF1717] whitespace-nowrap"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="rounded-md border border-white/10 bg-[#151515] px-3 py-2 text-xs text-white"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-white/10 bg-[#151515] px-3 py-2 text-xs text-white"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#151515]">
            {deliveryLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#A0A0A0]">No delivery logs recorded yet.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-[#A0A0A0]">
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Title / Member</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Message ID / Error</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {deliveryLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-xs font-semibold uppercase text-white">
                        {log.channel}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-white">{log.title}</div>
                        <div className="text-[#A0A0A0]">{log.full_name || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">
                        <span
                          className={
                            log.status === 'failed'
                              ? 'text-[#ff6b6b]'
                              : log.status === 'delivered' || log.status === 'sent'
                                ? 'text-emerald-400'
                                : 'text-[#A0A0A0]'
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#A0A0A0]">
                        {log.error_message || log.external_message_id || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-[#737373]">
                        {log.created_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border border-white/10 bg-[#151515] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold uppercase text-white">
                    {tpl.name}
                  </h3>
                  <span className="text-xs uppercase text-[#EF1717]">{tpl.channel}</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-white">
                  <input
                    type="checkbox"
                    checked={tpl.enabled}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((x) => (x.id === tpl.id ? { ...x, enabled: e.target.checked } : x)),
                      )
                    }
                    className="accent-[#EF1717]"
                  />
                  Enabled
                </label>
              </div>

              {tpl.channel === 'whatsapp' && (
                <div>
                  <label className="block text-[11px] text-[#A0A0A0]">Meta Approved Template Name</label>
                  <input
                    type="text"
                    value={tpl.meta_template_name || ''}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((x) =>
                          x.id === tpl.id ? { ...x, meta_template_name: e.target.value } : x,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-1.5 text-xs text-white font-mono-tabular"
                  />
                </div>
              )}

              {tpl.channel === 'email' && (
                <div>
                  <label className="block text-[11px] text-[#A0A0A0]">Email Subject</label>
                  <input
                    type="text"
                    value={tpl.subject || ''}
                    onChange={(e) =>
                      setTemplates((prev) =>
                        prev.map((x) => (x.id === tpl.id ? { ...x, subject: e.target.value } : x)),
                      )
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-1.5 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-[#A0A0A0]">
                  Message Body (Placeholders: {'{{member_name}}'}, {'{{expiry_date}}'}, {'{{days_remaining}}'}, {'{{plan_name}}'})
                </label>
                <textarea
                  rows={5}
                  value={tpl.body}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((x) => (x.id === tpl.id ? { ...x, body: e.target.value } : x)),
                    )
                  }
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveTemplate(tpl)}
                  className="inline-flex items-center gap-1.5 rounded bg-[#EF1717] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#d11313]"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
