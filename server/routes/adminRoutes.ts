import mongoose from 'mongoose';
import { Router } from 'express';
import {
  connectMongo,
  escapeRegex,
  generateNextMemberId,
  generateReceiptNumber,
  isMongoConnected,
} from '../db/mongo.ts';
import {
  AttendanceModel,
  ContactInquiryModel,
  DeviceIntegrationModel,
  GymSettingsModel,
  MemberModel,
  MembershipPlanModel,
  NotificationModel,
  NotificationTemplateModel,
  PaymentModel,
  SchedulerRunModel,
  SubscriptionModel,
} from '../models/index.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../services/authService.ts';
import {
  buildExportDataset,
  generateCsvString,
  generateXlsxBuffer,
  type ExportType,
} from '../services/exportService.ts';
import {
  buildWhatsAppChatLink,
  createInAppAlert,
  getEmailConfigStatus,
  getWhatsAppConfigStatus,
  interpolateTemplate,
  sendEmailMessage,
  sendWhatsAppMessage,
} from '../services/messagingService.ts';
import { runDailyExpiryAndReminderJob } from '../services/schedulerService.ts';
import { addDuration, computeSubscriptionState, getNowIST, getTodayIST } from '../utils/time.ts';

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(async (_req, res, next) => {
  if (!isMongoConnected() && process.env.MONGODB_URI?.trim()) {
    await connectMongo();
  }
  if (!isMongoConnected()) {
    res.status(503).json({
      error: 'MongoDB is not connected. Configure MONGODB_URI in Secrets or .env.',
    });
    return;
  }
  next();
});

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function getLast6MonthKeys(todayIST: string): string[] {
  const [yStr, mStr] = todayIST.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    let tm = m - i;
    let ty = y;
    while (tm <= 0) {
      tm += 12;
      ty -= 1;
    }
    keys.push(`${ty}-${String(tm).padStart(2, '0')}`);
  }
  return keys;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

// 1. DASHBOARD ANALYTICS & GLOBAL SEARCH
adminRouter.get('/dashboard', async (_req, res) => {
  const todayIST = getTodayIST();
  const members = (await MemberModel.find({ deleted_at: null }).sort({ _id: -1 }).lean()) as Array<
    Record<string, unknown>
  >;
  const currentSubs = (await SubscriptionModel.find({ is_current: true }).lean()) as Array<
    Record<string, unknown>
  >;
  const subMap = new Map(currentSubs.map((s) => [String(s.member_db_id), s]));

  let activeMembers = 0;
  let expiredMembers = 0;
  let expiringSoon = 0;
  let todaysRegistrations = 0;
  const planCounts: Record<string, number> = {};

  for (const m of members) {
    if (String(m.registration_date) === todayIST) todaysRegistrations++;
    const sub = subMap.get(String(m._id));
    if (!sub?.expiry_date) continue;

    const state = computeSubscriptionState(
      {
        expiry_date: String(sub.expiry_date),
        pending_amount: Number(sub.pending_amount || 0),
        status_override: sub.status_override ? String(sub.status_override) : null,
      },
      todayIST,
    );

    if (state.status === 'Active' || state.status === 'Pending Payment') {
      activeMembers++;
    } else if (state.status === 'Expiring Soon') {
      activeMembers++;
      expiringSoon++;
    } else if (state.status === 'Expired') {
      expiredMembers++;
    }

    const pName = String(sub.plan_name || 'Custom');
    planCounts[pName] = (planCounts[pName] || 0) + 1;
  }

  const attendanceDistinct = await AttendanceModel.distinct('member_db_id', {
    attendance_date: todayIST,
  });

  const revAgg = await PaymentModel.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalRevenue = Number(revAgg[0]?.total || 0);

  const activeMemberIds = new Set(members.map((m) => String(m._id)));
  const pendingSubs = (await SubscriptionModel.find({ pending_amount: { $gt: 0 } }).lean()) as Array<
    Record<string, unknown>
  >;
  let pendingPayments = 0;
  for (const s of pendingSubs) {
    if (activeMemberIds.has(String(s.member_db_id))) {
      pendingPayments += Number(s.pending_amount || 0);
    }
  }

  const unreadNotifications = await NotificationModel.countDocuments({
    channel: 'in_app',
    status: 'unread',
  });

  const monthKeys = getLast6MonthKeys(todayIST);
  const revByMonthAgg = await PaymentModel.aggregate([
    {
      $group: {
        _id: { $substr: ['$payment_date', 0, 7] },
        total: { $sum: '$amount' },
      },
    },
  ]);
  const revMap = new Map(revByMonthAgg.map((r) => [String(r._id), Number(r.total || 0)]));

  const regByMonthAgg = await MemberModel.aggregate([
    { $match: { deleted_at: null } },
    {
      $group: {
        _id: { $substr: ['$registration_date', 0, 7] },
        cnt: { $sum: 1 },
      },
    },
  ]);
  const regMap = new Map(regByMonthAgg.map((r) => [String(r._id), Number(r.cnt || 0)]));

  const monthlyRevenue = monthKeys.map((k) => ({
    month: formatMonthLabel(k),
    revenue: revMap.get(k) || 0,
  }));

  const registrationTrend = monthKeys.map((k) => ({
    month: formatMonthLabel(k),
    registrations: regMap.get(k) || 0,
  }));

  const membershipDistribution = Object.entries(planCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const expiredVsActive = [
    { name: 'Active', count: activeMembers },
    { name: 'Expired', count: expiredMembers },
  ];

  const recentPaymentsRaw = (await PaymentModel.find()
    .populate('member_db_id')
    .populate('subscription_id')
    .sort({ payment_date: -1, _id: -1 })
    .limit(6)
    .lean()) as Array<Record<string, unknown>>;

  const recentPayments = recentPaymentsRaw
    .filter((p) => p.member_db_id)
    .map((p) => {
      const mem = p.member_db_id as Record<string, unknown>;
      const sub = p.subscription_id as Record<string, unknown> | null;
      return {
        id: String(p._id),
        receipt_number: String(p.receipt_number),
        amount: Number(p.amount),
        payment_method: String(p.payment_method),
        payment_date: String(p.payment_date),
        member_id: String(mem.member_id),
        full_name: String(mem.full_name),
        plan_name: String(sub?.plan_name || '—'),
      };
    });

  const recentRegistrations = members.slice(0, 6).map((m) => {
    const sub = subMap.get(String(m._id));
    return {
      id: String(m._id),
      member_id: String(m.member_id),
      full_name: String(m.full_name),
      mobile: String(m.mobile),
      registration_date: String(m.registration_date),
      plan_name: String(sub?.plan_name || 'No Plan'),
      status: sub?.expiry_date
        ? computeSubscriptionState(
            {
              expiry_date: String(sub.expiry_date),
              pending_amount: Number(sub.pending_amount || 0),
              status_override: sub.status_override ? String(sub.status_override) : null,
            },
            todayIST,
          ).status
        : 'No Plan',
    };
  });

  res.json({
    kpis: {
      totalMembers: members.length,
      activeMembers,
      expiredMembers,
      expiringSoon,
      todaysRegistrations,
      todaysAttendance: attendanceDistinct.length,
      totalRevenue,
      pendingPayments,
      unreadNotifications,
    },
    charts: {
      monthlyRevenue,
      membershipDistribution,
      registrationTrend,
      expiredVsActive,
    },
    recentPayments,
    recentRegistrations,
  });
});

adminRouter.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ members: [], payments: [] });
    return;
  }
  const regex = new RegExp(escapeRegex(q), 'i');

  const membersRaw = (await MemberModel.find({
    deleted_at: null,
    $or: [{ full_name: regex }, { mobile: regex }, { member_id: regex }],
  })
    .sort({ _id: -1 })
    .limit(8)
    .lean()) as Array<Record<string, unknown>>;

  const members = membersRaw.map((m) => ({
    id: String(m._id),
    member_id: m.member_id,
    full_name: m.full_name,
    mobile: m.mobile,
    email: m.email,
  }));

  const paymentsRaw = (await PaymentModel.find()
    .populate('member_db_id')
    .sort({ _id: -1 })
    .limit(50)
    .lean()) as Array<Record<string, unknown>>;

  const payments = paymentsRaw
    .filter((p) => {
      const mem = p.member_db_id as Record<string, unknown> | null;
      if (!mem) return false;
      return (
        regex.test(String(p.receipt_number)) ||
        regex.test(String(mem.full_name)) ||
        regex.test(String(mem.member_id))
      );
    })
    .slice(0, 5)
    .map((p) => {
      const mem = p.member_db_id as Record<string, unknown>;
      return {
        id: String(p._id),
        receipt_number: p.receipt_number,
        amount: p.amount,
        payment_date: p.payment_date,
        member_id: mem.member_id,
        full_name: mem.full_name,
      };
    });

  res.json({ members, payments });
});

// 2. MEMBERS MANAGEMENT
adminRouter.get('/members', async (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || 'all');
  const todayIST = getTodayIST();

  const members = (await MemberModel.find({ deleted_at: null }).sort({ _id: -1 }).lean()) as Array<
    Record<string, unknown>
  >;
  const currentSubs = (await SubscriptionModel.find({ is_current: true }).lean()) as Array<
    Record<string, unknown>
  >;
  const subMap = new Map(currentSubs.map((s) => [String(s.member_db_id), s]));

  const enriched = members
    .map((m) => {
      const sub = subMap.get(String(m._id));
      const hasSub = Boolean(sub?.expiry_date);
      const state = hasSub
        ? computeSubscriptionState(
            {
              expiry_date: String(sub!.expiry_date),
              pending_amount: Number(sub!.pending_amount || 0),
              status_override: sub!.status_override ? String(sub!.status_override) : null,
            },
            todayIST,
          )
        : { status: 'No Plan' as const, daysRemaining: 0, hasPendingPayment: false };

      return {
        id: String(m._id),
        member_id: String(m.member_id),
        full_name: String(m.full_name),
        mobile: String(m.mobile),
        email: m.email ? String(m.email) : null,
        gender: m.gender ? String(m.gender) : null,
        dob: m.dob ? String(m.dob) : null,
        address: m.address ? String(m.address) : null,
        photo_url: m.photo_url ? String(m.photo_url) : null,
        emergency_contact: m.emergency_contact ? String(m.emergency_contact) : null,
        registration_date: String(m.registration_date),
        whatsapp_opt_in: Boolean(m.whatsapp_opt_in),
        notes: m.notes ? String(m.notes) : null,
        subscription_id: sub ? String(sub._id) : null,
        plan_id: sub?.plan_id ? String(sub.plan_id) : null,
        plan_name: sub?.plan_name ? String(sub.plan_name) : null,
        start_date: sub?.start_date ? String(sub.start_date) : null,
        expiry_date: sub?.expiry_date ? String(sub.expiry_date) : null,
        total_fee: sub?.total_fee !== undefined ? Number(sub.total_fee) : null,
        amount_paid: sub?.amount_paid !== undefined ? Number(sub.amount_paid) : null,
        pending_amount: sub?.pending_amount !== undefined ? Number(sub.pending_amount) : null,
        payment_method: sub?.payment_method ? String(sub.payment_method) : null,
        status_override: sub?.status_override ? String(sub.status_override) : null,
        computed_status: state.status,
        days_remaining: state.daysRemaining,
        has_pending_payment: state.hasPendingPayment,
      };
    })
    .filter((m) => {
      if (search) {
        const hay = `${m.member_id} ${m.full_name} ${m.mobile} ${m.email || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'Pending Payment') return m.has_pending_payment;
        if (m.computed_status !== statusFilter) return false;
      }
      return true;
    });

  res.json({ members: enriched });
});

adminRouter.get('/members/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const member = (await MemberModel.findOne({ _id: id, deleted_at: null }).lean()) as Record<
    string,
    unknown
  > | null;
  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const todayIST = getTodayIST();
  const subsRaw = (await SubscriptionModel.find({ member_db_id: id }).sort({ _id: -1 }).lean()) as Array<
    Record<string, unknown>
  >;
  const subscriptions = subsRaw.map((s) => ({
    id: String(s._id),
    member_db_id: String(s.member_db_id),
    plan_id: s.plan_id ? String(s.plan_id) : null,
    plan_name: s.plan_name,
    start_date: s.start_date,
    expiry_date: s.expiry_date,
    total_fee: s.total_fee,
    amount_paid: s.amount_paid,
    pending_amount: s.pending_amount,
    payment_method: s.payment_method,
    status_override: s.status_override,
    is_current: s.is_current ? 1 : 0,
    notes: s.notes,
    ...computeSubscriptionState(
      {
        expiry_date: String(s.expiry_date),
        pending_amount: Number(s.pending_amount || 0),
        status_override: s.status_override ? String(s.status_override) : null,
      },
      todayIST,
    ),
  }));

  const paymentsRaw = (await PaymentModel.find({ member_db_id: id })
    .populate('subscription_id')
    .sort({ payment_date: -1, _id: -1 })
    .lean()) as Array<Record<string, unknown>>;

  const payments = paymentsRaw.map((p) => {
    const sub = p.subscription_id as Record<string, unknown> | null;
    return {
      id: String(p._id),
      member_db_id: String(p.member_db_id),
      subscription_id: sub ? String(sub._id) : '',
      receipt_number: p.receipt_number,
      amount: p.amount,
      payment_method: p.payment_method,
      payment_date: p.payment_date,
      reference_id: p.reference_id,
      notes: p.notes,
      plan_name: sub?.plan_name || '—',
    };
  });

  const attendanceRaw = (await AttendanceModel.find({ member_db_id: id })
    .sort({ attendance_date: -1, _id: -1 })
    .limit(60)
    .lean()) as Array<Record<string, unknown>>;

  const attendance = attendanceRaw.map((a) => ({
    id: String(a._id),
    member_db_id: String(a.member_db_id),
    attendance_date: a.attendance_date,
    check_in_time: a.check_in_time,
    check_out_time: a.check_out_time,
    source: a.source,
  }));

  const notificationsRaw = (await NotificationModel.find({ member_db_id: id })
    .sort({ created_at: -1 })
    .limit(30)
    .lean()) as Array<Record<string, unknown>>;

  const notifications = notificationsRaw.map((n) => ({
    id: String(n._id),
    type: n.type,
    channel: n.channel,
    title: n.title,
    message: n.message,
    status: n.status,
    external_message_id: n.external_message_id,
    error_message: n.error_message,
    created_at: n.created_at,
  }));

  res.json({
    member: {
      id: String(member._id),
      member_id: member.member_id,
      full_name: member.full_name,
      mobile: member.mobile,
      email: member.email,
      gender: member.gender,
      dob: member.dob,
      address: member.address,
      photo_url: member.photo_url,
      emergency_contact: member.emergency_contact,
      registration_date: member.registration_date,
      whatsapp_opt_in: Boolean(member.whatsapp_opt_in),
      notes: member.notes,
    },
    subscriptions,
    payments,
    attendance,
    notifications,
  });
});

adminRouter.post('/members', async (req: AuthenticatedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const fullName = String(body.full_name || '').trim();
  const rawMobile = String(body.mobile || '').replace(/\D/g, '');
  const cleanMobile = rawMobile.length > 10 ? rawMobile.slice(-10) : rawMobile;

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (cleanMobile.length !== 10) {
    res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
    return;
  }

  const dup = (await MemberModel.findOne({ mobile: cleanMobile, deleted_at: null }).lean()) as {
    member_id: string;
    full_name: string;
  } | null;

  if (dup) {
    res.status(409).json({
      error: `A member with mobile ${cleanMobile} already exists (${dup.member_id} – ${dup.full_name}).`,
    });
    return;
  }

  const todayIST = getTodayIST();
  const registrationDate = String(body.registration_date || todayIST);
  const startDate = String(body.start_date || registrationDate);
  const planIdStr = body.plan_id ? String(body.plan_id) : null;

  let planName = String(body.plan_name || '').trim();
  let expiryDate = String(body.expiry_date || '').trim();
  let totalFee = Number(body.total_fee ?? 0);

  if (planIdStr && isValidObjectId(planIdStr)) {
    const plan = (await MembershipPlanModel.findOne({ _id: planIdStr, deleted_at: null }).lean()) as {
      name: string;
      duration: number;
      duration_unit: 'days' | 'months' | 'years';
      price: number;
    } | null;

    if (!plan) {
      res.status(400).json({ error: 'Selected membership plan not found.' });
      return;
    }
    planName = plan.name;
    if (!expiryDate) {
      expiryDate = addDuration(startDate, plan.duration, plan.duration_unit);
    }
    if (body.total_fee === undefined || body.total_fee === '') {
      totalFee = Number(plan.price);
    }
  }

  if (!planName || !expiryDate) {
    res.status(400).json({ error: 'Please select a membership plan and valid expiry date.' });
    return;
  }

  const amountPaid = Math.max(0, Number(body.amount_paid ?? 0));
  if (Number.isNaN(totalFee) || totalFee < 0 || Number.isNaN(amountPaid) || amountPaid > totalFee) {
    res.status(400).json({ error: 'Amount paid cannot exceed total fee.' });
    return;
  }

  const pendingAmount = Math.max(0, Number((totalFee - amountPaid).toFixed(2)));
  const paymentMethod = ['Cash', 'UPI', 'Bank Transfer', 'Other'].includes(String(body.payment_method))
    ? String(body.payment_method)
    : 'Cash';

  const memberId = await generateNextMemberId();
  const whatsappOptIn = body.whatsapp_opt_in !== false;

  const createdMember = await MemberModel.create({
    member_id: memberId,
    full_name: fullName,
    mobile: cleanMobile,
    email: body.email ? String(body.email).trim() : null,
    gender: body.gender ? String(body.gender).trim() : null,
    dob: body.dob ? String(body.dob).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    photo_url: body.photo_url ? String(body.photo_url).trim() : null,
    emergency_contact: body.emergency_contact ? String(body.emergency_contact).trim() : null,
    registration_date: registrationDate,
    whatsapp_opt_in: whatsappOptIn,
    notes: body.notes ? String(body.notes).trim() : null,
  });

  const createdSub = await SubscriptionModel.create({
    member_db_id: createdMember._id,
    plan_id: planIdStr && isValidObjectId(planIdStr) ? planIdStr : null,
    plan_name: planName,
    start_date: startDate,
    expiry_date: expiryDate,
    total_fee: totalFee,
    amount_paid: amountPaid,
    pending_amount: pendingAmount,
    payment_method: paymentMethod,
    is_current: true,
    notes: body.notes ? String(body.notes).trim() : null,
  });

  if (amountPaid > 0) {
    await PaymentModel.create({
      member_db_id: createdMember._id,
      subscription_id: createdSub._id,
      receipt_number: await generateReceiptNumber(),
      amount: amountPaid,
      payment_method: paymentMethod,
      payment_date: todayIST,
      reference_id: body.reference_id ? String(body.reference_id).trim() : null,
      notes: 'Initial membership payment',
      created_by: req.admin?.email || 'admin',
    });
  }

  await createInAppAlert(
    'new_member',
    'New Member Registered',
    `${fullName} (${memberId}) joined on ${planName}.`,
    String(createdMember._id),
    String(createdSub._id),
  );

  res.status(201).json({
    id: String(createdMember._id),
    member_id: memberId,
    subscription_id: String(createdSub._id),
  });
});

adminRouter.put('/members/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const fullName = String(body.full_name || '').trim();
  const rawMobile = String(body.mobile || '').replace(/\D/g, '');
  const cleanMobile = rawMobile.length > 10 ? rawMobile.slice(-10) : rawMobile;

  if (fullName.length < 2 || cleanMobile.length !== 10) {
    res.status(400).json({ error: 'Valid full name and 10-digit mobile number are required.' });
    return;
  }

  const dup = await MemberModel.findOne({
    mobile: cleanMobile,
    _id: { $ne: id },
    deleted_at: null,
  }).lean();
  if (dup) {
    res.status(409).json({ error: 'Another member already uses this mobile number.' });
    return;
  }

  const updated = await MemberModel.findOneAndUpdate(
    { _id: id, deleted_at: null },
    {
      $set: {
        full_name: fullName,
        mobile: cleanMobile,
        email: body.email ? String(body.email).trim() : null,
        gender: body.gender ? String(body.gender).trim() : null,
        dob: body.dob ? String(body.dob).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        photo_url: body.photo_url ? String(body.photo_url).trim() : null,
        emergency_contact: body.emergency_contact ? String(body.emergency_contact).trim() : null,
        whatsapp_opt_in: body.whatsapp_opt_in !== false,
        notes: body.notes ? String(body.notes).trim() : null,
      },
    },
  );

  if (!updated) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ ok: true });
});

adminRouter.delete('/members/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  const updated = await MemberModel.findOneAndUpdate(
    { _id: id, deleted_at: null },
    { $set: { deleted_at: new Date() } },
  );
  if (!updated) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ ok: true });
});

// 3. MEMBERSHIP PLANS CRUD
adminRouter.get('/plans', async (_req, res) => {
  const plans = (
    await MembershipPlanModel.find({ deleted_at: null }).sort({ duration: 1, _id: -1 }).lean()
  ).map((p: Record<string, unknown>) => ({
    id: String(p._id),
    name: p.name,
    duration: p.duration,
    duration_unit: p.duration_unit,
    price: p.price,
    description: p.description,
    is_active: Boolean(p.is_active),
  }));
  res.json({ plans });
});

adminRouter.post('/plans', async (req, res) => {
  const { name, duration, duration_unit, price, description, is_active } = req.body as {
    name?: string;
    duration?: number;
    duration_unit?: string;
    price?: number;
    description?: string;
    is_active?: boolean;
  };

  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Plan name is required.' });
    return;
  }
  const dur = Number(duration);
  const prc = Number(price);
  if (!Number.isFinite(dur) || dur <= 0) {
    res.status(400).json({ error: 'Duration must be greater than zero.' });
    return;
  }
  if (!['days', 'months', 'years'].includes(String(duration_unit))) {
    res.status(400).json({ error: 'Duration unit must be days, months, or years.' });
    return;
  }
  if (!Number.isFinite(prc) || prc < 0) {
    res.status(400).json({ error: 'Valid plan price is required.' });
    return;
  }

  const created = await MembershipPlanModel.create({
    name: String(name).trim(),
    duration: dur,
    duration_unit: String(duration_unit),
    price: prc,
    description: description ? String(description).trim() : null,
    is_active: is_active !== false,
  });

  res.status(201).json({ id: String(created._id) });
});

adminRouter.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const { name, duration, duration_unit, price, description, is_active } = req.body as {
    name?: string;
    duration?: number;
    duration_unit?: string;
    price?: number;
    description?: string;
    is_active?: boolean;
  };

  if (!name || !String(name).trim() || Number(duration) <= 0 || Number(price) < 0) {
    res.status(400).json({ error: 'Valid plan name, duration, and price are required.' });
    return;
  }

  const updated = await MembershipPlanModel.findOneAndUpdate(
    { _id: id, deleted_at: null },
    {
      $set: {
        name: String(name).trim(),
        duration: Number(duration),
        duration_unit: ['days', 'months', 'years'].includes(String(duration_unit))
          ? String(duration_unit)
          : 'months',
        price: Number(price),
        description: description ? String(description).trim() : null,
        is_active: is_active !== false,
      },
    },
  );

  if (!updated) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  res.json({ ok: true });
});

adminRouter.delete('/plans/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  const updated = await MembershipPlanModel.findOneAndUpdate(
    { _id: id, deleted_at: null },
    { $set: { deleted_at: new Date() } },
  );
  if (!updated) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }
  res.json({ ok: true });
});

// 4. SUBSCRIPTIONS & RENEWAL WORKFLOW
adminRouter.get('/subscriptions', async (req, res) => {
  const todayIST = getTodayIST();
  const statusFilter = String(req.query.status || 'all');
  const planId = req.query.planId ? String(req.query.planId) : '';
  const paymentStatus = String(req.query.paymentStatus || 'all');
  const search = String(req.query.search || '').trim().toLowerCase();
  const expFrom = String(req.query.expFrom || '');
  const expTo = String(req.query.expTo || '');
  const regFrom = String(req.query.regFrom || '');
  const regTo = String(req.query.regTo || '');
  const includeHistory = req.query.history === 'true';

  const query = includeHistory ? {} : { is_current: true };
  const rows = (await SubscriptionModel.find(query)
    .populate('member_db_id')
    .sort({ expiry_date: 1, _id: -1 })
    .lean()) as Array<Record<string, unknown>>;

  const enriched = rows
    .filter((s) => {
      const mem = s.member_db_id as Record<string, unknown> | null;
      return Boolean(mem && !mem.deleted_at);
    })
    .map((s) => {
      const mem = s.member_db_id as Record<string, unknown>;
      const state = computeSubscriptionState(
        {
          expiry_date: String(s.expiry_date),
          pending_amount: Number(s.pending_amount || 0),
          status_override: s.status_override ? String(s.status_override) : null,
        },
        todayIST,
      );
      return {
        id: String(s._id),
        member_db_id: String(mem._id),
        member_id: String(mem.member_id),
        full_name: String(mem.full_name),
        mobile: String(mem.mobile),
        email: mem.email ? String(mem.email) : null,
        registration_date: String(mem.registration_date),
        whatsapp_opt_in: Boolean(mem.whatsapp_opt_in),
        plan_id: s.plan_id ? String(s.plan_id) : null,
        plan_name: String(s.plan_name),
        start_date: String(s.start_date),
        expiry_date: String(s.expiry_date),
        total_fee: Number(s.total_fee || 0),
        amount_paid: Number(s.amount_paid || 0),
        pending_amount: Number(s.pending_amount || 0),
        payment_method: String(s.payment_method),
        status_override: s.status_override ? String(s.status_override) : 'none',
        is_current: s.is_current ? 1 : 0,
        notes: s.notes ? String(s.notes) : null,
        computed_status: state.status,
        days_remaining: state.daysRemaining,
        has_pending_payment: state.hasPendingPayment,
      };
    })
    .filter((s) => {
      if (search) {
        const hay = `${s.member_id} ${s.full_name} ${s.mobile} ${s.plan_name}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (planId && s.plan_id !== planId) return false;
      if (paymentStatus === 'paid' && s.pending_amount > 0) return false;
      if (paymentStatus === 'pending' && s.pending_amount <= 0) return false;
      if (expFrom && s.expiry_date < expFrom) return false;
      if (expTo && s.expiry_date > expTo) return false;
      if (regFrom && s.registration_date < regFrom) return false;
      if (regTo && s.registration_date > regTo) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'Active')
        return s.computed_status === 'Active' || s.computed_status === 'Pending Payment';
      if (statusFilter === 'Expiring Soon') return s.computed_status === 'Expiring Soon';
      if (statusFilter === 'Expiring in 7 Days')
        return s.days_remaining >= 0 && s.days_remaining <= 7 && s.computed_status !== 'Suspended';
      if (statusFilter === 'Expiring in 3 Days')
        return s.days_remaining >= 0 && s.days_remaining <= 3 && s.computed_status !== 'Suspended';
      if (statusFilter === 'Expiring Tomorrow')
        return s.days_remaining === 1 && s.computed_status !== 'Suspended';
      if (statusFilter === 'Expired') return s.computed_status === 'Expired';
      if (statusFilter === 'Pending Payment') return s.has_pending_payment;
      if (statusFilter === 'Suspended') return s.computed_status === 'Suspended';
      return true;
    });

  res.json({ subscriptions: enriched });
});

adminRouter.post('/subscriptions/renew', async (req: AuthenticatedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const memberDbId = String(body.member_db_id || '');
  const planIdStr = body.plan_id ? String(body.plan_id) : null;

  if (!isValidObjectId(memberDbId)) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const member = (await MemberModel.findOne({ _id: memberDbId, deleted_at: null }).lean()) as {
    _id: unknown;
    member_id: string;
    full_name: string;
    mobile: string;
    email: string | null;
    whatsapp_opt_in: boolean;
  } | null;

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const todayIST = getTodayIST();
  const currentSub = (await SubscriptionModel.findOne({
    member_db_id: memberDbId,
    is_current: true,
  })
    .sort({ _id: -1 })
    .lean()) as { expiry_date: string } | null;

  let startDate = String(body.start_date || '').trim();
  if (!startDate) {
    if (currentSub && currentSub.expiry_date >= todayIST) {
      startDate = addDuration(currentSub.expiry_date, 1, 'days');
    } else {
      startDate = todayIST;
    }
  }

  let planName = String(body.plan_name || '').trim();
  let expiryDate = String(body.expiry_date || '').trim();
  let totalFee = Number(body.total_fee ?? 0);

  if (planIdStr && isValidObjectId(planIdStr)) {
    const plan = (await MembershipPlanModel.findOne({ _id: planIdStr, deleted_at: null }).lean()) as {
      name: string;
      duration: number;
      duration_unit: 'days' | 'months' | 'years';
      price: number;
    } | null;

    if (!plan) {
      res.status(400).json({ error: 'Membership plan not found' });
      return;
    }
    planName = plan.name;
    if (!expiryDate) {
      expiryDate = addDuration(startDate, plan.duration, plan.duration_unit);
    }
    if (body.total_fee === undefined || body.total_fee === '') {
      totalFee = Number(plan.price);
    }
  }

  if (!planName || !expiryDate) {
    res.status(400).json({ error: 'Membership plan and expiry date are required.' });
    return;
  }

  const amountPaid = Math.max(0, Number(body.amount_paid ?? 0));
  if (amountPaid > totalFee) {
    res.status(400).json({ error: 'Amount paid cannot exceed total fee.' });
    return;
  }
  const pendingAmount = Math.max(0, Number((totalFee - amountPaid).toFixed(2)));
  const paymentMethod = ['Cash', 'UPI', 'Bank Transfer', 'Other'].includes(String(body.payment_method))
    ? String(body.payment_method)
    : 'Cash';

  await SubscriptionModel.updateMany(
    { member_db_id: memberDbId, is_current: true },
    { $set: { is_current: false } },
  );

  const newSub = await SubscriptionModel.create({
    member_db_id: memberDbId,
    plan_id: planIdStr && isValidObjectId(planIdStr) ? planIdStr : null,
    plan_name: planName,
    start_date: startDate,
    expiry_date: expiryDate,
    total_fee: totalFee,
    amount_paid: amountPaid,
    pending_amount: pendingAmount,
    payment_method: paymentMethod,
    is_current: true,
    notes: body.notes ? String(body.notes).trim() : null,
  });

  const newSubId = String(newSub._id);
  let receiptNo: string | null = null;

  if (amountPaid > 0) {
    receiptNo = await generateReceiptNumber();
    await PaymentModel.create({
      member_db_id: memberDbId,
      subscription_id: newSub._id,
      receipt_number: receiptNo,
      amount: amountPaid,
      payment_method: paymentMethod,
      payment_date: todayIST,
      reference_id: body.reference_id ? String(body.reference_id).trim() : null,
      notes: `Renewal payment for ${planName}`,
      created_by: req.admin?.email || 'admin',
    });
  }

  await createInAppAlert(
    'subscription_renewed',
    'Subscription Renewed',
    `${member.full_name} (${member.member_id}) renewed ${planName} until ${expiryDate}.`,
    memberDbId,
    newSubId,
  );

  const waTpl = (await NotificationTemplateModel.findOne({
    template_key: 'renewal_confirmation',
    channel: 'whatsapp',
    enabled: true,
  }).lean()) as { meta_template_name: string | null; body: string } | null;

  if (waTpl && (await getWhatsAppConfigStatus()).configured && member.whatsapp_opt_in) {
    const msg = interpolateTemplate(waTpl.body, {
      member_name: member.full_name,
      member_id: member.member_id,
      plan_name: planName,
      expiry_date: expiryDate,
    });
    void sendWhatsAppMessage({
      memberDbId,
      subscriptionId: newSubId,
      mobile: member.mobile,
      optIn: true,
      messageBody: msg,
      metaTemplateName: waTpl.meta_template_name,
      templateParams: [member.full_name, planName, expiryDate],
      type: 'renewal_confirmation',
      title: `Renewal Confirmation (${member.member_id})`,
      dedupeKey: `whatsapp:renewal_confirmation:${newSubId}`,
    });
  }

  const emailTpl = (await NotificationTemplateModel.findOne({
    template_key: 'renewal_confirmation',
    channel: 'email',
    enabled: true,
  }).lean()) as { subject: string | null; body: string } | null;

  if (emailTpl && (await getEmailConfigStatus()).configured && member.email) {
    const bodyText = interpolateTemplate(emailTpl.body, {
      member_name: member.full_name,
      member_id: member.member_id,
      plan_name: planName,
      expiry_date: expiryDate,
    });
    const subject = interpolateTemplate(emailTpl.subject || 'TITAN X Membership Renewed', {
      member_name: member.full_name,
      member_id: member.member_id,
      plan_name: planName,
      expiry_date: expiryDate,
    });
    void sendEmailMessage({
      memberDbId,
      subscriptionId: newSubId,
      toEmail: member.email,
      subject,
      bodyText,
      type: 'renewal_confirmation',
      title: `Renewal Email (${member.member_id})`,
      dedupeKey: `email:renewal_confirmation:${newSubId}`,
    });
  }

  res.status(201).json({ ok: true, subscription_id: newSubId, receipt_number: receiptNo });
});

adminRouter.put('/subscriptions/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const existing = await SubscriptionModel.findById(id);
  if (!existing) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const { start_date, expiry_date, total_fee, status_override, notes } = req.body as {
    start_date?: string;
    expiry_date?: string;
    total_fee?: number;
    status_override?: string;
    notes?: string;
  };

  const fee = Number(total_fee);
  if (!start_date || !expiry_date || Number.isNaN(fee) || fee < existing.amount_paid) {
    res.status(400).json({ error: 'Valid dates and total fee (>= amount already paid) are required.' });
    return;
  }

  existing.start_date = String(start_date);
  existing.expiry_date = String(expiry_date);
  existing.total_fee = fee;
  existing.pending_amount = Math.max(0, Number((fee - existing.amount_paid).toFixed(2)));
  existing.status_override = status_override === 'suspended' ? 'suspended' : 'none';
  existing.notes = notes ? String(notes) : null;
  await existing.save();

  res.json({ ok: true });
});

// 5. PAYMENT MANAGEMENT
adminRouter.get('/payments', async (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const method = String(req.query.method || 'all');
  const fromDate = String(req.query.fromDate || '');
  const toDate = String(req.query.toDate || '');
  const minAmount = req.query.minAmount ? Number(req.query.minAmount) : null;
  const maxAmount = req.query.maxAmount ? Number(req.query.maxAmount) : null;

  const rows = (await PaymentModel.find()
    .populate('member_db_id')
    .populate('subscription_id')
    .sort({ payment_date: -1, _id: -1 })
    .lean()) as Array<Record<string, unknown>>;

  const mapped = rows
    .filter((p) => p.member_db_id)
    .map((p) => {
      const mem = p.member_db_id as Record<string, unknown>;
      const sub = p.subscription_id as Record<string, unknown> | null;
      return {
        id: String(p._id),
        member_db_id: String(mem._id),
        subscription_id: sub ? String(sub._id) : '',
        receipt_number: String(p.receipt_number),
        amount: Number(p.amount),
        payment_method: String(p.payment_method),
        payment_date: String(p.payment_date),
        reference_id: p.reference_id ? String(p.reference_id) : null,
        notes: p.notes ? String(p.notes) : null,
        member_id: String(mem.member_id),
        full_name: String(mem.full_name),
        mobile: String(mem.mobile),
        email: mem.email ? String(mem.email) : null,
        plan_name: String(sub?.plan_name || '—'),
      };
    });

  const filtered = mapped.filter((p) => {
    if (search) {
      const hay = `${p.receipt_number} ${p.member_id} ${p.full_name} ${p.mobile} ${p.reference_id || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (method !== 'all' && p.payment_method !== method) return false;
    if (fromDate && p.payment_date < fromDate) return false;
    if (toDate && p.payment_date > toDate) return false;
    if (minAmount !== null && p.amount < minAmount) return false;
    if (maxAmount !== null && p.amount > maxAmount) return false;
    return true;
  });

  const todayIST = getTodayIST();
  const monthPrefix = todayIST.slice(0, 7);
  let todayCollection = 0;
  let monthCollection = 0;
  let filteredTotal = 0;

  for (const p of mapped) {
    if (p.payment_date === todayIST) todayCollection += p.amount;
    if (p.payment_date.startsWith(monthPrefix)) monthCollection += p.amount;
  }
  for (const p of filtered) {
    filteredTotal += p.amount;
  }

  res.json({
    payments: filtered,
    summary: { todayCollection, monthCollection, filteredTotal },
  });
});

adminRouter.post('/payments', async (req: AuthenticatedRequest, res) => {
  const { subscription_id, amount, payment_method, payment_date, reference_id, notes, send_receipt } =
    req.body as {
      subscription_id?: string;
      amount?: number;
      payment_method?: string;
      payment_date?: string;
      reference_id?: string;
      notes?: string;
      send_receipt?: boolean;
    };

  if (!subscription_id || !isValidObjectId(String(subscription_id))) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const sub = await SubscriptionModel.findById(String(subscription_id)).populate('member_db_id');
  const mem = sub?.member_db_id as unknown as {
    _id: unknown;
    member_id: string;
    full_name: string;
    email: string | null;
    deleted_at: Date | null;
  } | null;

  if (!sub || !mem || mem.deleted_at) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    return;
  }
  if (amt > sub.pending_amount + 0.01) {
    res.status(400).json({ error: `Payment exceeds pending balance of INR ${sub.pending_amount}.` });
    return;
  }

  const safeMethod = ['Cash', 'UPI', 'Bank Transfer', 'Other'].includes(String(payment_method))
    ? String(payment_method)
    : 'Cash';
  const payDate = payment_date || getTodayIST();
  const receiptNumber = await generateReceiptNumber();

  const newPaid = Number((sub.amount_paid + amt).toFixed(2));
  const newPending = Math.max(0, Number((sub.total_fee - newPaid).toFixed(2)));

  const createdPayment = await PaymentModel.create({
    member_db_id: mem._id,
    subscription_id: sub._id,
    receipt_number: receiptNumber,
    amount: amt,
    payment_method: safeMethod,
    payment_date: payDate,
    reference_id: reference_id?.trim() || null,
    notes: notes?.trim() || null,
    created_by: req.admin?.email || 'admin',
  });

  sub.amount_paid = newPaid;
  sub.pending_amount = newPending;
  await sub.save();

  if (send_receipt && mem.email && (await getEmailConfigStatus()).configured) {
    const tpl = (await NotificationTemplateModel.findOne({
      template_key: 'payment_receipt',
      channel: 'email',
    }).lean()) as { subject: string | null; body: string } | null;

    if (tpl) {
      const bodyText = interpolateTemplate(tpl.body, {
        member_name: mem.full_name,
        member_id: mem.member_id,
        plan_name: sub.plan_name,
        expiry_date: sub.expiry_date,
        amount_paid: amt,
        payment_date: payDate,
        receipt_number: receiptNumber,
      });
      const subject = interpolateTemplate(tpl.subject || 'TITAN X Payment Receipt', {
        member_name: mem.full_name,
        receipt_number: receiptNumber,
      });
      void sendEmailMessage({
        memberDbId: String(mem._id),
        subscriptionId: String(sub._id),
        toEmail: mem.email,
        subject,
        bodyText,
        type: 'payment_receipt',
        title: `Payment Receipt ${receiptNumber}`,
      });
    }
  }

  res.status(201).json({
    id: String(createdPayment._id),
    receipt_number: receiptNumber,
    pending_amount: newPending,
  });
});

// 6. ATTENDANCE MANAGEMENT (Manual V1, Biometric-ready architecture)
adminRouter.get('/attendance', async (req, res) => {
  const date = String(req.query.date || getTodayIST());
  const search = String(req.query.search || '').trim().toLowerCase();
  const todayIST = getTodayIST();

  const records = (await AttendanceModel.find({ attendance_date: date })
    .populate('member_db_id')
    .sort({ _id: -1 })
    .lean()) as Array<Record<string, unknown>>;

  const memberIds = records
    .map((r) => (r.member_db_id as Record<string, unknown> | null)?._id)
    .filter(Boolean);

  const subs = (await SubscriptionModel.find({
    member_db_id: { $in: memberIds },
    is_current: true,
  }).lean()) as Array<Record<string, unknown>>;
  const subMap = new Map(subs.map((s) => [String(s.member_db_id), s]));

  const enriched = records
    .filter((r) => r.member_db_id)
    .map((r) => {
      const mem = r.member_db_id as Record<string, unknown>;
      const sub = subMap.get(String(mem._id));
      return {
        id: String(r._id),
        member_db_id: String(mem._id),
        member_id: String(mem.member_id),
        full_name: String(mem.full_name),
        mobile: String(mem.mobile),
        attendance_date: String(r.attendance_date),
        check_in_time: String(r.check_in_time),
        check_out_time: r.check_out_time ? String(r.check_out_time) : null,
        source: String(r.source),
        plan_name: sub?.plan_name ? String(sub.plan_name) : null,
        subscription_status: sub?.expiry_date
          ? computeSubscriptionState(
              {
                expiry_date: String(sub.expiry_date),
                pending_amount: Number(sub.pending_amount || 0),
                status_override: sub.status_override ? String(sub.status_override) : null,
              },
              todayIST,
            ).status
          : 'No Plan',
      };
    })
    .filter((r) => {
      if (!search) return true;
      return `${r.member_id} ${r.full_name} ${r.mobile}`.toLowerCase().includes(search);
    });

  const devices = (await DeviceIntegrationModel.find().lean()).map((d: Record<string, unknown>) => ({
    id: String(d._id),
    name: d.name,
    vendor: d.vendor,
    protocol: d.protocol,
    is_enabled: d.is_enabled ? 1 : 0,
    notes: d.notes,
  }));

  res.json({ date, records: enriched, devices });
});

adminRouter.post('/attendance/check-in', async (req, res) => {
  const { member_db_id, notes } = req.body as { member_db_id?: string; notes?: string };
  if (!member_db_id || !isValidObjectId(String(member_db_id))) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const member = (await MemberModel.findOne({ _id: String(member_db_id), deleted_at: null }).lean()) as {
    _id: unknown;
    member_id: string;
    full_name: string;
  } | null;

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const now = getNowIST();
  const existingToday = (await AttendanceModel.findOne({
    member_db_id: member._id,
    attendance_date: now.date,
  }).lean()) as { check_in_time: string } | null;

  if (existingToday) {
    res.status(409).json({
      error: `${member.full_name} (${member.member_id}) is already checked in today at ${existingToday.check_in_time}.`,
    });
    return;
  }

  const created = await AttendanceModel.create({
    member_db_id: member._id,
    attendance_date: now.date,
    check_in_time: now.time,
    source: 'manual',
    notes: notes?.trim() || null,
  });

  res.status(201).json({
    id: String(created._id),
    attendance_date: now.date,
    check_in_time: now.time,
  });
});

adminRouter.post('/attendance/check-out', async (req, res) => {
  const { attendance_id } = req.body as { attendance_id?: string };
  if (!attendance_id || !isValidObjectId(String(attendance_id))) {
    res.status(404).json({ error: 'Attendance record not found' });
    return;
  }

  const row = await AttendanceModel.findById(String(attendance_id));
  if (!row) {
    res.status(404).json({ error: 'Attendance record not found' });
    return;
  }
  if (row.check_out_time) {
    res.status(409).json({ error: 'Member has already checked out.' });
    return;
  }

  const now = getNowIST();
  row.check_out_time = now.time;
  await row.save();
  res.json({ ok: true, check_out_time: now.time });
});

// 7. NOTIFICATIONS, REMINDERS & INTEGRATIONS
adminRouter.get('/notifications', async (req, res) => {
  const channel = String(req.query.channel || 'all');
  const status = String(req.query.status || 'all');

  const query: Record<string, unknown> = {};
  if (channel !== 'all') query.channel = channel;
  if (status !== 'all') query.status = status;

  const rows = (await NotificationModel.find(query)
    .populate('member_db_id')
    .sort({ created_at: -1, _id: -1 })
    .limit(200)
    .lean()) as Array<Record<string, unknown>>;

  const notifications = rows.map((n) => {
    const mem = n.member_db_id as Record<string, unknown> | null;
    return {
      id: String(n._id),
      type: n.type,
      channel: n.channel,
      member_db_id: mem ? String(mem._id) : null,
      member_id: mem ? String(mem.member_id) : null,
      full_name: mem ? String(mem.full_name) : null,
      mobile: mem ? String(mem.mobile) : null,
      title: n.title,
      message: n.message,
      status: n.status,
      external_message_id: n.external_message_id,
      error_message: n.error_message,
      retry_count: n.retry_count,
      sent_at: n.sent_at,
      created_at: n.created_at,
    };
  });

  res.json({
    notifications,
    whatsappStatus: await getWhatsAppConfigStatus(),
    emailStatus: await getEmailConfigStatus(),
  });
});

adminRouter.post('/notifications/mark-read', async (req, res) => {
  const { id, all } = req.body as { id?: string; all?: boolean };
  if (all) {
    await NotificationModel.updateMany(
      { channel: 'in_app', status: 'unread' },
      { $set: { status: 'read' } },
    );
  } else if (id && isValidObjectId(String(id))) {
    await NotificationModel.updateOne(
      { _id: String(id), channel: 'in_app' },
      { $set: { status: 'read' } },
    );
  }
  res.json({ ok: true });
});

adminRouter.get('/templates', async (_req, res) => {
  const rows = (await NotificationTemplateModel.find()
    .sort({ channel: 1, _id: 1 })
    .lean()) as Array<Record<string, unknown>>;
  res.json({
    templates: rows.map((t) => ({
      id: String(t._id),
      template_key: t.template_key,
      name: t.name,
      channel: t.channel,
      enabled: Boolean(t.enabled),
      days_offset: t.days_offset,
      meta_template_name: t.meta_template_name,
      subject: t.subject,
      body: t.body,
    })),
  });
});

adminRouter.put('/templates/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const { enabled, meta_template_name, subject, body } = req.body as {
    enabled?: boolean;
    meta_template_name?: string;
    subject?: string;
    body?: string;
  };
  if (!body || !String(body).trim()) {
    res.status(400).json({ error: 'Template message body is required.' });
    return;
  }

  await NotificationTemplateModel.updateOne(
    { _id: id },
    {
      $set: {
        enabled: enabled !== false,
        meta_template_name: meta_template_name?.trim() || null,
        subject: subject?.trim() || null,
        body: String(body).trim(),
      },
    },
  );
  res.json({ ok: true });
});

adminRouter.post('/reminders/manual', async (req, res) => {
  const { member_db_id, channel, custom_message } = req.body as {
    member_db_id?: string;
    channel?: 'whatsapp' | 'email';
    custom_message?: string;
  };

  if (!member_db_id || !isValidObjectId(String(member_db_id))) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const member = (await MemberModel.findOne({ _id: String(member_db_id), deleted_at: null }).lean()) as {
    _id: unknown;
    member_id: string;
    full_name: string;
    mobile: string;
    email: string | null;
    whatsapp_opt_in: boolean;
  } | null;

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const currentSub = (await SubscriptionModel.findOne({
    member_db_id: member._id,
    is_current: true,
  }).lean()) as { _id: unknown; plan_name: string; expiry_date: string } | null;

  const todayIST = getTodayIST();
  const state = currentSub?.expiry_date
    ? computeSubscriptionState({ expiry_date: currentSub.expiry_date, pending_amount: 0 }, todayIST)
    : { daysRemaining: 0 };

  const defaultMsg =
    custom_message?.trim() ||
    `Hello ${member.full_name}!\n\nThis is a reminder from TITAN X regarding your ${
      currentSub?.plan_name || 'gym'
    } membership${
      currentSub?.expiry_date ? ` (valid until ${currentSub.expiry_date})` : ''
    }.\n\nPlease contact us at 9217258251 for assistance.\n\nTITAN X – Faridabad's Home of Strength`;

  if (channel === 'email') {
    const result = await sendEmailMessage({
      memberDbId: String(member._id),
      subscriptionId: currentSub ? String(currentSub._id) : null,
      toEmail: member.email,
      subject: `TITAN X Membership Update – ${member.member_id}`,
      bodyText: defaultMsg,
      type: 'manual_reminder',
      title: `Manual Email (${member.member_id})`,
    });
    res.status(result.ok ? 200 : 400).json(result);
    return;
  }

  const waLink = buildWhatsAppChatLink(member.mobile, defaultMsg);
  const result = await sendWhatsAppMessage({
    memberDbId: String(member._id),
    subscriptionId: currentSub ? String(currentSub._id) : null,
    mobile: member.mobile,
    optIn: Boolean(member.whatsapp_opt_in),
    messageBody: defaultMsg,
    type: 'manual_reminder',
    title: `Manual WhatsApp (${member.member_id})`,
    templateParams: [
      member.full_name,
      currentSub?.expiry_date || todayIST,
      String(Math.max(0, state.daysRemaining)),
    ],
  });

  res.status(result.ok ? 200 : 400).json({ ...result, waLink });
});

adminRouter.post('/reminders/run-daily', async (_req, res) => {
  const result = await runDailyExpiryAndReminderJob(true);
  res.json(result);
});

adminRouter.post('/integrations/whatsapp/test', async (req, res) => {
  const { mobile } = req.body as { mobile?: string };
  if (!mobile || String(mobile).replace(/\D/g, '').length < 10) {
    res.status(400).json({ error: 'Enter a valid 10-digit recipient mobile number for test delivery.' });
    return;
  }
  const result = await sendWhatsAppMessage({
    mobile: String(mobile),
    optIn: true,
    messageBody: 'TITAN X Test Message: WhatsApp Cloud API integration is active.',
    type: 'integration_test',
    title: 'WhatsApp Integration Test',
  });
  res.status(result.ok ? 200 : 400).json(result);
});

adminRouter.post('/integrations/email/test', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !String(email).includes('@')) {
    res.status(400).json({ error: 'Enter a valid recipient email address.' });
    return;
  }
  const result = await sendEmailMessage({
    toEmail: String(email),
    subject: 'TITAN X Email Integration Test',
    bodyText: "This is a live test message from TITAN X – Faridabad's Home of Strength.",
    type: 'integration_test',
    title: 'Email Integration Test',
  });
  res.status(result.ok ? 200 : 400).json(result);
});

// 8. REPORTS & EXPORTS
adminRouter.get('/exports/preview', async (req, res) => {
  const type = String(req.query.type || 'all_members') as ExportType;
  const dataset = await buildExportDataset(type, {
    startDate: req.query.startDate ? String(req.query.startDate) : undefined,
    endDate: req.query.endDate ? String(req.query.endDate) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
  });
  res.json({
    sheetName: dataset.sheetName,
    columns: dataset.columns,
    totalRows: dataset.rows.length,
    previewRows: dataset.rows.slice(0, 50),
  });
});

adminRouter.get('/exports/download', async (req, res) => {
  const type = String(req.query.type || 'all_members') as ExportType;
  const format = String(req.query.format || 'xlsx');
  const dataset = await buildExportDataset(type, {
    startDate: req.query.startDate ? String(req.query.startDate) : undefined,
    endDate: req.query.endDate ? String(req.query.endDate) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
  });

  const dateTag = getTodayIST();

  if (format === 'csv') {
    const csv = generateCsvString(dataset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dataset.filenamePrefix}_${dateTag}.csv"`);
    res.send(csv);
    return;
  }

  const buffer = await generateXlsxBuffer(dataset);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${dataset.filenamePrefix}_${dateTag}.xlsx"`);
  res.send(buffer);
});

// 9. SETTINGS & WEBSITE INQUIRIES
adminRouter.get('/settings', async (_req, res) => {
  const settings = await GymSettingsModel.findOne({ singleton_key: 'default' }).lean();
  const devices = await DeviceIntegrationModel.find().lean();
  const inquiries = (await ContactInquiryModel.find().sort({ created_at: -1 }).limit(50).lean()).map(
    (i: Record<string, unknown>) => ({ ...i, id: String(i._id) }),
  );
  const schedulerRuns = await SchedulerRunModel.find().sort({ run_date_ist: -1 }).limit(10).lean();

  res.json({
    settings,
    devices,
    inquiries,
    schedulerRuns,
    whatsappStatus: await getWhatsAppConfigStatus(),
    emailStatus: await getEmailConfigStatus(),
  });
});

adminRouter.put('/settings', requireRole('owner'), async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (b.gym_name) update.gym_name = String(b.gym_name).trim();
  if (b.tagline) update.tagline = String(b.tagline).trim();
  if (b.contact_number) update.contact_number = String(b.contact_number).trim();
  if (b.address) update.address = String(b.address).trim();
  if (b.hours_mon_sat) update.hours_mon_sat = String(b.hours_mon_sat).trim();
  if (b.hours_sun) update.hours_sun = String(b.hours_sun).trim();
  if (b.maps_url) update.maps_url = String(b.maps_url).trim();
  if (b.reminder_hour_ist !== undefined) {
    update.reminder_hour_ist = Math.min(23, Math.max(0, Number(b.reminder_hour_ist)));
  }
  if (b.whatsapp_api_version) update.whatsapp_api_version = String(b.whatsapp_api_version).trim();
  update.whatsapp_phone_number_id = b.whatsapp_phone_number_id
    ? String(b.whatsapp_phone_number_id).trim()
    : null;
  update.whatsapp_waba_id = b.whatsapp_waba_id ? String(b.whatsapp_waba_id).trim() : null;
  if (b.email_from_name) update.email_from_name = String(b.email_from_name).trim();
  update.email_from_address = b.email_from_address ? String(b.email_from_address).trim() : null;
  update.social_instagram = b.social_instagram ? String(b.social_instagram).trim() : null;
  update.social_facebook = b.social_facebook ? String(b.social_facebook).trim() : null;
  update.social_youtube = b.social_youtube ? String(b.social_youtube).trim() : null;

  await GymSettingsModel.updateOne({ singleton_key: 'default' }, { $set: update }, { upsert: true });
  res.json({ ok: true });
});

adminRouter.put('/inquiries/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  const status = req.body?.status === 'resolved' ? 'resolved' : 'new';
  await ContactInquiryModel.updateOne({ _id: id }, { $set: { status } });
  res.json({ ok: true });
});
