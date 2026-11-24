import mongoose, { Schema } from 'mongoose';

const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'receptionist'], default: 'owner' },
    reset_token_hash: { type: String, default: null },
    reset_expires_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const memberSchema = new Schema(
  {
    member_id: { type: String, required: true, unique: true, index: true },
    full_name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, index: true, trim: true },
    email: { type: String, default: null, trim: true },
    gender: { type: String, default: null },
    dob: { type: String, default: null },
    address: { type: String, default: null },
    photo_url: { type: String, default: null },
    emergency_contact: { type: String, default: null },
    registration_date: { type: String, required: true },
    whatsapp_opt_in: { type: Boolean, default: true },
    notes: { type: String, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const membershipPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    duration: { type: Number, required: true, min: 1 },
    duration_unit: { type: String, enum: ['days', 'months', 'years'], required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const subscriptionSchema = new Schema(
  {
    member_db_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    plan_id: { type: Schema.Types.ObjectId, ref: 'MembershipPlan', default: null },
    plan_name: { type: String, required: true },
    start_date: { type: String, required: true },
    expiry_date: { type: String, required: true, index: true },
    total_fee: { type: Number, required: true, min: 0 },
    amount_paid: { type: Number, default: 0, min: 0 },
    pending_amount: { type: Number, default: 0, min: 0 },
    payment_method: { type: String, default: 'Cash' },
    status_override: { type: String, enum: ['none', 'suspended'], default: 'none' },
    is_current: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const paymentSchema = new Schema(
  {
    member_db_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    subscription_id: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    receipt_number: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0.01 },
    payment_method: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Other'],
      required: true,
    },
    payment_date: { type: String, required: true, index: true },
    reference_id: { type: String, default: null },
    notes: { type: String, default: null },
    created_by: { type: String, default: 'admin' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const attendanceSchema = new Schema(
  {
    member_db_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    attendance_date: { type: String, required: true, index: true },
    check_in_time: { type: String, required: true },
    check_out_time: { type: String, default: null },
    source: { type: String, enum: ['manual', 'biometric_hikvision'], default: 'manual' },
    device_id: { type: Schema.Types.ObjectId, ref: 'DeviceIntegration', default: null },
    notes: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const notificationSchema = new Schema(
  {
    type: { type: String, required: true },
    channel: { type: String, enum: ['in_app', 'whatsapp', 'email'], required: true, index: true },
    member_db_id: { type: Schema.Types.ObjectId, ref: 'Member', default: null, index: true },
    subscription_id: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: 'unread', index: true },
    external_message_id: { type: String, default: null, index: true },
    error_message: { type: String, default: null },
    dedupe_key: { type: String, default: undefined },
    retry_count: { type: Number, default: 0 },
    scheduled_for: { type: String, default: null },
    sent_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
notificationSchema.index({ dedupe_key: 1 }, { unique: true, sparse: true });
notificationSchema.index({ created_at: -1 });

const notificationTemplateSchema = new Schema(
  {
    template_key: { type: String, required: true },
    name: { type: String, required: true },
    channel: { type: String, enum: ['whatsapp', 'email'], required: true },
    enabled: { type: Boolean, default: true },
    days_offset: { type: Number, default: null },
    meta_template_name: { type: String, default: null },
    subject: { type: String, default: null },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
notificationTemplateSchema.index({ template_key: 1, channel: 1 }, { unique: true });

const gymSettingsSchema = new Schema(
  {
    singleton_key: { type: String, default: 'default', unique: true },
    gym_name: { type: String, required: true },
    tagline: { type: String, required: true },
    contact_number: { type: String, required: true },
    address: { type: String, required: true },
    hours_mon_sat: { type: String, required: true },
    hours_sun: { type: String, required: true },
    maps_url: { type: String, required: true },
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    reminder_hour_ist: { type: Number, default: 9 },
    whatsapp_api_version: { type: String, default: 'v21.0' },
    whatsapp_phone_number_id: { type: String, default: null },
    whatsapp_waba_id: { type: String, default: null },
    email_from_name: { type: String, default: "TITAN X – Faridabad's Home of Strength" },
    email_from_address: { type: String, default: null },
    social_instagram: { type: String, default: null },
    social_facebook: { type: String, default: null },
    social_youtube: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const deviceIntegrationSchema = new Schema(
  {
    name: { type: String, required: true },
    vendor: { type: String, default: 'hikvision' },
    protocol: { type: String, default: 'ISAPI' },
    host: { type: String, default: null },
    port: { type: Number, default: 80 },
    is_enabled: { type: Boolean, default: false },
    last_sync_at: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const contactInquirySchema = new Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, default: null },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'resolved'], default: 'new' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const schedulerRunSchema = new Schema({
  run_date_ist: { type: String, required: true, unique: true },
  status: { type: String, required: true },
  summary: { type: String, default: null },
  ran_at: { type: Date, default: Date.now },
});

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const AdminModel = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export const MemberModel = mongoose.models.Member || mongoose.model('Member', memberSchema);
export const MembershipPlanModel =
  mongoose.models.MembershipPlan || mongoose.model('MembershipPlan', membershipPlanSchema);
export const SubscriptionModel =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
export const PaymentModel = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export const AttendanceModel =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
export const NotificationModel =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export const NotificationTemplateModel =
  mongoose.models.NotificationTemplate ||
  mongoose.model('NotificationTemplate', notificationTemplateSchema);
export const GymSettingsModel =
  mongoose.models.GymSettings || mongoose.model('GymSettings', gymSettingsSchema);
export const DeviceIntegrationModel =
  mongoose.models.DeviceIntegration ||
  mongoose.model('DeviceIntegration', deviceIntegrationSchema);
export const ContactInquiryModel =
  mongoose.models.ContactInquiry || mongoose.model('ContactInquiry', contactInquirySchema);
export const SchedulerRunModel =
  mongoose.models.SchedulerRun || mongoose.model('SchedulerRun', schedulerRunSchema);
export const CounterModel = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
