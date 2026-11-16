import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import JobCard from '../components/JobCard';
import ReportJobModal from '../components/ReportJobModal';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { CategoryItem, CompanyItem, JobItem, PortalStats } from '../types';

const TRACK_TABS = [
  { id: 'latest', label: 'Latest Verified' },
  { id: 'fresher', label: 'Fresher' },
  { id: 'software', label: 'Software & IT' },
  { id: 'hardware', label: 'Hardware & Core' },
  { id: 'government', label: 'Government' },
  { id: 'remote', label: 'Remote' },
  { id: 'parttime', label: 'Part-Time' },
  { id: 'internship', label: 'Internships' },
] as const;

const INDIA_CITIES = [
  'Hyderabad',
  'Bengaluru',
  'Chennai',
  'Mumbai',
  'Pune',
  'Delhi',
  'Noida',
  'Gurgaon',
  'Kolkata',
  'Vijayawada',
  'Visakhapatnam',
  'Tirupati',
  'Warangal',
  'Remote India',
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [trackJobs, setTrackJobs] = useState<JobItem[]>([]);
  const [recentVerified, setRecentVerified] = useState<JobItem[]>([]);
  const [activeTrack, setActiveTrack] = useState<(typeof TRACK_TABS)[number]['id']>('latest');
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [reportTarget, setReportTarget] = useState<JobItem | null>(null);

  useEffect(() => {
    document.title = 'MURTHU JOB HUB – Live Verified Career Opportunities';
    Promise.all([
      apiFetch<PortalStats>('/api/jobs/stats'),
      apiFetch<CategoryItem[]>('/api/jobs/categories'),
      apiFetch<CompanyItem[]>('/api/jobs/companies'),
      apiFetch<{ items: JobItem[] }>('/api/jobs?sort=verified&limit=6'),
    ])
      .then(([s, cats, comps, recent]) => {
        setStats(s);
        setCategories(cats);
        setCompanies(comps.slice(0, 8));
        setRecentVerified(recent.items);
      })
      .catch(() => setLoadError('Job listings are temporarily unavailable. Please try again later.'));
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
    setLoadingJobs(true);
    const params = new URLSearchParams({ limit: '6', sort: 'latest' });
    if (activeTrack === 'latest') params.set('sort', 'verified');
    if (activeTrack === 'fresher') params.set('experienceLevel', 'Fresher');
    if (activeTrack === 'software') params.set('q', 'Developer');
    if (activeTrack === 'hardware') params.set('q', 'Hardware');
    if (activeTrack === 'government') params.set('sector', 'Government');
    if (activeTrack === 'remote') params.set('workMode', 'Remote');
    if (activeTrack === 'parttime') params.set('employmentType', 'Part-time');
    if (activeTrack === 'internship') params.set('employmentType', 'Internship');

    apiFetch<{ items: JobItem[] }>(`/api/jobs?${params.toString()}`)
      .then((res) => setTrackJobs(res.items))
      .catch(() => setTrackJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [activeTrack]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (locationQuery.trim()) params.set('location', locationQuery.trim());
    if (selectedCategory) params.set('category', selectedCategory);
    navigate(`/jobs?${params.toString()}`);
  };

  const handleToggleSave = (jobId: number, nextSaved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nextSaved) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };

  const groupedCategories = categories.reduce<Record<string, CategoryItem[]>>((acc, c) => {
    if (!acc[c.groupName]) acc[c.groupName] = [];
    acc[c.groupName].push(c);
    return acc;
  }, {});

  return (
    <div>
      {loadError && (
        <div role="alert" className="mx-auto max-w-7xl px-4 py-4 text-sm text-amber-200 sm:px-6 lg:px-8">
          {loadError}
        </div>
      )}
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/hero_career_architecture_1794806968907.jpg"
            alt="Modern architectural technology campus at dusk"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060918]/80 via-[#060918]/88 to-[#060918]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-3xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              One Platform. Thousands of Opportunities. One Dream Career.
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              YOUR NEXT BIG OPPORTUNITY STARTS HERE.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Discover real-time career opportunities across software, hardware, government,
              engineering and every major industry.
            </p>
          </motion.div>

          {/* Unified Hero Search Engine */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-10 rounded-2xl border border-white/12 bg-[#0B1126]/95 p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="relative md:col-span-4">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Job title, skill, or company"
                  aria-label="Job title, skill, or company"
                  className="w-full rounded-xl border border-white/10 bg-[#060918] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="relative md:col-span-3">
                <MapPin
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Hyderabad, Bengaluru, Remote..."
                  aria-label="Location"
                  className="w-full rounded-xl border border-white/10 bg-[#060918] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Select Category"
                  className="w-full rounded-xl border border-white/10 bg-[#060918] px-3.5 py-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 md:col-span-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white whitespace-nowrap hover:bg-violet-500 transition-colors"
                >
                  Search Jobs
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pt-2 border-t border-white/[0.06]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>Popular Hubs:</span>
                {['Hyderabad', 'Bengaluru', 'Chennai', 'Mumbai', 'Remote'].map((hub) => (
                  <button
                    key={hub}
                    type="button"
                    onClick={() => navigate(`/jobs?location=${encodeURIComponent(hub)}`)}
                    className="text-slate-300 hover:text-sky-300 transition-colors"
                  >
                    {hub}
                  </button>
                ))}
              </div>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 whitespace-nowrap"
              >
                <span>Explore All Jobs</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </form>

          {/* Real Database Statistics Strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.08] bg-[#0B1126]/85 p-5">
              <p className="text-xs font-medium text-slate-400">Verified Live Jobs</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {stats ? stats.liveVerifiedJobs.toLocaleString('en-IN') : '—'}
              </p>
              <p className="mt-1 text-xs text-emerald-400">
                {stats ? `${stats.activeJobs.toLocaleString('en-IN')} total active listings` : 'Live database count'}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0B1126]/85 p-5">
              <p className="text-xs font-medium text-slate-400">Hiring Companies</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {stats ? stats.hiringCompanies.toLocaleString('en-IN') : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400">Verified organizations</p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0B1126]/85 p-5">
              <p className="text-xs font-medium text-slate-400">Job Categories</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {stats ? stats.jobCategories.toLocaleString('en-IN') : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400">Software, Hardware &amp; Govt</p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0B1126]/85 p-5">
              <p className="text-xs font-medium text-slate-400">Active Sources</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {stats ? stats.activeSources.toLocaleString('en-IN') : '—'}
              </p>
              <p className="mt-1 text-xs text-sky-300">Direct employer apply links</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Opportunity Tracks */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Live Career Opportunities
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Filter verified openings by career stage, engineering discipline, or work arrangement.
            </p>
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-300 hover:text-violet-200 whitespace-nowrap"
          >
            <span>Open Full Search Engine</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Segmented Track Tabs */}
        <div
          role="tablist"
          aria-label="Opportunity tracks"
          className="mt-6 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0B1126] p-1.5"
        >
          {TRACK_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTrack === tab.id}
              onClick={() => setActiveTrack(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                activeTrack === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadingJobs ? (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-xl border border-white/[0.06] bg-[#0C1228]"
              />
            ))}
          </div>
        ) : trackJobs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-white/[0.08] bg-[#0C1228] p-10 text-center">
            <p className="text-base font-medium text-white">
              No active listings matched this track yet.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Sources synchronize continuously. Try exploring all active jobs or another track.
            </p>
            <Link
              to="/jobs"
              className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              Browse All Active Jobs
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trackJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                onToggleSave={handleToggleSave}
                onReport={setReportTarget}
              />
            ))}
          </div>
        )}
      </section>

      {/* Dedicated Hyderabad & Core Engineering Split Showcase */}
      <section className="border-y border-white/[0.08] bg-[#080D1F]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
            {/* Hyderabad Spotlight */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C1228] lg:col-span-7">
              <div className="relative h-56 sm:h-64">
                <img
                  src="/src/assets/images/hyderabad_tech_corridor_1794806970345.jpg"
                  alt="Hyderabad technology corridor skyline at dusk"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C1228] via-[#0C1228]/40 to-transparent" />
              </div>

              <div className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Hyderabad &amp; Indian Career Hubs
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Prioritized discovery across Hyderabad HITEC City, Bengaluru, Chennai, Mumbai,
                    Pune, Delhi NCR, Vijayawada, Visakhapatnam, Tirupati, Warangal, and remote
                    teams across India.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {INDIA_CITIES.map((city) => (
                    <Link
                      key={city}
                      to={`/jobs?city=${encodeURIComponent(city)}`}
                      className="rounded-lg border border-white/10 bg-[#070B1C] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400/50 hover:text-sky-300 transition-colors"
                    >
                      {city}
                    </Link>
                  ))}
                </div>

                <div>
                  <Link
                    to="/hyderabad-jobs"
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    <span>Explore Hyderabad Jobs</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Hardware & Core Engineering Spotlight */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C1228] lg:col-span-5">
              <div className="relative h-56 sm:h-64">
                <img
                  src="/src/assets/images/hardware_core_engineering_1794806970444.jpg"
                  alt="Hardware and embedded systems engineering lab"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C1228] via-[#0C1228]/40 to-transparent" />
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                <h2 className="font-display text-2xl font-bold text-white">
                  Hardware &amp; Core Engineering
                </h2>
                <p className="text-sm leading-relaxed text-slate-300">
                  Dedicated tracks for VLSI, Embedded Systems, PCB Design, Electronics, Electrical,
                  Mechanical, Civil, Robotics, and Manufacturing Engineers.
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-400">
                  {[
                    'VLSI Engineer',
                    'Embedded Systems Engineer',
                    'PCB Design Engineer',
                    'Hardware Engineer',
                    'Mechanical Engineer',
                    'Robotics Engineer',
                  ].map((cat) => (
                    <Link
                      key={cat}
                      to={`/jobs?category=${encodeURIComponent(cat)}`}
                      className="text-sky-300 hover:underline"
                    >
                      {cat}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Hiring Companies & Recently Verified */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-16">
        {companies.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Top Hiring Companies
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Organizations with active opportunities indexed from live sources.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {companies.map((comp) => (
                <Link
                  key={comp.id}
                  to={`/jobs?q=${encodeURIComponent(comp.name)}`}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#0C1228] p-4 hover:border-violet-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#070B1C] text-sky-300">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{comp.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {comp.headquarters || 'Hiring now'}
                      </p>
                    </div>
                  </div>
                  <span className="ml-2 font-mono text-xs tabular-nums text-violet-300 shrink-0">
                    {comp.activeJobs} open
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {recentVerified.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Recently Verified Jobs
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Listings checked by our automated live HTTP validation engine.
                </p>
              </div>
              <Link
                to="/jobs?sort=verified"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-300 hover:text-sky-200 whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>View All Verified</span>
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {recentVerified.slice(0, 3).map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedIds.has(job.id)}
                  onToggleSave={handleToggleSave}
                  onReport={setReportTarget}
                />
              ))}
            </div>
          </div>
        )}

        {/* Browse All Categories Preview */}
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Browse All Career Categories
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Complete taxonomy across Software &amp; IT, Hardware &amp; Core, Government, and
                Specialized Sectors.
              </p>
            </div>
            <Link
              to="/categories"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-300 hover:text-violet-200 whitespace-nowrap"
            >
              <span>All {categories.length} Categories</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {Object.entries(groupedCategories).map(([group, items]) => (
              <div
                key={group}
                className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6"
              >
                <h3 className="font-display text-base font-semibold text-white">{group}</h3>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                  {items.slice(0, 14).map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/jobs?category=${encodeURIComponent(cat.name)}`}
                      className="text-slate-300 hover:text-sky-300 transition-colors"
                    >
                      {cat.name}
                      {cat.activeCount > 0 ? (
                        <span className="ml-1 font-mono tabular-nums text-slate-500">
                          ({cat.activeCount})
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ReportJobModal job={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
