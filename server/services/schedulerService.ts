import cron from 'node-cron';
import { isMongoConnected } from '../db/mongo.ts';
import {
  GymSettingsModel,
  NotificationModel,
  NotificationTemplateModel,
  SchedulerRunModel,
  SubscriptionModel,
} from '../models/index.ts';
import { computeSubscriptionState, getNowIST, getTodayIST } from '../utils/time.ts';
import {
  createInAppAlert,
  interpolateTemplate,
  sendEmailMessage,
  sendWhatsAppMessage,
} from './messagingService.ts';

let cronTask: ReturnType<typeof cron.schedule> | null = null;
let isRunning = false;

export async function runDailyExpiryAndReminderJob(forceManual = false): Promise<{
  ran: boolean;
  dateIST: string;
  checkedSubscriptions: number;
  whatsappAttempted: number;
  emailAttempted: number;
  alertsCreated: number;
}> {
  const todayIST = getTodayIST();
  if (!isMongoConnected() || isRunning) {
    return {
      ran: false,
      dateIST: todayIST,
      checkedSubscriptions: 0,
      whatsappAttempted: 0,
      emailAttempted: 0,
      alertsCreated: 0,
    };
  }

  isRunning = true;
  let checkedSubscriptions = 0;
  let whatsappAttempted = 0;
  let emailAttempted = 0;
  let alertsCreated = 0;

  try {
    if (!forceManual) {
      const alreadyRan = await SchedulerRunModel.findOne({ run_date_ist: todayIST }).lean();
      if (alreadyRan) {
        return {
          ran: false,
          dateIST: todayIST,
          checkedSubscriptions: 0,
          whatsappAttempted: 0,
          emailAttempted: 0,
          alertsCreated: 0,
        };
      }
    }

    const subs = await SubscriptionModel.find({ is_current: true })
      .populate('member_db_id')
      .lean();

    const templates = (await NotificationTemplateModel.find({ enabled: true }).lean()) as Array<{
      template_key: string;
      channel: 'whatsapp' | 'email';
      days_offset: number | null;
      meta_template_name: string | null;
      subject: string | null;
      body: string;
    }>;

    for (const raw of subs as Array<Record<string, unknown>>) {
      const mem = raw.member_db_id as Record<string, unknown> | null;
      if (!mem || mem.deleted_at) continue;

      const subId = String(raw._id);
      const memberDbId = String(mem._id);
      const memberId = String(mem.member_id);
      const fullName = String(mem.full_name);
      const mobile = String(mem.mobile);
      const email = mem.email ? String(mem.email) : null;
      const optIn = Boolean(mem.whatsapp_opt_in);
      const planName = String(raw.plan_name);
      const expiryDate = String(raw.expiry_date);
      const pendingAmount = Number(raw.pending_amount || 0);
      const statusOverride = raw.status_override ? String(raw.status_override) : null;

      checkedSubscriptions++;
      const state = computeSubscriptionState(
        { expiry_date: expiryDate, pending_amount: pendingAmount, status_override: statusOverride },
        todayIST,
      );
      if (state.status === 'Suspended') continue;

      if (state.daysRemaining === 7 || state.daysRemaining === 3 || state.daysRemaining === 1) {
        const key = `in_app:expiring_${state.daysRemaining}d:${subId}:${expiryDate}`;
        const before = await NotificationModel.findOne({ dedupe_key: key }).lean();
        if (!before) {
          await createInAppAlert(
            'expiring_soon',
            `Expiring in ${state.daysRemaining} day${state.daysRemaining === 1 ? '' : 's'}`,
            `${fullName} (${memberId}) · ${planName} expires on ${expiryDate}.`,
            memberDbId,
            subId,
            key,
          );
          alertsCreated++;
        }
      } else if (state.daysRemaining === 0 || state.daysRemaining === -1) {
        const key = `in_app:expired:${subId}:${expiryDate}`;
        const before = await NotificationModel.findOne({ dedupe_key: key }).lean();
        if (!before) {
          await createInAppAlert(
            'expired',
            state.daysRemaining === 0 ? 'Membership Expires Today' : 'Membership Expired',
            `${fullName} (${memberId}) · ${planName} ended on ${expiryDate}.`,
            memberDbId,
            subId,
            key,
          );
          alertsCreated++;
        }
      }

      if (pendingAmount > 0) {
        const key = `in_app:pending:${subId}:${todayIST}`;
        const before = await NotificationModel.findOne({ dedupe_key: key }).lean();
        if (!before) {
          await createInAppAlert(
            'payment_pending',
            'Pending Payment Due',
            `${fullName} (${memberId}) has INR ${pendingAmount} pending.`,
            memberDbId,
            subId,
            key,
          );
          alertsCreated++;
        }
      }

      for (const tpl of templates) {
        if (tpl.days_offset === null || tpl.days_offset !== state.daysRemaining) continue;
        const dedupeKey = `${tpl.channel}:${tpl.template_key}:${subId}:${expiryDate}`;
        const existing = (await NotificationModel.findOne({ dedupe_key: dedupeKey }).lean()) as
          | { status: string; retry_count: number }
          | null;

        if (
          existing &&
          (existing.status === 'sent' || existing.status === 'delivered' || existing.retry_count >= 2)
        ) {
          continue;
        }

        const msgText = interpolateTemplate(tpl.body, {
          member_name: fullName,
          member_id: memberId,
          expiry_date: expiryDate,
          days_remaining: Math.max(0, state.daysRemaining),
          plan_name: planName,
        });

        if (tpl.channel === 'whatsapp') {
          whatsappAttempted++;
          await sendWhatsAppMessage({
            memberDbId,
            subscriptionId: subId,
            mobile,
            optIn,
            messageBody: msgText,
            metaTemplateName: tpl.meta_template_name,
            templateParams: [fullName, expiryDate, String(Math.max(0, state.daysRemaining))],
            type: tpl.template_key,
            title: `WhatsApp Reminder (${memberId})`,
            dedupeKey,
          });
        } else if (tpl.channel === 'email' && email) {
          emailAttempted++;
          const subject = interpolateTemplate(tpl.subject || 'TITAN X Membership Reminder', {
            member_name: fullName,
            member_id: memberId,
            expiry_date: expiryDate,
            days_remaining: Math.max(0, state.daysRemaining),
            plan_name: planName,
          });
          await sendEmailMessage({
            memberDbId,
            subscriptionId: subId,
            toEmail: email,
            subject,
            bodyText: msgText,
            type: tpl.template_key,
            title: `Email Reminder (${memberId})`,
            dedupeKey,
          });
        }
      }
    }

    const summary = JSON.stringify({
      checkedSubscriptions,
      whatsappAttempted,
      emailAttempted,
      alertsCreated,
    });

    await SchedulerRunModel.updateOne(
      { run_date_ist: todayIST },
      { $set: { status: 'completed', summary, ran_at: new Date() } },
      { upsert: true },
    );

    return {
      ran: true,
      dateIST: todayIST,
      checkedSubscriptions,
      whatsappAttempted,
      emailAttempted,
      alertsCreated,
    };
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  const checkAndRun = async () => {
    if (!isMongoConnected()) return;
    const settings = (await GymSettingsModel.findOne({ singleton_key: 'default' }).lean()) as
      | { reminder_hour_ist?: number }
      | null;
    const targetHour = settings?.reminder_hour_ist ?? 9;
    const nowIST = getNowIST();
    if (nowIST.hour >= targetHour) {
      await runDailyExpiryAndReminderJob(false);
    }
  };

  cronTask = cron.schedule(
    '*/15 * * * *',
    () => {
      void checkAndRun();
    },
    { timezone: 'Asia/Kolkata' },
  );

  setTimeout(() => {
    void checkAndRun();
  }, 3000);
}
