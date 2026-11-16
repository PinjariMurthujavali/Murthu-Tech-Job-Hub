import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export function AboutPage() {
  useEffect(() => {
    document.title = 'About Us – MURTHU JOB HUB';
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 space-y-8">
      <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
        About MURTHU JOB HUB
      </h1>
      <p className="text-base leading-relaxed text-slate-300">
        MURTHU JOB HUB is a centralized career discovery platform engineered to connect freshers,
        software developers, hardware and core electronics engineers, students, women seeking
        flexible roles, and government job aspirants with legitimate, verified employment
        opportunities.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6">
          <h2 className="font-display text-lg font-semibold text-white">
            Continuous Live Verification
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Every indexed job undergoes automated HTTP accessibility and closure detection. Expired
            listings are archived automatically and closed roles are removed from active search
            results.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6">
          <h2 className="font-display text-lg font-semibold text-white">
            Direct Employer Application Links
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            We preserve the original application URL and platform attribution on every single listing
            so candidates always apply directly on the official employer or authorized portal.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState('');

  useEffect(() => {
    document.title = 'Contact Support – MURTHU JOB HUB';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        type: 'Contact Inquiry',
        rating: 5,
        message,
      }),
    });
    setSent('Your message has been received by the MURTHU JOB HUB team.');
    setMessage('');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 space-y-6">
      <h1 className="font-display text-3xl font-bold text-white">Contact Support</h1>
      <p className="text-sm text-slate-400">
        Need help with an account, employer listing verification, or API partnership? Reach out
        below.
      </p>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4"
      >
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your Email"
          className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white"
        />
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white"
        />
        {sent && <p className="text-xs text-emerald-400">{sent}</p>}
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
        >
          Send Message
        </button>
      </form>
    </div>
  );
}

export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy – MURTHU JOB HUB';
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 space-y-5 text-sm leading-relaxed text-slate-300">
      <h1 className="font-display text-3xl font-bold text-white">Privacy Policy</h1>
      <p>
        MURTHU JOB HUB collects only the account information, candidate profile preferences, and
        uploaded resumes you explicitly provide to personalize your job search and alerts.
      </p>
      <p>
        Personal information, email addresses, and uploaded resumes are never published publicly or
        sold to third parties. Outbound clicks on Apply Now open the original employer or job
        platform directly in a new tab.
      </p>
    </div>
  );
}

export function TermsPage() {
  useEffect(() => {
    document.title = 'Terms & Conditions – MURTHU JOB HUB';
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 space-y-5 text-sm leading-relaxed text-slate-300">
      <h1 className="font-display text-3xl font-bold text-white">Terms &amp; Conditions</h1>
      <p>
        MURTHU JOB HUB aggregates career opportunities from authorized public APIs and verified
        employer submissions. While our validation engine continuously monitors link availability,
        final hiring decisions and application processing occur exclusively on the destination
        employer website.
      </p>
      <p>
        Never pay recruitment fees to any third party. Use the Report Job tool on any listing if you
        encounter suspicious activity or a closed role.
      </p>
    </div>
  );
}
