import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getApiAuthToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { JobItem } from '../types';

const REPORT_CATEGORIES = [
  'Job already closed',
  'Apply link not working',
  'Fake job',
  'Duplicate listing',
  'Incorrect salary',
  'Incorrect company',
  'Wrong location',
  'Suspicious recruitment',
  'Other',
];

interface ReportJobModalProps {
  job: JobItem | null;
  onClose: () => void;
}

export default function ReportJobModal({ job, onClose }: ReportJobModalProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      if (reporterEmail.trim()) formData.append('reporterEmail', reporterEmail.trim());
      if (evidenceFile) formData.append('evidence', evidenceFile);

      const headers: Record<string, string> = {};
      const token = getApiAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/jobs/${job.id}/report`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');
      setMessage(data.message || 'Report submitted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0D132A] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close report dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="report-modal-title" className="font-display text-lg font-bold text-white">
          Report Job Listing
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {job.title} at {job.companyName}
        </p>

        {message ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              {message}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Issue Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#070B1C] px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Details
              </label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened when you clicked the apply link or reviewed the job..."
                className="w-full rounded-lg border border-white/10 bg-[#070B1C] px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Optional Screenshot Evidence (PNG/JPG/WEBP, max 4MB)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-white/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Your Email (optional)
              </label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-[#070B1C] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
