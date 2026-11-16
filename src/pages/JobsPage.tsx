import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import JobCard from '../components/JobCard';
import ReportJobModal from '../components/ReportJobModal';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { CategoryItem, JobItem } from '../types';

const EXPERIENCE_LEVELS = ['Fresher', '0-1 Years', '1-3 Years', '3-5 Years', '5-10 Years', '10+ Years'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance', 'Apprenticeship', 'Walk-in'];
const WORK_MODES = ['Office', 'Remote', 'Hybrid'];
const SECTORS = ['Private', 'Government'];
const VERIFICATION_STATUSES = ['LIVE VERIFIED', 'UNVERIFIED', 'UNDER REVIEW'];

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') || '');
  const [pincode, setPincode] = useState(searchParams.get('pincode') || '');
  const [qualification, setQualification] = useState(searchParams.get('qualification') || '');
  const [experienceLevel, setExperienceLevel] = useState(searchParams.get('experienceLevel') || '');
  const [employmentType, setEmploymentType] = useState(searchParams.get('employmentType') || '');
  const [workMode, setWorkMode] = useState(searchParams.get('workMode') || '');
  const [sector, setSector] = useState(searchParams.get('sector') || '');
  const [source, setSource] = useState(searchParams.get('source') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [postedWithinDays, setPostedWithinDays] = useState(searchParams.get('postedWithinDays') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'latest');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [reportTarget, setReportTarget] = useState<JobItem | null>(null);

  useEffect(() => {
    document.title = 'Search Verified Jobs – MURTHU JOB HUB';
    apiFetch<CategoryItem[]>('/api/jobs/categories')
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    apiFetch<JobItem[]>('/api/user/saved-jobs')
      .then((rows) => setSavedIds(new Set(rows.map((r) => r.id))))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (location) params.set('location', location);
    if (city) params.set('city', city);
    if (stateFilter) params.set('state', stateFilter);
    if (pincode) params.set('pincode', pincode);
    if (qualification) params.set('qualification', qualification);
    if (experienceLevel) params.set('experienceLevel', experienceLevel);
    if (employmentType) params.set('employmentType', employmentType);
    if (workMode) params.set('workMode', workMode);
    if (sector) params.set('sector', sector);
    if (source) params.set('source', source);
    if (status) params.set('status', status);
    if (postedWithinDays) params.set('postedWithinDays', postedWithinDays);
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '18');

    setSearchParams(params, { replace: true });

    apiFetch<{
      items: JobItem[];
      pagination: { total: number; totalPages: number };
    }>(`/api/jobs?${params.toString()}`)
      .then((res) => {
        setJobs(res.items);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [
    q,
    category,
    location,
    city,
    stateFilter,
    pincode,
    qualification,
    experienceLevel,
    employmentType,
    workMode,
    sector,
    source,
    status,
    postedWithinDays,
    sort,
    page,
  ]);

  const resetAll = () => {
    setQ('');
    setCategory('');
    setLocation('');
    setCity('');
    setStateFilter('');
    setPincode('');
    setQualification('');
    setExperienceLevel('');
    setEmploymentType('');
    setWorkMode('');
    setSector('');
    setSource('');
    setStatus('');
    setPostedWithinDays('');
    setSort('latest');
    setPage(1);
  };

  const handleToggleSave = (jobId: number, nextSaved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nextSaved) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Explore Verified Jobs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Showing <span className="font-mono tabular-nums text-white">{total}</span> active
            opportunities across software, hardware, core engineering, government, and remote roles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="sort-select" className="text-xs text-slate-400">
            Sort by:
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-white/10 bg-[#0C1228] px-3 py-2 text-xs font-medium text-white focus:border-violet-500 focus:outline-none"
          >
            <option value="latest">Latest Posted</option>
            <option value="verified">Recently Verified</option>
            <option value="salary">Highest Salary</option>
            <option value="relevant">Most Relevant</option>
          </select>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Filter Rail */}
        <aside className="lg:col-span-3 space-y-5 rounded-xl border border-white/[0.08] bg-[#0C1228] p-5 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">Filters</h2>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Title, Skills, Company
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="React, VLSI, Python..."
                  className="w-full rounded-lg border border-white/10 bg-[#060918] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Hyderabad"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">State</label>
                <input
                  type="text"
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Telangana"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value);
                    setPage(1);
                  }}
                  placeholder="500081"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Qualification
                </label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => {
                    setQualification(e.target.value);
                    setPage(1);
                  }}
                  placeholder="B.Tech, MCA"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => {
                  setExperienceLevel(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Any Experience</option>
                {EXPERIENCE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => {
                  setEmploymentType(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">All Types</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Work Mode</label>
              <select
                value={workMode}
                onChange={(e) => {
                  setWorkMode(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Any Work Mode</option>
                {WORK_MODES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Sector</label>
              <select
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Private &amp; Government</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Verification Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">All Active</option>
                {VERIFICATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Date Posted</label>
              <select
                value={postedWithinDays}
                onChange={(e) => {
                  setPostedWithinDays(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Any time</option>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Source Platform
              </label>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">All Active Sources</option>
                <option value="SerpApi Google Jobs">SerpApi Google Jobs</option>
                <option value="Remotive">Remotive</option>
                <option value="Arbeitnow">Arbeitnow</option>
                <option value="Jobicy">Jobicy</option>
                <option value="The Muse">The Muse</option>
                <option value="Direct Employer">Direct Employer</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl border border-white/[0.06] bg-[#0C1228]"
                />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-12 text-center">
              <h3 className="font-display text-lg font-semibold text-white">
                No matching active jobs found
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Try clearing a filter or searching broader keywords. Closed and expired listings are
                automatically excluded from active search results.
              </p>
              <button
                type="button"
                onClick={resetAll}
                className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSaved={savedIds.has(job.id)}
                    onToggleSave={handleToggleSave}
                    onReport={setReportTarget}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/[0.08] pt-6">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  <span className="font-mono text-xs tabular-nums text-slate-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ReportJobModal job={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
