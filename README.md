# TITAN X – Gym Membership & Subscription Management System

Full-stack web application and PWA for **TITAN X – Faridabad's Home of Strength** (Powerbuilding Gym).

## Features

- **Public Gym Landing Page**: Responsive dark athletic landing page with dynamic admin-configured membership plans, opening hours, Google Maps directions, WhatsApp/call links, and persisted inquiry form.
- **Admin Authentication & RBAC**: First-run owner setup claim (or `ADMIN_EMAIL` / `ADMIN_PASSWORD` env override), bcrypt password hashing, JWT session persistence, forgot/reset password flow, and role support for `owner` and `receptionist`.
- **Dashboard Analytics**: Real-time KPIs and Recharts visualizations calculated strictly from database records.
- **Member & Subscription Lifecycle**: Auto-generated `TX0001` IDs, duplicate mobile validation, unlimited configurable membership plans, date-driven subscription statuses (`Active`, `Expiring Soon`, `Expired`, `Pending Payment`, `Suspended`), and full renewal workflow preserving historical records.
- **Payments & Receipts**: Full and partial manual payment recording (Cash, UPI, Bank Transfer, Other), automatic outstanding dues tracking, and downloadable/printable receipts.
- **Manual Attendance (Biometric-Ready V1)**: Check-in/check-out with duplicate protection and `device_integrations` schema ready for future Hikvision ISAPI terminals.
- **Automated Reminders & Notifications**: Daily `Asia/Kolkata` scheduler (default 9:00 AM IST) with missed-run recovery, Meta WhatsApp Business Cloud API integration, webhook status tracking, `wa.me` fallback links, and Resend email delivery.
- **Excel & CSV Exports**: Filtered `.xlsx` (ExcelJS) and `.csv` downloads across all 10 report datasets.
- **Installable PWA**: Web App Manifest, Workbox service worker, offline indicator, and in-app install button.

## Installation & Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure any optional secrets:
   ```bash
   cp .env.example .env
   ```
3. Run the development server (Express API + Vite on port 3000):
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `PORT` | Server port (defaults to `3000`) |
| `JWT_SECRET` | Secret for signing admin session tokens (min 16 chars) |
| `MONGODB_URI` | MongoDB connection string (`mongodb+srv://...` or `mongodb://...`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional initial owner login override (if unset, use the in-app First-Run Setup form at `/admin/login`) |
| `WHATSAPP_API_VERSION` | Meta Graph API version (e.g. `v21.0`) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API Phone Number ID |
| `WHATSAPP_WABA_ID` | Meta WhatsApp Business Account ID |
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API permanent/system user access token |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token for `GET /api/webhooks/whatsapp` |
| `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` | Resend credentials for automated email notifications, reminders & receipts |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional legacy SMTP fallback for automated email delivery |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Optional legacy Gmail OAuth2 fallback |

## Database Architecture

The application connects to **MongoDB** via **Mongoose** (`MONGODB_URI`) and maintains indexed collections for `admins`, `members`, `membership_plans`, `subscriptions`, `payments`, `attendance`, `notifications`, `notification_templates`, `gym_settings`, `device_integrations`, `contact_inquiries`, `scheduler_runs`, and atomic `counters` (`TX0001`, receipt numbers).

## Production Build & Deployment

1. Build the frontend bundle:
   ```bash
   npm run build
   ```
2. Start the production server (Node 22+):
   ```bash
   NODE_ENV=production npm start
   ```
3. Configure your Meta WhatsApp webhook URL to point to:
   `https://<your-domain>/api/webhooks/whatsapp`
