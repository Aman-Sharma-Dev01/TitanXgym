export interface GymSettings {
  id?: string;
  gym_name: string;
  tagline: string;
  contact_number: string;
  address: string;
  hours_mon_sat: string;
  hours_sun: string;
  maps_url: string;
  currency: string;
  timezone: string;
  reminder_hour_ist?: number;
  whatsapp_api_version?: string;
  whatsapp_phone_number_id?: string | null;
  whatsapp_waba_id?: string | null;
  email_from_name?: string;
  email_from_address?: string | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  social_youtube?: string | null;
}

export interface MembershipPlan {
  id: string;
  name: string;
  duration: number;
  duration_unit: 'days' | 'months' | 'years';
  price: number;
  description: string | null;
  is_active: boolean;
}

export type ComputedSubStatus =
  | 'Active'
  | 'Expiring Soon'
  | 'Expired'
  | 'Pending Payment'
  | 'Suspended'
  | 'No Plan';

export interface MemberRecord {
  id: string;
  member_id: string;
  full_name: string;
  mobile: string;
  email: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  photo_url: string | null;
  emergency_contact: string | null;
  registration_date: string;
  whatsapp_opt_in: boolean;
  notes: string | null;
  subscription_id?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  start_date?: string | null;
  expiry_date?: string | null;
  total_fee?: number | null;
  amount_paid?: number | null;
  pending_amount?: number | null;
  payment_method?: string | null;
  status_override?: string | null;
  computed_status?: ComputedSubStatus;
  days_remaining?: number;
  has_pending_payment?: boolean;
}

export interface SubscriptionRecord {
  id: string;
  member_db_id: string;
  member_id: string;
  full_name: string;
  mobile: string;
  email: string | null;
  registration_date: string;
  whatsapp_opt_in: boolean;
  plan_id: string | null;
  plan_name: string;
  start_date: string;
  expiry_date: string;
  total_fee: number;
  amount_paid: number;
  pending_amount: number;
  payment_method: string;
  status_override: string | null;
  is_current: number;
  notes: string | null;
  computed_status: ComputedSubStatus;
  days_remaining: number;
  has_pending_payment: boolean;
}

export interface PaymentRecord {
  id: string;
  member_db_id: string;
  subscription_id: string;
  receipt_number: string;
  amount: number;
  payment_method: 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';
  payment_date: string;
  reference_id: string | null;
  notes: string | null;
  member_id: string;
  full_name: string;
  mobile: string;
  email?: string | null;
  plan_name: string;
  total_fee?: number;
  pending_amount?: number;
}

export interface NotificationRecord {
  id: string;
  type: string;
  channel: 'in_app' | 'whatsapp' | 'email';
  member_db_id: string | null;
  subscription_id: string | null;
  member_id?: string | null;
  full_name?: string | null;
  mobile?: string | null;
  title: string;
  message: string;
  status: string;
  external_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  template_key: string;
  name: string;
  channel: 'whatsapp' | 'email';
  enabled: boolean;
  days_offset: number | null;
  meta_template_name: string | null;
  subject: string | null;
  body: string;
}

export interface DashboardPayload {
  kpis: {
    totalMembers: number;
    activeMembers: number;
    expiredMembers: number;
    expiringSoon: number;
    todaysRegistrations: number;
    totalRevenue: number;
    pendingPayments: number;
    unreadNotifications: number;
  };
  charts: {
    monthlyRevenue: Array<{ month: string; revenue: number }>;
    membershipDistribution: Array<{ name: string; value: number }>;
    registrationTrend: Array<{ month: string; registrations: number }>;
    expiredVsActive: Array<{ name: string; count: number }>;
  };
  recentPayments: Array<{
    id: string;
    receipt_number: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    member_id: string;
    full_name: string;
    plan_name: string;
  }>;
  recentRegistrations: Array<{
    id: string;
    member_id: string;
    full_name: string;
    mobile: string;
    registration_date: string;
    plan_name: string;
    status: ComputedSubStatus;
  }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'receptionist';
}
