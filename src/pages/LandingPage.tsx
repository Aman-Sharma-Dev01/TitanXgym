import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react';
import { apiFetch, formatINR } from '../lib/api';
import { PWAInstallButton } from '../components/PWAControls';
import type { GymSettings, MembershipPlan } from '../types/gym';

const DEFAULT_SETTINGS: GymSettings = {
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

const WHY_TITAN_X = [
  {
    num: '01',
    title: 'Strength & Powerbuilding Training',
    desc: 'Purpose-built around compound barbell strength and hypertrophy progression so every training block builds measurable power and physique.',
  },
  {
    num: '02',
    title: 'Dedicated Training Environment',
    desc: 'A focused, no-distraction training floor designed for serious lifters, beginners learning proper mechanics, and committed daily athletes.',
  },
  {
    num: '03',
    title: 'Consistent Fitness Journey',
    desc: 'Structured membership tracking and timely renewal reminders keep your training schedule unbroken month after month.',
  },
  {
    num: '04',
    title: 'Membership Plans',
    desc: 'Flexible duration options managed transparently by TITAN X administration with clear validity dates and instant digital receipts.',
  },
  {
    num: '05',
    title: 'Flexible Training Hours',
    desc: 'Open from 5:00 AM to 11:00 PM Monday through Saturday, plus Sunday afternoon and evening sessions from 2:00 PM to 11:00 PM.',
  },
];

export const LandingPage: React.FC = () => {
  const [settings, setSettings] = useState<GymSettings>(DEFAULT_SETTINGS);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [form, setForm] = useState({ name: '', mobile: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    apiFetch<{ settings: GymSettings; plans: MembershipPlan[] }>('/api/public/info')
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.plans)) setPlans(data.plans);
      })
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitState(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSubmitState({ ok: true, msg: res.message });
      setForm({ name: '', mobile: '', email: '', message: '' });
    } catch (err) {
      setSubmitState({
        ok: false,
        msg: err instanceof Error ? err.message : 'Unable to send inquiry right now.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const phoneHref = `tel:+91${settings.contact_number.replace(/\D/g, '').slice(-10)}`;
  const waHref = `https://wa.me/91${settings.contact_number.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
    'Hello TITAN X! I would like to know more about joining the gym.',
  )}`;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-8">
          <a href="#top" className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <img
              src="/src/assets/images/titanx_logo_1795517847867.jpg"
              alt="TITAN X Logo"
              className="h-9 w-9 rounded object-cover border border-white/15"
              referrerPolicy="no-referrer"
            />
            <span className="font-display text-xl font-bold tracking-wider text-white">
              TITAN <span className="text-[#EF1717]">X</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A0A0A0]">
            <a href="#about" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#why-titanx" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Training
            </a>
            <a href="#hours" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Hours
            </a>
            <a href="#contact" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
            <Link to="/admin/login" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Admin
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#contact"
              className="rounded-md bg-[#EF1717] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#d11313] whitespace-nowrap shrink-0"
            >
              Join TITAN X
            </a>
          </div>
        </div>
      </header>

      {/* A. HERO SECTION */}
      <section id="top" className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/titanx_hero_gym_1795517849063.jpg"
            alt="TITAN X Powerbuilding Gym Interior in Faridabad"
            className="h-full w-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/85 to-[#080808]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-8 lg:py-36">
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center gap-4">
              <img
                src="/src/assets/images/titanx_logo_1795517847867.jpg"
                alt="TITAN X Emblem"
                className="h-14 w-14 rounded-md object-cover border border-white/20"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="font-display text-lg font-bold tracking-widest text-white uppercase">
                  TITAN <span className="text-[#EF1717]">X</span>
                </p>
                <p className="text-sm text-[#A0A0A0]">{settings.tagline} · Powerbuilding Gym</p>
              </div>
            </div>

            <h1
              className="font-display font-bold uppercase tracking-tight text-white leading-[1.02]"
              style={{ fontSize: 'clamp(2.5rem, 5.2vw, 4.5rem)', textWrap: 'balance' }}
            >
              BUILT DIFFERENT.{' '}
              <span className="text-[#EF1717]">TRAIN STRONGER.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#D4D4D4] sm:text-lg">
              {settings.tagline}. A dedicated powerbuilding gym in Faridabad built for disciplined
              strength training, bodybuilding, and measurable long-term progression.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#d11313] whitespace-nowrap"
              >
                Join TITAN X
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-[#151515]/80 px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:border-white whitespace-nowrap"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* B. ABOUT THE GYM */}
      <section id="about" className="border-b border-white/10 bg-[#080808] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-stretch gap-10 px-4 sm:px-8 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EF1717]">
              Powerbuilding Gym · Faridabad
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
              Where Raw Strength Meets Sculpted Physique
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#A0A0A0]">
              TITAN X brings together the foundational discipline of powerlifting and the structured
              volume of bodybuilding. Every session is centered on compound barbell work, progressive
              overload, and consistent execution.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#A0A0A0]">
              Whether your focus is building maximal strength, adding lean muscle, or establishing a
              consistent fitness routine in Faridabad, TITAN X provides the space, atmosphere, and
              extended hours to train without compromise.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
              <div>
                <div className="font-display text-xl font-bold uppercase text-white">Strength</div>
                <div className="mt-1 text-xs text-[#A0A0A0]">Compound lifts & progressive load</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold uppercase text-white">Hypertrophy</div>
                <div className="mt-1 text-xs text-[#A0A0A0]">Structured bodybuilding focus</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold uppercase text-white">Consistency</div>
                <div className="mt-1 text-xs text-[#A0A0A0]">Open 7 days a week</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full overflow-hidden rounded-lg border border-white/10 bg-[#151515]">
              <img
                src="/src/assets/images/titanx_strength_training_1795517849794.jpg"
                alt="Olympic barbell and calibrated plates on the TITAN X lifting platform"
                className="h-full w-full object-cover min-h-[300px]"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* C. WHY CHOOSE TITAN X */}
      <section id="why-titanx" className="border-b border-white/10 bg-[#0D0D0D] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EF1717]">
              Why Choose TITAN X
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
              Built for Serious Daily Progression
            </h2>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-5">
              <div className="h-full overflow-hidden rounded-lg border border-white/10 bg-[#151515]">
                <img
                  src="/src/assets/images/titanx_training_floor_1795517850032.jpg"
                  alt="TITAN X training floor with dumbbells, benches, and cable stations"
                  className="h-full w-full object-cover min-h-[320px]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="lg:col-span-7 divide-y divide-white/10 border-y border-white/10">
              {WHY_TITAN_X.map((item) => (
                <div key={item.num} className="flex gap-5 py-5">
                  <span className="font-mono-tabular text-sm font-semibold text-[#EF1717] pt-0.5">
                    {item.num}.
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#A0A0A0]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DYNAMIC ADMIN-CONFIGURED MEMBERSHIP PLANS (NO HARDCODED PRICES) */}
      <section id="plans" className="border-b border-white/10 bg-[#080808] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EF1717]">
                Memberships
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
                Membership Plans
              </h2>
            </div>
            <p className="text-sm text-[#A0A0A0]">
              Plans are managed directly by TITAN X Faridabad.
            </p>
          </div>

          {plans.length === 0 ? (
            <div className="mt-10 rounded-lg border border-white/10 bg-[#151515] p-8 sm:flex sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold uppercase text-white">
                  Current Membership Pricing Available at Reception
                </h3>
                <p className="mt-2 max-w-xl text-sm text-[#A0A0A0]">
                  Reach out by phone, WhatsApp, or visit TITAN X in Faridabad to review active
                  monthly, quarterly, and annual powerbuilding memberships.
                </p>
              </div>
              <a
                href={phoneHref}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] sm:mt-0 whitespace-nowrap"
              >
                <Phone className="h-4 w-4" />
                Call +91 {settings.contact_number}
              </a>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-lg border border-white/10 bg-[#151515] p-6"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-display text-2xl font-bold uppercase text-white">
                        {plan.name}
                      </h3>
                      <span className="font-mono-tabular text-xs text-[#A0A0A0]">
                        {plan.duration} {plan.duration_unit}
                      </span>
                    </div>
                    <div className="mt-4 font-mono-tabular text-3xl font-bold text-white">
                      {formatINR(plan.price)}
                    </div>
                    {plan.description && (
                      <p className="mt-3 text-sm leading-relaxed text-[#A0A0A0]">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <a
                    href="#contact"
                    className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:border-[#EF1717] hover:bg-[#EF1717]"
                  >
                    Inquire About {plan.name}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* D. OPENING HOURS & E. CONTACT SECTION */}
      <section id="hours" className="border-b border-white/10 bg-[#0D0D0D] py-20 lg:py-28">
        <div id="contact" className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EF1717]">
                Hours & Location
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
                Visit TITAN X Faridabad
              </h2>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider text-white">
                <Clock className="h-4 w-4 text-[#EF1717]" />
                Opening Hours
              </div>
              <div className="space-y-3 border-t border-white/10 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#A0A0A0]">Monday – Saturday</span>
                  <span className="font-mono-tabular font-medium text-white">
                    {settings.hours_mon_sat}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A0A0A0]">Sunday</span>
                  <span className="font-mono-tabular font-medium text-white">
                    {settings.hours_sun}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={phoneHref}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#151515] p-4 transition-colors hover:border-[#EF1717]"
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-[#EF1717]" />
                  <div>
                    <div className="text-xs text-[#A0A0A0]">Call Reception</div>
                    <div className="font-mono-tabular text-base font-semibold text-white">
                      +91 {settings.contact_number}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#A0A0A0]" />
              </a>

              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#151515] p-4 transition-colors hover:border-emerald-500/60"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-emerald-400" />
                  <div>
                    <div className="text-xs text-[#A0A0A0]">WhatsApp Direct</div>
                    <div className="text-sm font-semibold text-white">Message TITAN X on WhatsApp</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#A0A0A0]" />
              </a>

              <a
                href={settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#151515] p-4 transition-colors hover:border-white/30"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-[#EF1717]" />
                  <div>
                    <div className="text-xs text-[#A0A0A0]">Directions</div>
                    <div className="text-sm font-semibold text-white">
                      Open in Google Maps ({settings.address})
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#A0A0A0]" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="rounded-lg border border-white/10 bg-[#151515] p-6 sm:p-8"
            >
              <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                Send an Inquiry
              </h3>
              <p className="mt-1 text-sm text-[#A0A0A0]">
                Leave your details and our team in Faridabad will reach out with membership options.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-medium text-[#A0A0A0]">
                    Full Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white placeholder-[#525252] focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="contact-mobile" className="block text-xs font-medium text-[#A0A0A0]">
                    Mobile Number *
                  </label>
                  <input
                    id="contact-mobile"
                    type="tel"
                    required
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white placeholder-[#525252] focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="contact-email" className="block text-xs font-medium text-[#A0A0A0]">
                  Email (Optional)
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white placeholder-[#525252] focus:border-[#EF1717] focus:outline-none"
                />
              </div>

              <div className="mt-5">
                <label htmlFor="contact-message" className="block text-xs font-medium text-[#A0A0A0]">
                  Message / Training Goals *
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us when you'd like to start or visit the gym..."
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white placeholder-[#525252] focus:border-[#EF1717] focus:outline-none"
                />
              </div>

              {submitState && (
                <div
                  className={`mt-5 flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
                    submitState.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-[#EF1717]/40 bg-[#EF1717]/10 text-[#ff8080]'
                  }`}
                >
                  {submitState.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  <span>{submitState.msg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#d11313] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Sending...' : 'Send Inquiry'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* F. FOOTER */}
      <footer className="bg-[#080808] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid gap-8 border-b border-white/10 pb-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/src/assets/images/titanx_logo_1795517847867.jpg"
                  alt="TITAN X"
                  className="h-9 w-9 rounded object-cover border border-white/15"
                  referrerPolicy="no-referrer"
                />
                <span className="font-display text-xl font-bold tracking-wider text-white">
                  TITAN <span className="text-[#EF1717]">X</span>
                </span>
              </div>
              <p className="mt-3 text-sm text-[#A0A0A0]">
                {settings.tagline} · Powerbuilding Gym
              </p>
              <div className="mt-4">
                <PWAInstallButton />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                Contact
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[#A0A0A0]">
                <li>
                  <a href={phoneHref} className="hover:text-white">
                    +91 {settings.contact_number}
                  </a>
                </li>
                <li>{settings.address}</li>
                <li>
                  <a
                    href={settings.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#EF1717] hover:underline"
                  >
                    Google Maps Directions
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                Opening Hours
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[#A0A0A0]">
                <li>Mon – Sat: {settings.hours_mon_sat}</li>
                <li>Sunday: {settings.hours_sun}</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                Navigation
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-[#A0A0A0]">
                <li>
                  <a href="#about" className="hover:text-white">
                    About TITAN X
                  </a>
                </li>
                <li>
                  <a href="#why-titanx" className="hover:text-white">
                    Training Philosophy
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white">
                    Contact & Join
                  </a>
                </li>
                <li>
                  <Link to="/admin/login" className="hover:text-white">
                    Admin Portal
                  </Link>
                </li>
                {settings.social_instagram && (
                  <li>
                    <a
                      href={settings.social_instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white"
                    >
                      Instagram
                    </a>
                  </li>
                )}
                {settings.social_facebook && (
                  <li>
                    <a
                      href={settings.social_facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white"
                    >
                      Facebook
                    </a>
                  </li>
                )}
                {settings.social_youtube && (
                  <li>
                    <a
                      href={settings.social_youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white"
                    >
                      YouTube
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-[#737373] sm:flex-row">
            <p>© {new Date().getFullYear()} TITAN X – Faridabad's Home of Strength. All rights reserved.</p>
            <p>Powerbuilding · Strength · Conditioning</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
