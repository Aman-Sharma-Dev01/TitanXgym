import mongoose from 'mongoose';
import {
  CounterModel,
  DeviceIntegrationModel,
  GymSettingsModel,
  NotificationTemplateModel,
} from '../models/index.ts';

let lastConnectionError: string | null = null;
let seeded = false;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getMongoStatus(): {
  configured: boolean;
  connected: boolean;
  readyState: number;
  error: string | null;
} {
  return {
    configured: Boolean(process.env.MONGODB_URI?.trim()),
    connected: isMongoConnected(),
    readyState: mongoose.connection.readyState,
    error: lastConnectionError,
  };
}

export async function connectMongo(): Promise<boolean> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    lastConnectionError = 'MONGODB_URI environment variable is not set.';
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    lastConnectionError = null;
    if (!seeded) {
      await seedDefaults();
      seeded = true;
    }
    console.log('Connected to MongoDB via Mongoose');
    return true;
  } catch (err) {
    lastConnectionError = err instanceof Error ? err.message : 'Failed to connect to MongoDB';
    console.error('MongoDB connection error:', lastConnectionError);
    return false;
  }
}

async function seedDefaults(): Promise<void> {
  const existingSettings = await GymSettingsModel.findOne({ singleton_key: 'default' }).lean();
  if (!existingSettings) {
    await GymSettingsModel.create({
      singleton_key: 'default',
      gym_name: 'TITAN X',
      tagline: "Faridabad's Home of Strength",
      contact_number: '9217258251',
      address: 'Faridabad, Haryana, India',
      hours_mon_sat: '5:00 AM – 11:00 PM',
      hours_sun: '2:00 PM – 11:00 PM',
      maps_url: 'https://maps.app.goo.gl/upFL57pZJtMyxCqq8?g_st=ic',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      reminder_hour_ist: 9,
      whatsapp_api_version: 'v21.0',
    });
  }

  const defaultTemplates = [
    {
      template_key: 'expiry_7d',
      name: '7 Days Before Expiry',
      channel: 'whatsapp',
      days_offset: 7,
      meta_template_name: 'titanx_expiry_reminder',
      subject: null,
      body: "Hello {{member_name}}!\n\nYour TITAN X gym membership is expiring on {{expiry_date}}.\n\nYou have {{days_remaining}} days remaining.\n\nPlease renew your membership to continue your fitness journey.\n\nThank you,\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_3d',
      name: '3 Days Before Expiry',
      channel: 'whatsapp',
      days_offset: 3,
      meta_template_name: 'titanx_expiry_reminder',
      subject: null,
      body: "Hello {{member_name}}!\n\nYour TITAN X gym membership is expiring on {{expiry_date}}.\n\nYou have {{days_remaining}} days remaining.\n\nPlease renew your membership to continue your fitness journey.\n\nThank you,\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_1d',
      name: '1 Day Before Expiry',
      channel: 'whatsapp',
      days_offset: 1,
      meta_template_name: 'titanx_expiry_reminder',
      subject: null,
      body: "Hello {{member_name}}!\n\nReminder: Your TITAN X gym membership expires tomorrow ({{expiry_date}}).\n\nPlease renew at reception or call 9217258251 to stay uninterrupted.\n\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_0d',
      name: 'On Expiry Date',
      channel: 'whatsapp',
      days_offset: 0,
      meta_template_name: 'titanx_expired_notice',
      subject: null,
      body: "Hello {{member_name}}!\n\nYour TITAN X gym membership expires today ({{expiry_date}}).\n\nRenew your plan today to keep training without interruption.\n\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'renewal_confirmation',
      name: 'Renewal Confirmation',
      channel: 'whatsapp',
      days_offset: null,
      meta_template_name: 'titanx_renewal_confirmation',
      subject: null,
      body: "Hello {{member_name}}!\n\nYour TITAN X membership ({{plan_name}}) has been renewed successfully and is valid until {{expiry_date}}.\n\nKeep training stronger!\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_7d',
      name: '7 Days Before Expiry',
      channel: 'email',
      days_offset: 7,
      meta_template_name: null,
      subject: 'TITAN X Membership Expiring in 7 Days – {{member_id}}',
      body: "Hello {{member_name}},\n\nYour TITAN X ({{plan_name}}) membership is expiring on {{expiry_date}} ({{days_remaining}} days remaining).\n\nPlease renew your membership at the TITAN X reception desk or call +91 9217258251.\n\nThank you,\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_3d',
      name: '3 Days Before Expiry',
      channel: 'email',
      days_offset: 3,
      meta_template_name: null,
      subject: 'TITAN X Membership Expiring in 3 Days – {{member_id}}',
      body: "Hello {{member_name}},\n\nYour TITAN X ({{plan_name}}) membership is expiring on {{expiry_date}} ({{days_remaining}} days remaining).\n\nRenew early to continue your strength training without interruption.\n\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_1d',
      name: '1 Day Before Expiry',
      channel: 'email',
      days_offset: 1,
      meta_template_name: null,
      subject: 'Final Reminder: TITAN X Membership Expires Tomorrow',
      body: "Hello {{member_name}},\n\nYour TITAN X membership expires tomorrow ({{expiry_date}}). Visit reception or call +91 9217258251 to renew.\n\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'expiry_0d',
      name: 'On Expiry Date',
      channel: 'email',
      days_offset: 0,
      meta_template_name: null,
      subject: 'TITAN X Membership Expires Today ({{expiry_date}})',
      body: "Hello {{member_name}},\n\nYour TITAN X membership expires today ({{expiry_date}}). Renew at the front desk to keep your active access.\n\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'renewal_confirmation',
      name: 'Renewal Confirmation',
      channel: 'email',
      days_offset: null,
      meta_template_name: null,
      subject: 'TITAN X Membership Renewed – Valid Until {{expiry_date}}',
      body: "Hello {{member_name}},\n\nThank you for renewing your {{plan_name}} membership at TITAN X.\nYour membership is active through {{expiry_date}}.\n\nSee you on the floor!\nTITAN X – Faridabad's Home of Strength",
    },
    {
      template_key: 'payment_receipt',
      name: 'Payment Receipt',
      channel: 'email',
      days_offset: null,
      meta_template_name: null,
      subject: 'TITAN X Payment Receipt {{receipt_number}}',
      body: "Hello {{member_name}},\n\nWe received your payment of INR {{amount_paid}} on {{payment_date}} (Receipt: {{receipt_number}}).\nPlan: {{plan_name}} | Valid until: {{expiry_date}}.\n\nThank you,\nTITAN X – Faridabad's Home of Strength",
    },
  ];

  for (const t of defaultTemplates) {
    await NotificationTemplateModel.updateOne(
      { template_key: t.template_key, channel: t.channel },
      { $setOnInsert: { ...t, enabled: true } },
      { upsert: true },
    );
  }

  const existingDevice = await DeviceIntegrationModel.findOne().lean();
  if (!existingDevice) {
    await DeviceIntegrationModel.create({
      name: 'Main Entrance Biometric Terminal',
      vendor: 'hikvision',
      protocol: 'ISAPI',
      port: 80,
      is_enabled: false,
      notes: 'Reserved for future Hikvision ISAPI biometric attendance integration (disabled in V1).',
    });
  }
}

export async function generateNextMemberId(): Promise<string> {
  const counter = await CounterModel.findByIdAndUpdate(
    'member_id',
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `TX${String(counter?.seq || 1).padStart(4, '0')}`;
}

export async function generateReceiptNumber(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const counter = await CounterModel.findByIdAndUpdate(
    'receipt_seq',
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const seq = String(counter?.seq || 1).padStart(4, '0');
  return `TXR-${y}${m}${d}-${seq}`;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
