import { Router } from 'express';
import { isMongoConnected } from '../db/mongo.ts';
import {
  ContactInquiryModel,
  GymSettingsModel,
  MembershipPlanModel,
  NotificationModel,
} from '../models/index.ts';
import { createInAppAlert } from '../services/messagingService.ts';

export const publicRouter = Router();

const FALLBACK_SETTINGS = {
  gym_name: 'TITAN X',
  tagline: "Faridabad's Home of Strength",
  contact_number: '9217258251',
  address: 'Faridabad, Haryana, India',
  hours_mon_sat: '5:00 AM – 11:00 PM',
  hours_sun: '2:00 PM – 11:00 PM',
  maps_url: 'https://maps.app.goo.gl/upFL57pZJtMyxCqq8?g_st=ic',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
};

publicRouter.get('/info', async (_req, res) => {
  if (!isMongoConnected()) {
    res.json({ settings: FALLBACK_SETTINGS, plans: [] });
    return;
  }

  const settings = await GymSettingsModel.findOne({ singleton_key: 'default' })
    .select(
      'gym_name tagline contact_number address hours_mon_sat hours_sun maps_url currency timezone social_instagram social_facebook social_youtube',
    )
    .lean();

  const plans = (
    await MembershipPlanModel.find({ deleted_at: null, is_active: true })
      .sort({ duration: 1, price: 1 })
      .lean()
  ).map((p: Record<string, unknown>) => ({
    id: String(p._id),
    name: p.name,
    duration: p.duration,
    duration_unit: p.duration_unit,
    price: p.price,
    description: p.description,
    is_active: p.is_active,
  }));

  res.json({ settings: settings || FALLBACK_SETTINGS, plans });
});

publicRouter.post('/contact', async (req, res) => {
  if (!isMongoConnected()) {
    res.status(503).json({
      error: 'Database is not connected yet. Please configure MONGODB_URI or call +91 9217258251.',
    });
    return;
  }

  const { name, mobile, email, message } = req.body as {
    name?: string;
    mobile?: string;
    email?: string;
    message?: string;
  };

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Please enter your full name.' });
    return;
  }

  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    return;
  }

  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    res.status(400).json({ error: 'Please enter a short message or inquiry.' });
    return;
  }

  const cleanName = name.trim().slice(0, 120);
  const cleanMobile = digits.slice(-10);
  const cleanEmail = email && typeof email === 'string' ? email.trim().slice(0, 160) : null;
  const cleanMsg = message.trim().slice(0, 1000);

  await ContactInquiryModel.create({
    name: cleanName,
    mobile: cleanMobile,
    email: cleanEmail,
    message: cleanMsg,
  });

  await createInAppAlert(
    'new_inquiry',
    'New Website Inquiry',
    `${cleanName} (+91 ${cleanMobile}): ${cleanMsg.slice(0, 90)}`,
  );

  res.status(201).json({ ok: true, message: 'Thank you. Our team at TITAN X will contact you shortly.' });
});

// Meta WhatsApp Cloud API Webhook verification & delivery status tracking
publicRouter.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && expected && token === expected) {
    res.status(200).send(String(challenge || ''));
    return;
  }
  res.sendStatus(403);
});

publicRouter.post('/webhooks/whatsapp', async (req, res) => {
  try {
    if (isMongoConnected()) {
      const body = req.body as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              statuses?: Array<{
                id?: string;
                status?: string;
                errors?: Array<{ message?: string; title?: string }>;
              }>;
            };
          }>;
        }>;
      };

      for (const entry of body?.entry || []) {
        for (const change of entry?.changes || []) {
          for (const st of change?.value?.statuses || []) {
            if (!st.id || !st.status) continue;
            const mappedStatus = ['sent', 'delivered', 'read', 'failed'].includes(st.status)
              ? st.status
              : 'sent';
            const errMsg = st.errors?.[0]?.message || st.errors?.[0]?.title || null;
            await NotificationModel.updateOne(
              { external_message_id: String(st.id) },
              {
                $set: {
                  status: mappedStatus,
                  ...(errMsg ? { error_message: errMsg } : {}),
                },
              },
            );
          }
        }
      }
    }
  } catch {
    // Acknowledge webhook safely
  }
  res.sendStatus(200);
});
