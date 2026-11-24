import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { isMongoConnected } from '../db/mongo.ts';
import { GymSettingsModel, NotificationModel } from '../models/index.ts';
import { formatReadableDate } from '../utils/time.ts';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface TemplateContext {
  member_name: string;
  member_id?: string;
  expiry_date?: string;
  days_remaining?: number | string;
  plan_name?: string;
  amount_paid?: number | string;
  payment_date?: string;
  receipt_number?: string;
}

export function interpolateTemplate(template: string, ctx: TemplateContext): string {
  const readableExpiry = ctx.expiry_date ? formatReadableDate(ctx.expiry_date) : '';
  const readablePayDate = ctx.payment_date ? formatReadableDate(ctx.payment_date) : '';
  const replacements: Record<string, string> = {
    member_name: ctx.member_name || '',
    member_id: ctx.member_id || '',
    expiry_date: readableExpiry,
    days_remaining: String(ctx.days_remaining ?? ''),
    plan_name: ctx.plan_name || '',
    amount_paid: String(ctx.amount_paid ?? ''),
    payment_date: readablePayDate,
    receipt_number: ctx.receipt_number || '',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => replacements[key] ?? '');
}

export function normalizeIndianPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppChatLink(mobile: string, message: string): string {
  const phone = normalizeIndianPhone(mobile);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export async function getWhatsAppConfigStatus(): Promise<{
  configured: boolean;
  apiVersion: string;
  phoneNumberIdMasked: string | null;
  wabaIdMasked: string | null;
  hasAccessToken: boolean;
  hasVerifyToken: boolean;
}> {
  const settings = isMongoConnected()
    ? ((await GymSettingsModel.findOne({ singleton_key: 'default' }).lean()) as
        | { whatsapp_api_version?: string; whatsapp_phone_number_id?: string | null; whatsapp_waba_id?: string | null }
        | null)
    : null;

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || settings?.whatsapp_phone_number_id?.trim() || '';
  const wabaId = process.env.WHATSAPP_WABA_ID?.trim() || settings?.whatsapp_waba_id?.trim() || '';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '';
  const apiVersion =
    process.env.WHATSAPP_API_VERSION?.trim() || settings?.whatsapp_api_version || 'v21.0';

  const mask = (val: string) =>
    val.length > 4 ? `${'•'.repeat(Math.max(4, val.length - 4))}${val.slice(-4)}` : val ? '••••' : null;

  return {
    configured: Boolean(phoneNumberId && accessToken),
    apiVersion,
    phoneNumberIdMasked: mask(phoneNumberId),
    wabaIdMasked: mask(wabaId),
    hasAccessToken: Boolean(accessToken),
    hasVerifyToken: Boolean(verifyToken),
  };
}

export async function getEmailConfigStatus(): Promise<{
  configured: boolean;
  provider: 'resend' | 'gmail_oauth' | 'smtp' | 'unconfigured';
  fromName: string;
  fromAddress: string | null;
  smtpHost: string | null;
}> {
  const settings = isMongoConnected()
    ? ((await GymSettingsModel.findOne({ singleton_key: 'default' }).lean()) as
        | { email_from_name?: string; email_from_address?: string | null }
        | null)
    : null;

  const fromName =
    process.env.EMAIL_FROM_NAME?.trim() ||
    settings?.email_from_name ||
    "TITAN X – Faridabad's Home of Strength";
  const fromAddress =
    process.env.RESEND_FROM_ADDRESS?.trim() ||
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    process.env.SMTP_USER?.trim() ||
    settings?.email_from_address ||
    null;

  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim() && fromAddress);
  const hasOAuth = Boolean(
    process.env.GMAIL_CLIENT_ID?.trim() &&
      process.env.GMAIL_CLIENT_SECRET?.trim() &&
      process.env.GMAIL_REFRESH_TOKEN?.trim() &&
      fromAddress,
  );
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );

  return {
    configured: hasResend || hasOAuth || hasSmtp,
    provider: hasResend ? 'resend' : hasOAuth ? 'gmail_oauth' : hasSmtp ? 'smtp' : 'unconfigured',
    fromName,
    fromAddress,
    smtpHost: process.env.SMTP_HOST?.trim() || (hasOAuth ? 'smtp.gmail.com' : hasResend ? 'api.resend.com' : null),
  };
}

export async function sendWhatsAppMessage(params: {
  memberDbId?: string | null;
  subscriptionId?: string | null;
  mobile: string;
  optIn: boolean;
  messageBody: string;
  metaTemplateName?: string | null;
  templateParams?: string[];
  type: string;
  title: string;
  dedupeKey?: string;
}): Promise<{ ok: boolean; status: string; messageId?: string; error?: string }> {
  if (!params.optIn) {
    const err = 'Member has opted out of WhatsApp notifications';
    await recordNotificationLog({
      type: params.type,
      channel: 'whatsapp',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.messageBody,
      status: 'failed',
      errorMessage: err,
      dedupeKey: params.dedupeKey,
    });
    return { ok: false, status: 'failed', error: err };
  }

  const settings = isMongoConnected()
    ? ((await GymSettingsModel.findOne({ singleton_key: 'default' }).lean()) as
        | { whatsapp_api_version?: string; whatsapp_phone_number_id?: string | null }
        | null)
    : null;

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || settings?.whatsapp_phone_number_id?.trim() || '';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const apiVersion =
    process.env.WHATSAPP_API_VERSION?.trim() || settings?.whatsapp_api_version || 'v21.0';

  if (!phoneNumberId || !accessToken) {
    const err = 'WhatsApp integration not configured';
    await recordNotificationLog({
      type: params.type,
      channel: 'whatsapp',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.messageBody,
      status: 'failed',
      errorMessage: err,
      dedupeKey: params.dedupeKey,
    });
    return { ok: false, status: 'failed', error: err };
  }

  const toPhone = normalizeIndianPhone(params.mobile);
  const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`;

  const payload = params.metaTemplateName
    ? {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: params.metaTemplateName,
          language: { code: 'en' },
          components: params.templateParams?.length
            ? [
                {
                  type: 'body',
                  parameters: params.templateParams.map((p) => ({ type: 'text', text: p })),
                },
              ]
            : undefined,
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: params.messageBody },
      };

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };

    if (!resp.ok) {
      const errMsg = data?.error?.message || `Meta Cloud API HTTP ${resp.status}`;
      await recordNotificationLog({
        type: params.type,
        channel: 'whatsapp',
        memberDbId: params.memberDbId,
        subscriptionId: params.subscriptionId,
        title: params.title,
        message: params.messageBody,
        status: 'failed',
        errorMessage: errMsg,
        dedupeKey: params.dedupeKey,
      });
      await createInAppAlert(
        'whatsapp_failed',
        'WhatsApp Reminder Failed',
        `${params.title}: ${errMsg}`,
        params.memberDbId,
        params.subscriptionId,
      );
      return { ok: false, status: 'failed', error: errMsg };
    }

    const msgId = data?.messages?.[0]?.id || undefined;
    await recordNotificationLog({
      type: params.type,
      channel: 'whatsapp',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.messageBody,
      status: 'sent',
      externalMessageId: msgId,
      dedupeKey: params.dedupeKey,
    });
    return { ok: true, status: 'sent', messageId: msgId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Network error calling WhatsApp Cloud API';
    await recordNotificationLog({
      type: params.type,
      channel: 'whatsapp',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.messageBody,
      status: 'failed',
      errorMessage: errMsg,
      dedupeKey: params.dedupeKey,
    });
    return { ok: false, status: 'failed', error: errMsg };
  }
}

export async function sendEmailMessage(params: {
  memberDbId?: string | null;
  subscriptionId?: string | null;
  toEmail: string | null | undefined;
  subject: string;
  bodyText: string;
  type: string;
  title: string;
  dedupeKey?: string;
}): Promise<{ ok: boolean; status: string; messageId?: string; error?: string }> {
  if (!params.toEmail || !params.toEmail.trim()) {
    return { ok: false, status: 'skipped', error: 'Member email address not provided' };
  }

  const config = await getEmailConfigStatus();
  if (!config.configured || !config.fromAddress) {
    const err = 'Email integration not configured';
    await recordNotificationLog({
      type: params.type,
      channel: 'email',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.bodyText,
      status: 'failed',
      errorMessage: err,
      dedupeKey: params.dedupeKey,
    });
    return { ok: false, status: 'failed', error: err };
  }

  try {
    const htmlBody = `
      <div style="background:#080808;color:#ffffff;padding:32px;font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #262626;">
        <div style="border-bottom:2px solid #EF1717;padding-bottom:16px;margin-bottom:24px;">
          <div style="font-size:24px;font-weight:800;letter-spacing:2px;color:#ffffff;">TITAN <span style="color:#EF1717;">X</span></div>
          <div style="font-size:12px;color:#A0A0A0;margin-top:4px;">Faridabad's Home of Strength · Powerbuilding Gym</div>
        </div>
        <div style="font-size:15px;line-height:1.65;color:#EAEAEA;white-space:pre-line;">${escapeHtml(params.bodyText)}</div>
        <div style="margin-top:28px;padding-top:16px;border-top:1px solid #262626;font-size:12px;color:#A0A0A0;">
          <div>Contact: +91 9217258251</div>
          <div>Hours: Mon–Sat 5:00 AM – 11:00 PM · Sun 2:00 PM – 11:00 PM</div>
        </div>
      </div>
    `;

    let externalMessageId: string | undefined;

    if (config.provider === 'resend') {
      const resend = new Resend(process.env.RESEND_API_KEY!.trim());
      const { data, error } = await resend.emails.send({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: [params.toEmail.trim()],
        subject: params.subject,
        text: params.bodyText,
        html: htmlBody,
      });
      if (error) {
        throw new Error(error.message);
      }
      externalMessageId = data?.id;
    } else {
      const transporter =
        config.provider === 'gmail_oauth'
          ? nodemailer.createTransport({
              service: 'gmail',
              auth: {
                type: 'OAuth2',
                user: config.fromAddress,
                clientId: process.env.GMAIL_CLIENT_ID!.trim(),
                clientSecret: process.env.GMAIL_CLIENT_SECRET!.trim(),
                refreshToken: process.env.GMAIL_REFRESH_TOKEN!.trim(),
              },
            })
          : nodemailer.createTransport({
              host: process.env.SMTP_HOST!.trim(),
              port: Number(process.env.SMTP_PORT || 587),
              secure: Number(process.env.SMTP_PORT || 587) === 465,
              auth: {
                user: process.env.SMTP_USER!.trim(),
                pass: process.env.SMTP_PASS!.trim(),
              },
            });

      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: params.toEmail.trim(),
        subject: params.subject,
        text: params.bodyText,
        html: htmlBody,
      });
      externalMessageId = info.messageId;
    }

    await recordNotificationLog({
      type: params.type,
      channel: 'email',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.bodyText,
      status: 'sent',
      externalMessageId,
      dedupeKey: params.dedupeKey,
    });
    return { ok: true, status: 'sent', messageId: externalMessageId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Email delivery error';
    await recordNotificationLog({
      type: params.type,
      channel: 'email',
      memberDbId: params.memberDbId,
      subscriptionId: params.subscriptionId,
      title: params.title,
      message: params.bodyText,
      status: 'failed',
      errorMessage: errMsg,
      dedupeKey: params.dedupeKey,
    });
    await createInAppAlert(
      'email_failed',
      'Email Reminder Failed',
      `${params.title}: ${errMsg}`,
      params.memberDbId,
      params.subscriptionId,
    );
    return { ok: false, status: 'failed', error: errMsg };
  }
}

export async function recordNotificationLog(entry: {
  type: string;
  channel: 'in_app' | 'whatsapp' | 'email';
  memberDbId?: string | null;
  subscriptionId?: string | null;
  title: string;
  message: string;
  status: string;
  externalMessageId?: string | null;
  errorMessage?: string | null;
  dedupeKey?: string;
}): Promise<void> {
  if (!isMongoConnected()) return;
  const sentAt = entry.status === 'sent' ? new Date() : null;

  if (entry.dedupeKey) {
    const existing = await NotificationModel.findOne({ dedupe_key: entry.dedupeKey }).lean();
    if (existing) {
      await NotificationModel.updateOne(
        { dedupe_key: entry.dedupeKey },
        {
          $set: {
            status: entry.status,
            error_message: entry.errorMessage ?? null,
            ...(entry.externalMessageId ? { external_message_id: entry.externalMessageId } : {}),
            ...(sentAt ? { sent_at: sentAt } : {}),
          },
          $inc: { retry_count: 1 },
        },
      );
      return;
    }
  }

  await NotificationModel.create({
    type: entry.type,
    channel: entry.channel,
    member_db_id: entry.memberDbId || null,
    subscription_id: entry.subscriptionId || null,
    title: entry.title,
    message: entry.message,
    status: entry.status,
    external_message_id: entry.externalMessageId ?? null,
    error_message: entry.errorMessage ?? null,
    dedupe_key: entry.dedupeKey || undefined,
    sent_at: sentAt,
  });
}

export async function createInAppAlert(
  type: string,
  title: string,
  message: string,
  memberDbId?: string | null,
  subscriptionId?: string | null,
  dedupeKey?: string,
): Promise<void> {
  if (!isMongoConnected()) return;
  if (dedupeKey) {
    const exists = await NotificationModel.findOne({ dedupe_key: dedupeKey }).lean();
    if (exists) return;
  }
  await NotificationModel.create({
    type,
    channel: 'in_app',
    member_db_id: memberDbId || null,
    subscription_id: subscriptionId || null,
    title,
    message,
    status: 'unread',
    dedupe_key: dedupeKey || undefined,
  });
}
