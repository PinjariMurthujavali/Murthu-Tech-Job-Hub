import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

type AdminTab = 'overview' | 'jobs' | 'sources' | 'reports' | 'categories' | 'users' | 'logs';

export default function AdminDashboardPage() {
  const { user, setAuthModalOpen } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any>({ syncLogs: [], validationLogs: [] });
  const [actionMsg, setActionMsg] = useState('');

  // Manual Job Creation State
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newCategory, setNewCategory] = useState('Software Developer');
  const [newLocation, setNewLocation] = useState('Hyderabad, Telangana, India');
  const [newCity, setNewCity] = useState('Hyderabad');
  const [newApplyUrl, setNewApplyUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSector, setNewSector] = useState<'Private' | 'Government'>('Private');
  const [newWorkMode, setNewWorkMode] = useState<'Office' | 'Remote' | 'Hybrid'>('Office');
  const [newEmploymentType, setNewEmploymentType] = useState('Full-time');
  const [newExp, setNewExp] = useState('Fresher');
  const [newSalary, setNewSalary] = useState('');

  // Custom SerpApi Query
  const [serpQuery, setSerpQuery] = useState('Python Developer Hyderabad');
  const [serpLocation, setSerpLocation] = useState('Hyderabad, Telangana, India');

  // New Category
  const [catName, setCatName] = useState('');
  const [catGroup, setCatGroup] = useState('Software & IT');

  useEffect(() => {
    document.title = 'Admin Control Panel – MURTHU JOB HUB';
  }, []);

  const loadAllAdminData = async () => {
    try {
      const [ov, jbs, rpts, fb, cats, usrs, lg] = await Promise.all([
        apiFetch('/api/admin/overview'),
        apiFetch<any[]>('/api/admin/jobs'),
        apiFetch<any[]>('/api/admin/reports'),
        apiFetch<any[]>('/api/admin/feedback'),
        apiFetch<any[]>('/api/jobs/categories'),
        apiFetch<any[]>('/api/admin/users'),
        apiFetch('/api/admin/logs'),
      ]);
      setOverview(ov);
      setJobsList(jbs);
      setReports(rpts);
      setFeedbackList(fb);
      setCategories(cats);
      setUsersList(usrs);
      setLogs(lg);
    } catch {
      // handled by role guard
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAllAdminData();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Admin Control Panel</h1>
        <p className="mt-2 text-sm text-slate-400">
          Administrator sign-in required.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-5 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Access Restricted</h1>
        <p className="mt-2 text-sm text-slate-400">
          This area is strictly reserved for authorized MURTHU JOB HUB administrators.
        </p>
      </div>
    );
  }

  const handleSyncAll = async () => {
    setActionMsg('Synchronizing all enabled job sources...');
    try {
      const res = await apiFetch<{ results: any[] }>('/api/admin/sync-all', { method: 'POST' });
      const totalInserted = res.results.reduce((sum, r) => sum + (r.inserted || 0), 0);
      setActionMsg(`Sync complete: ${totalInserted} new jobs imported across active sources.`);
      await loadAllAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  const handleValidateBatch = async () => {
    setActionMsg('Running automated live HTTP validation batch...');
    try {
      const res = await apiFetch<{ checked: number; expiredCount: number }>(
        '/api/admin/validate-batch',
        { method: 'POST' }
      );
      setActionMsg(
        `Validation complete: ${res.checked} apply URLs checked, ${res.expiredCount} expired listings archived.`
      );
      await loadAllAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  const handleSerpApiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg('Querying SerpApi Google Jobs...');
    try {
      const res = await apiFetch<{ fetched: number; inserted: number; error?: string }>(
        '/api/admin/serpapi-search',
        {
          method: 'POST',
          body: JSON.stringify({ query: serpQuery, location: serpLocation }),
        }
      );
      setActionMsg(
        res.error
          ? `SerpApi Notice: ${res.error}`
          : `SerpApi imported ${res.inserted} new jobs (${res.fetched} fetched).`
      );
      await loadAllAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'SerpApi search failed');
    }
  };

  const handleCreateManualJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg('');
    try {
      await apiFetch('/api/admin/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          companyName: newCompany,
          categoryName: newCategory,
          location: newLocation,
          city: newCity,
          applyUrl: newApplyUrl,
          description: newDesc,
          sector: newSector,
          workMode: newWorkMode,
          employmentType: newEmploymentType,
          experienceLevel: newExp,
          salaryDisplay: newSalary || undefined,
          verificationStatus: 'LIVE VERIFIED',
        }),
      });
      setActionMsg('Verified job added successfully.');
      setNewTitle('');
      setNewCompany('');
      setNewApplyUrl('');
      setNewDesc('');
      await loadAllAdminData();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Failed to create job');
    }
  };

  const handleUpdateJobStatus = async (id: number, verificationStatus: string) => {
    await apiFetch(`/api/admin/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus }),
    });
    await loadAllAdminData();
  };

  const handleValidateSingle = async (id: number) => {
    const res = await apiFetch<{ newStatus: string; httpStatus: number | null }>(
      `/api/admin/jobs/${id}/validate`,
      { method: 'POST' }
    );
    setActionMsg(`Job #${id} revalidated -> ${res.newStatus} (HTTP ${res.httpStatus ?? 'N/A'})`);
    await loadAllAdminData();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await apiFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: catName, groupName: catGroup }),
    });
    setCatName('');
    await loadAllAdminData();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Admin Control Panel
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage verified jobs, external source integrations, validation scheduler, reports, and
            users.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSyncAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sync Active Sources</span>
          </button>
          <button
            type="button"
            onClick={handleValidateBatch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Run Live Validation</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs font-medium text-sky-200">
          {actionMsg}
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="mt-6 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0B1126] p-1.5">
        {(
          [
            ['overview', 'Overview'],
            ['jobs', 'Job Management'],
            ['sources', 'Sources & SerpApi'],
            ['reports', `Reports & Feedback (${overview?.stats?.openReports || 0})`],
            ['categories', 'Categories'],
            ['users', 'Users'],
            ['logs', 'System Monitoring'],
          ] as Array<[AdminTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              tab === id ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && overview && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ['Total Jobs', overview.stats.totalJobs],
              ['Live Verified', overview.stats.liveVerifiedJobs],
              ['Unverified', overview.stats.unverifiedJobs],
              ['Under Review', overview.stats.underReviewJobs],
              ['Closed Jobs', overview.stats.closedJobs],
              ['Expired Jobs', overview.stats.expiredJobs],
              ['Total Users', overview.stats.totalUsers],
              ['Companies', overview.stats.totalCompanies],
              ['Apply Clicks', overview.stats.totalClicks],
              ['Open Reports', overview.stats.openReports],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-4"
              >
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white">
                  {Number(val).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'jobs' && (
          <div className="space-y-8">
            <form
              onSubmit={handleCreateManualJob}
              className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold text-white">
                Add Verified Job Manually
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Job Title"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <input
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Company Name"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <input
                  required
                  value={newApplyUrl}
                  onChange={(e) => setNewApplyUrl(e.target.value)}
                  placeholder="Original Apply URL (https://...)"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <input
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Full Location"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="City (e.g. Hyderabad)"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <input
                  value={newSalary}
                  onChange={(e) => setNewSalary(e.target.value)}
                  placeholder="Salary (e.g. INR 6-10 LPA)"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value as 'Private' | 'Government')}
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                >
                  <option value="Private">Private</option>
                  <option value="Government">Government</option>
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newWorkMode}
                    onChange={(e) => setNewWorkMode(e.target.value as any)}
                    className="rounded-lg border border-white/10 bg-[#060918] px-2 py-2 text-xs text-white"
                  >
                    <option value="Office">Office</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                  <select
                    value={newEmploymentType}
                    onChange={(e) => setNewEmploymentType(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#060918] px-2 py-2 text-xs text-white"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Contract">Contract</option>
                  </select>
                  <select
                    value={newExp}
                    onChange={(e) => setNewExp(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#060918] px-2 py-2 text-xs text-white"
                  >
                    <option value="Fresher">Fresher</option>
                    <option value="0-1 Years">0-1 Years</option>
                    <option value="1-3 Years">1-3 Years</option>
                    <option value="3-5 Years">3-5 Years</option>
                    <option value="5-10 Years">5-10 Years</option>
                  </select>
                </div>
              </div>
              <textarea
                required
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Role responsibilities, eligibility, and official instructions..."
                className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Publish Verified Job
              </button>
            </form>

            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0C1228]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clicks</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {jobsList.map((j) => (
                    <tr key={j.id} className="text-slate-200">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{j.title}</p>
                        <p className="text-slate-400">
                          {j.companyName} · {j.city || j.location}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{j.sourceName}</td>
                      <td className="px-4 py-3 font-medium">{j.verificationStatus}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{j.clickCount}</td>
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleValidateSingle(j.id)}
                          className="text-sky-300 hover:underline"
                        >
                          Check URL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateJobStatus(j.id, 'LIVE VERIFIED')}
                          className="text-emerald-400 hover:underline"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateJobStatus(j.id, 'CLOSED')}
                          className="text-amber-400 hover:underline"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateJobStatus(j.id, 'REMOVED')}
                          className="text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'sources' && overview && (
          <div className="space-y-8">
            <form
              onSubmit={handleSerpApiSearch}
              className="rounded-xl border border-violet-500/30 bg-[#0C1228] p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold text-white">
                SerpApi Google Jobs On-Demand Fetch
              </h2>
              <p className="text-xs text-slate-400">
                Uses <span className="font-mono text-sky-300">SERPAPI_API_KEY</span> with{' '}
                <span className="font-mono">engine=google_jobs</span> to import live listings from
                LinkedIn, Naukri, Indeed, Glassdoor, Foundit, and company career pages.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  required
                  value={serpQuery}
                  onChange={(e) => setSerpQuery(e.target.value)}
                  placeholder="Query (e.g. VLSI Engineer)"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <input
                  required
                  value={serpLocation}
                  onChange={(e) => setSerpLocation(e.target.value)}
                  placeholder="Location (e.g. Hyderabad, Telangana, India)"
                  className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                >
                  Fetch via SerpApi Google Jobs
                </button>
              </div>
            </form>

            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0C1228]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Imported</th>
                    <th className="px-4 py-3">Last Success</th>
                    <th className="px-4 py-3">Notes / Errors</th>
                    <th className="px-4 py-3">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {overview.sources.map((src: any) => (
                    <tr key={src.id} className="text-slate-200">
                      <td className="px-4 py-3 font-semibold text-white">{src.name}</td>
                      <td className="px-4 py-3 font-mono">{src.status}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{src.jobsImportedCount}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-400">
                        {src.lastSuccessAt
                          ? new Date(src.lastSuccessAt).toLocaleString('en-IN')
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs">
                        {src.lastError || src.statusMessage}
                      </td>
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/sources/${src.slug}/sync`, {
                              method: 'POST',
                            });
                            await loadAllAdminData();
                          }}
                          className="text-sky-300 hover:underline"
                        >
                          Sync Now
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/sources/${src.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ isEnabled: !src.isEnabled }),
                            });
                            await loadAllAdminData();
                          }}
                          className="text-slate-300 hover:underline"
                        >
                          {src.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold text-white">Job Reports</h2>
              {reports.length === 0 ? (
                <p className="text-xs text-slate-400">No reports filed.</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="border-b border-white/[0.06] pb-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{r.jobTitle}</span>
                      <span className="font-mono text-amber-300">{r.status}</span>
                    </div>
                    <p className="text-slate-400">
                      {r.category} · {r.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reports/${r.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              status: 'RESOLVED',
                              newJobStatus: 'CLOSED',
                              adminNotes: 'Closed after investigation',
                            }),
                          });
                          await loadAllAdminData();
                        }}
                        className="rounded bg-rose-500/20 px-2.5 py-1 text-rose-300 hover:bg-rose-500/30"
                      >
                        Close Job &amp; Resolve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/reports/${r.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              status: 'DISMISSED',
                              newJobStatus: 'LIVE VERIFIED',
                              adminNotes: 'Verified still active',
                            }),
                          });
                          await loadAllAdminData();
                        }}
                        className="rounded bg-emerald-500/20 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/30"
                      >
                        Verify Active &amp; Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold text-white">User Feedback</h2>
              {feedbackList.length === 0 ? (
                <p className="text-xs text-slate-400">No feedback messages yet.</p>
              ) : (
                feedbackList.map((f) => (
                  <div key={f.id} className="border-b border-white/[0.06] pb-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {f.name} ({f.type})
                      </span>
                      <span className="font-mono text-sky-300">{f.rating}/5 ★</span>
                    </div>
                    <p className="text-slate-300">{f.message}</p>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/feedback/${f.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            status: 'RESPONDED',
                            adminResponse: 'Thank you — reviewed by MURTHU JOB HUB team.',
                          }),
                        });
                        await loadAllAdminData();
                      }}
                      className="text-violet-300 hover:underline"
                    >
                      Mark Reviewed
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateCategory}
              className="flex flex-wrap gap-3 rounded-xl border border-white/[0.08] bg-[#0C1228] p-5"
            >
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="New Category Name"
                className="flex-1 min-w-52 rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
              />
              <select
                value={catGroup}
                onChange={(e) => setCatGroup(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-xs text-white"
              >
                <option value="Software & IT">Software &amp; IT</option>
                <option value="Hardware & Core">Hardware &amp; Core</option>
                <option value="Government & Public">Government &amp; Public</option>
                <option value="Business, Operations & Work Types">
                  Business, Operations &amp; Work Types
                </option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Add Category
              </button>
            </form>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#0C1228] px-4 py-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="text-slate-400">{c.groupName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
                      await loadAllAdminData();
                    }}
                    className="text-rose-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0C1228]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {usersList.map((u) => (
                  <tr key={u.id} className="text-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{u.name}</p>
                      <p className="text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">{u.role}</td>
                    <td className="px-4 py-3">{u.isSuspended ? 'Suspended' : 'Active'}</td>
                    <td className="px-4 py-3 space-x-3">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/users/${u.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isSuspended: !u.isSuspended }),
                          });
                          await loadAllAdminData();
                        }}
                        className="text-amber-300 hover:underline"
                      >
                        {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/users/${u.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ role: u.role === 'admin' ? 'user' : 'admin' }),
                          });
                          await loadAllAdminData();
                        }}
                        className="text-sky-300 hover:underline"
                      >
                        Toggle Admin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'logs' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-3">
              <h2 className="font-display text-lg font-semibold text-white">Sync Logs</h2>
              {logs.syncLogs.map((l: any) => (
                <div key={l.id} className="border-b border-white/[0.06] pb-2.5 text-xs">
                  <p className="font-semibold text-white">
                    {l.sourceName} · {l.status}
                  </p>
                  <p className="font-mono tabular-nums text-slate-400">
                    Fetched {l.jobsFetched} · Inserted {l.jobsInserted} · Duplicates{' '}
                    {l.duplicatesSkipped} · {l.durationMs}ms
                  </p>
                  {l.errorMessage && <p className="text-rose-400">{l.errorMessage}</p>}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-3">
              <h2 className="font-display text-lg font-semibold text-white">Validation Logs</h2>
              {logs.validationLogs.map((v: any) => (
                <div key={v.id} className="border-b border-white/[0.06] pb-2.5 text-xs">
                  <p className="font-semibold text-white truncate">{v.jobTitle}</p>
                  <p className="font-mono tabular-nums text-slate-400">
                    {v.previousStatus} → {v.newStatus} · HTTP {v.httpStatus ?? 'N/A'} ·{' '}
                    {v.checkOutcome}
                  </p>
                  {v.details && <p className="text-slate-500">{v.details}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
