import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function FeedbackPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [type, setType] = useState<
    'Suggestion' | 'Complaint' | 'Feature Request' | 'General Experience'
  >('General Experience');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [summary, setSummary] = useState<{
    totalCount: number;
    avgRating: number;
    recent: Array<{
      id: number;
      name: string;
      type: string;
      rating: number;
      message: string;
      adminResponse: string | null;
      createdAt: string;
    }>;
  }>({ totalCount: 0, avgRating: 0, recent: [] });

  const loadSummary = () => {
    apiFetch<typeof summary>('/api/feedback/public')
      .then(setSummary)
      .catch(() => {});
  };

  useEffect(() => {
    document.title = 'Community Feedback – MURTHU JOB HUB';
    loadSummary();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess('');
    setError('');
    try {
      const res = await apiFetch<{ message: string }>('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ name, email, type, rating, message }),
      });
      setSuccess(res.message);
      setMessage('');
      loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-white/[0.08] pb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Platform Feedback &amp; Feature Requests
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Share suggestions, report portal issues, request new job categories, or rate your job
          search experience on MURTHU JOB HUB.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 rounded-2xl border border-white/[0.08] bg-[#0C1228] p-6 sm:p-8 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Your Experience Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} stars`}
                  className="rounded-lg p-1.5 hover:bg-white/5"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 font-mono text-xs text-slate-400">{rating}/5</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Feedback Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="General Experience">General Experience</option>
              <option value="Suggestion">Suggestion</option>
              <option value="Feature Request">Feature Request</option>
              <option value="Complaint">Complaint</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Message</label>
            <textarea
              required
              minLength={5}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us how we can improve job discovery, verification, or filters..."
              className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {success && <p className="text-xs font-medium text-emerald-400">{success}</p>}
          {error && <p className="text-xs font-medium text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>

        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0C1228] p-6">
            <h2 className="font-display text-lg font-semibold text-white">Community Rating</h2>
            <div className="mt-3 flex items-baseline gap-4">
              <span className="font-mono text-4xl font-bold tabular-nums text-white">
                {summary.totalCount > 0 ? summary.avgRating.toFixed(1) : '—'}
              </span>
              <span className="text-sm text-slate-400">
                out of 5.0 ({summary.totalCount} verified submissions)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {summary.recent.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">
                    {item.name} · <span className="text-sky-300">{item.type}</span>
                  </span>
                  <span className="font-mono text-amber-400">{item.rating}/5 ★</span>
                </div>
                <p className="text-sm text-slate-300">{item.message}</p>
                {item.adminResponse && (
                  <p className="text-xs text-emerald-300 pt-1">Team reply: {item.adminResponse}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
