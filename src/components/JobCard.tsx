import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bookmark,
  Clock,
  ExternalLink,
  Flag,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { JobItem } from '../types';

interface JobCardProps {
  job: JobItem;
  isSaved?: boolean;
  onToggleSave?: (jobId: number, nextSaved: boolean) => void;
  onReport?: (job: JobItem) => void;
}

export default function JobCard({ job, isSaved = false, onToggleSave, onReport }: JobCardProps) {
  const { user, setAuthModalOpen } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleApplyClick = async () => {
    try {
      await apiFetch(`/api/jobs/${job.id}/click`, { method: 'POST' });
    } catch {
      // Do not block direct employer redirect if tracking fails
    }
  };

  const handleSave = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!onToggleSave || saving) return;
    setSaving(true);
    try {
      if (isSaved) {
        await apiFetch(`/api/user/saved-jobs/${job.id}`, { method: 'DELETE' });
        onToggleSave(job.id, false);
      } else {
        await apiFetch(`/api/user/saved-jobs/${job.id}`, { method: 'POST' });
        onToggleSave(job.id, true);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderStatusIndicator = () => {
    if (job.verificationStatus === 'LIVE VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>LIVE VERIFIED</span>
        </span>
      );
    }
    if (job.verificationStatus === 'UNDER REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>UNDER REVIEW</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{job.verificationStatus}</span>
      </span>
    );
  };

  const formattedDate = new Date(job.postedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const verifiedTime = job.lastVerifiedAt
    ? new Date(job.lastVerifiedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : 'Pending check';

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0C1228] p-5 transition-colors hover:border-violet-500/40 hover:bg-[#101836]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/jobs/${job.slug}`}
              className="font-display text-base font-semibold text-white hover:text-sky-300 transition-colors line-clamp-2"
            >
              {job.title}
            </Link>
            <p className="mt-1 text-sm font-medium text-slate-200 truncate">{job.companyName}</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            aria-label={isSaved ? 'Remove saved job' : 'Save job'}
            title={isSaved ? 'Saved' : 'Save job'}
            className={`shrink-0 rounded-lg border p-2 transition-colors ${
              isSaved
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
            }`}
          >
            <Bookmark className="h-4 w-4" fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Clean unboxed inline metadata with typographic separators */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span>{job.city || job.location}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{job.workMode}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{job.employmentType}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{job.experienceLevel}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="text-sky-300/90">{job.categoryName}</span>
          {job.salaryDisplay && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span className="font-mono tabular-nums text-slate-200">{job.salaryDisplay}</span>
            </>
          )}
        </div>

        {job.skills.length > 0 && (
          <p className="mt-3 text-xs text-slate-400 line-clamp-1">
            Skills: {job.skills.slice(0, 5).join(' · ')}
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-white/[0.07] pt-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {renderStatusIndicator()}
          <span className="font-mono tabular-nums text-[11px] text-slate-400">
            {job.sourceName} · Verified {verifiedTime} · {formattedDate}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              to={`/jobs/${job.slug}`}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 whitespace-nowrap hover:border-white/25 hover:text-white transition-colors"
            >
              Details
            </Link>
            {onReport && (
              <button
                type="button"
                onClick={() => onReport(job)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Report</span>
              </button>
            )}
          </div>

          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleApplyClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-violet-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <span>Apply Now</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}
