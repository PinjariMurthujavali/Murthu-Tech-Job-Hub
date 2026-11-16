import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Clock,
  ExternalLink,
  Flag,
  ShieldCheck,
} from 'lucide-react';
import JobCard from '../components/JobCard';
import ReportJobModal from '../components/ReportJobModal';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { JobItem } from '../types';

interface ValidationLogRow {
  id: number;
  previousStatus: string;
  newStatus: string;
  httpStatus: number | null;
  checkOutcome: string;
  details: string | null;
  checkedAt: string;
}

interface JobDetailResponse extends JobItem {
  validationHistory: ValidationLogRow[];
  relatedJobs: JobItem[];
}

export default function JobDetailPage() {
  const { idOrSlug } = useParams();
  const { user, setAuthModalOpen } = useAuth();
  const [job, setJob] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [reportTarget, setReportTarget] = useState<JobItem | null>(null);

  useEffect(() => {
    if (!idOrSlug) return;
    setLoading(true);
    setError('');
    apiFetch<JobDetailResponse>(`/api/jobs/${encodeURIComponent(idOrSlug)}`)
      .then((res) => {
        setJob(res);
        document.title = `${res.title} at ${res.companyName} – MURTHU JOB HUB`;
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Job not found'))
      .finally(() => setLoading(false));
  }, [idOrSlug]);

  useEffect(() => {
    if (!user || !job) return;
    apiFetch<JobItem[]>('/api/user/saved-jobs')
      .then((rows) => setIsSaved(rows.some((r) => r.id === job.id)))
      .catch(() => {});
  }, [user, job]);

  const handleApply = async () => {
    if (!job) return;
    try {
      await apiFetch(`/api/jobs/${job.id}/click`, { method: 'POST' });
    } catch {
      // non-blocking
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!job) return;
    if (isSaved) {
      await apiFetch(`/api/user/saved-jobs/${job.id}`, { method: 'DELETE' });
      setIsSaved(false);
    } else {
      await apiFetch(`/api/user/saved-jobs/${job.id}`, { method: 'POST' });
      setIsSaved(true);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-96 animate-pulse rounded-2xl bg-[#0C1228]" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Job Listing Unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">{error || 'This job could not be found.'}</p>
        <Link
          to="/jobs"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Active Jobs</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Back to Search Results</span>
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Job Content */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0C1228] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {job.verificationStatus === 'LIVE VERIFIED' ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>LIVE VERIFIED</span>
                </span>
              ) : job.verificationStatus === 'UNDER REVIEW' ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-400">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <span>UNDER REVIEW</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>{job.verificationStatus}</span>
                </span>
              )}
              <span className="text-slate-600">&middot;</span>
              <span className="text-sky-300">{job.categoryName}</span>
              <span className="text-slate-600">&middot;</span>
              <span className="text-slate-400">{job.sector} Sector</span>
            </div>

            <h1 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-1.5 text-base font-medium text-slate-200">{job.companyName}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
              <span>{job.location}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{job.workMode}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{job.employmentType}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{job.experienceLevel}</span>
              {job.salaryDisplay && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span className="font-mono tabular-nums text-white">{job.salaryDisplay}</span>
                </>
              )}
            </div>

            {job.skills.length > 0 && (
              <div className="mt-6 border-t border-white/[0.07] pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Key Skills
                </h2>
                <p className="mt-2 text-sm text-slate-200">{job.skills.join(' · ')}</p>
              </div>
            )}

            <div className="mt-6 border-t border-white/[0.07] pt-6">
              <h2 className="font-display text-lg font-semibold text-white">Role Description</h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {job.description}
              </div>
            </div>

            {job.qualifications && (
              <div className="mt-6 border-t border-white/[0.07] pt-6">
                <h2 className="font-display text-lg font-semibold text-white">Qualifications</h2>
                <p className="mt-2 text-sm text-slate-300">{job.qualifications}</p>
              </div>
            )}
          </div>

          {/* Automated Validation History */}
          {job.validationHistory.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0C1228] p-6">
              <h2 className="font-display text-base font-semibold text-white">
                Automated Verification Audit Trail
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 pr-4">Checked</th>
                      <th className="py-2 pr-4">Outcome</th>
                      <th className="py-2 pr-4">HTTP</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {job.validationHistory.map((log) => (
                      <tr key={log.id} className="text-slate-300">
                        <td className="py-2.5 pr-4 font-mono tabular-nums whitespace-nowrap">
                          {new Date(log.checkedAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{log.checkOutcome}</td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums">
                          {log.httpStatus ?? '—'}
                        </td>
                        <td className="py-2.5 text-slate-400">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Original Apply Card */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-[#0C1228] p-6 space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Direct Application</h2>
              <p className="mt-1 text-xs text-slate-400">
                Opens the original employer or authorized platform page in a new tab.
              </p>
            </div>

            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleApply}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              <span>Apply Now on Original Site</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleToggleSave}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  isSaved
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                    : 'border-white/10 text-slate-300 hover:bg-white/5'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" fill={isSaved ? 'currentColor' : 'none'} />
                <span>{isSaved ? 'Saved' : 'Save Job'}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportTarget(job)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:border-amber-400/40 hover:text-amber-300 transition-colors"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Report Job</span>
              </button>
            </div>

            <dl className="space-y-3 border-t border-white/[0.08] pt-4 text-xs">
              <div>
                <dt className="text-slate-500">Original Source Platform</dt>
                <dd className="mt-0.5 font-medium text-slate-200">{job.sourceName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Original Application URL</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-sky-300 break-all">
                  {job.applyUrl}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Last Verified</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-slate-200">
                  {job.lastVerifiedAt
                    ? new Date(job.lastVerifiedAt).toLocaleString('en-IN')
                    : 'Scheduled for next check'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Verification Status</dt>
                <dd className="mt-0.5 font-semibold text-white">{job.verificationStatus}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {job.relatedJobs.length > 0 && (
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <h2 className="font-display text-xl font-bold text-white">Similar Active Opportunities</h2>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {job.relatedJobs.slice(0, 3).map((rj) => (
              <JobCard
                key={rj.id}
                job={{ ...rj, skills: [] }}
                onReport={setReportTarget}
              />
            ))}
          </div>
        </section>
      )}

      <ReportJobModal job={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
