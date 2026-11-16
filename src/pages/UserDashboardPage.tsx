import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, LogOut, Plus, Shield, Trash2, Upload } from 'lucide-react';
import JobCard from '../components/JobCard';
import { useAuth } from '../context/AuthContext';
import { apiFetch, getApiAuthToken } from '../lib/api';
import type { JobItem } from '../types';

type DashboardTab = 'saved' | 'viewed' | 'alerts' | 'notifications' | 'profile' | 'activity';

interface JobAlertRow {
  id: number;
  title: string;
  keywords: string | null;
  location: string | null;
  category: string | null;
  experienceLevel: string | null;
  workMode: string | null;
  sector: string | null;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  isActive: boolean;
}

interface NotificationRow {
  id: number;
  jobId: number | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function UserDashboardPage() {
  const { user, profile, logout, refreshSession, setAuthModalOpen } = useAuth();
  const [tab, setTab] = useState<DashboardTab>('saved');

  const [savedJobs, setSavedJobs] = useState<JobItem[]>([]);
  const [viewedJobs, setViewedJobs] = useState<JobItem[]>([]);
  const [alerts, setAlerts] = useState<JobAlertRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [activity, setActivity] = useState<{ reports: any[]; feedback: any[] }>({
    reports: [],
    feedback: [],
  });

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [qualification, setQualification] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [preferredCategoriesText, setPreferredCategoriesText] = useState('');
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);

  // New alert form
  const [alertTitle, setAlertTitle] = useState('');
  const [alertKeywords, setAlertKeywords] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [alertCategory, setAlertCategory] = useState('');
  const [alertEmail, setAlertEmail] = useState(true);
  const [alertInApp, setAlertInApp] = useState(true);

  useEffect(() => {
    document.title = 'Candidate Dashboard – MURTHU JOB HUB';
  }, []);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    if (profile) {
      setPhone(profile.phone || '');
      setHeadline(profile.headline || '');
      setQualification(profile.qualification || '');
      setExperienceYears(profile.experienceYears || '');
      setSkillsText((profile.skills || []).join(', '));
      setPreferredLocation(profile.preferredLocation || '');
      setPreferredCategoriesText((profile.preferredCategories || []).join(', '));
      setBio(profile.bio || '');
    }

    Promise.all([
      apiFetch<JobItem[]>('/api/user/saved-jobs'),
      apiFetch<JobItem[]>('/api/user/viewed-jobs'),
      apiFetch<JobAlertRow[]>('/api/user/alerts'),
      apiFetch<NotificationRow[]>('/api/user/notifications'),
      apiFetch<{ reports: any[]; feedback: any[] }>('/api/user/activity'),
    ])
      .then(([s, v, a, n, act]) => {
        setSavedJobs(s);
        setViewedJobs(v);
        setAlerts(a);
        setNotifications(n);
        setActivity(act);
      })
      .catch(() => {});
  }, [user, profile]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Candidate Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to manage saved jobs, resume profile, personalized job alerts, and notifications.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    await apiFetch('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name,
        phone,
        headline,
        qualification,
        experienceYears,
        skills: skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredLocation,
        preferredCategories: preferredCategoriesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        bio,
      }),
    });
    await refreshSession();
    setProfileMsg('Profile saved successfully.');
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    setProfileMsg('');
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const token = getApiAuthToken();
      const res = await fetch('/api/user/resume', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await refreshSession();
      setProfileMsg(`Resume "${file.name}" uploaded.`);
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Resume upload failed.');
    } finally {
      setResumeUploading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim()) return;
    const created = await apiFetch<JobAlertRow>('/api/user/alerts', {
      method: 'POST',
      body: JSON.stringify({
        title: alertTitle,
        keywords: alertKeywords || null,
        location: alertLocation || null,
        category: alertCategory || null,
        emailEnabled: alertEmail,
        inAppEnabled: alertInApp,
      }),
    });
    setAlerts((prev) => [created, ...prev]);
    setAlertTitle('');
    setAlertKeywords('');
    setAlertLocation('');
    setAlertCategory('');
  };

  const handleDeleteAlert = async (id: number) => {
    await apiFetch(`/api/user/alerts/${id}`, { method: 'DELETE' });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleMarkNotificationsRead = async () => {
    await apiFetch('/api/user/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await refreshSession();
  };

  const tabs: Array<{ id: DashboardTab; label: string }> = [
    { id: 'saved', label: `Saved (${savedJobs.length})` },
    { id: 'viewed', label: `Recently Viewed (${viewedJobs.length})` },
    { id: 'alerts', label: `Job Alerts (${alerts.length})` },
    { id: 'notifications', label: `Notifications (${notifications.filter((n) => !n.isRead).length})` },
    { id: 'profile', label: 'Profile & Resume' },
    { id: 'activity', label: 'Reports & Feedback' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Welcome, {user.name}
          </h1>
          <p className="mt-1 text-xs text-slate-400">{user.email}</p>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3.5 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
            >
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Admin Panel</span>
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0B1126] p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              tab === t.id
                ? 'bg-violet-600 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'saved' && (
          <div>
            {savedJobs.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-10 text-center">
                <p className="text-sm text-slate-300">No saved jobs yet.</p>
                <Link
                  to="/jobs"
                  className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Browse Verified Jobs
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {savedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={{ ...job, skills: job.skills || [] }}
                    isSaved
                    onToggleSave={(jobId, next) => {
                      if (!next) setSavedJobs((prev) => prev.filter((j) => j.id !== jobId));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'viewed' && (
          <div>
            {viewedJobs.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-10 text-center text-sm text-slate-400">
                Jobs you open will appear here for quick reference.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {viewedJobs.map((job) => (
                  <JobCard key={job.id} job={{ ...job, skills: job.skills || [] }} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'alerts' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <form
              onSubmit={handleCreateAlert}
              className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4 h-fit"
            >
              <h2 className="font-display text-lg font-semibold text-white">Create Job Alert</h2>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Alert Name</label>
                <input
                  type="text"
                  required
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  placeholder="e.g. Python Developer in Hyderabad"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Keywords / Skill</label>
                <input
                  type="text"
                  value={alertKeywords}
                  onChange={(e) => setAlertKeywords(e.target.value)}
                  placeholder="Python, Embedded, VLSI..."
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Preferred City</label>
                  <input
                    type="text"
                    value={alertLocation}
                    onChange={(e) => setAlertLocation(e.target.value)}
                    placeholder="Hyderabad, Remote"
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={alertCategory}
                    onChange={(e) => setAlertCategory(e.target.value)}
                    placeholder="Software Developer"
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-5 text-xs text-slate-300 pt-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertInApp}
                    onChange={(e) => setAlertInApp(e.target.checked)}
                    className="accent-violet-600"
                  />
                  In-App Notifications
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.checked)}
                    className="accent-violet-600"
                  />
                  Email Preference
                </label>
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create Personalized Alert</span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-8 text-center text-sm text-slate-400">
                  No personalized job alerts configured yet.
                </div>
              ) : (
                alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#0C1228] p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{a.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {[a.keywords, a.location, a.category].filter(Boolean).join(' · ') ||
                          'All matching roles'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlert(a.id)}
                      aria-label="Delete alert"
                      className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">Alert Notifications</h2>
              <button
                type="button"
                onClick={handleMarkNotificationsRead}
                className="text-xs font-medium text-sky-300 hover:text-sky-200"
              >
                Mark all as read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-10 text-center text-sm text-slate-400">
                <Bell className="mx-auto mb-2 h-6 w-6 text-slate-500" />
                No new job alert notifications yet.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-4 ${
                      n.isRead
                        ? 'border-white/[0.06] bg-[#0C1228]'
                        : 'border-violet-500/40 bg-violet-500/10'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{n.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono tabular-nums">
                        {new Date(n.createdAt).toLocaleString('en-IN')}
                      </span>
                      {n.jobId && (
                        <Link to={`/jobs/${n.jobId}`} className="text-sky-300 hover:underline">
                          View Job
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <form
              onSubmit={handleSaveProfile}
              className="lg:col-span-8 rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold text-white">Candidate Profile</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="B.Tech ECE, MCA, B.Sc..."
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Experience</label>
                  <input
                    type="text"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="Fresher / 2 Years"
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Preferred Location</label>
                  <input
                    type="text"
                    value={preferredLocation}
                    onChange={(e) => setPreferredLocation(e.target.value)}
                    placeholder="Hyderabad, Bengaluru, Remote"
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Headline</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Full Stack & Cloud Engineer"
                    className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Python, React, Embedded C, VLSI"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Preferred Categories (comma-separated)
                </label>
                <input
                  type="text"
                  value={preferredCategoriesText}
                  onChange={(e) => setPreferredCategoriesText(e.target.value)}
                  placeholder="Software Developer, Python Developer"
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Summary / Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#060918] px-3 py-2 text-sm text-white"
                />
              </div>
              {profileMsg && <p className="text-xs text-emerald-400">{profileMsg}</p>}
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Save Profile
              </button>
            </form>

            <div className="lg:col-span-4 rounded-xl border border-white/[0.08] bg-[#0C1228] p-6 space-y-4 h-fit">
              <h2 className="font-display text-lg font-semibold text-white">Resume Upload</h2>
              <p className="text-xs text-slate-400">
                Upload PDF, DOC, or DOCX (max 5MB). Stored privately for your candidate profile.
              </p>
              {profile?.resumeFilename && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  Current Resume: <span className="font-medium">{profile.resumeFilename}</span>
                </div>
              )}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-[#060918] px-4 py-6 text-xs font-medium text-slate-300 hover:border-violet-500/50">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{resumeUploading ? 'Uploading...' : 'Select Resume File'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6">
              <h2 className="font-display text-lg font-semibold text-white">Reported Jobs</h2>
              {activity.reports.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">No job reports submitted.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {activity.reports.map((r) => (
                    <div key={r.id} className="border-b border-white/[0.06] pb-3 text-xs">
                      <p className="font-semibold text-white">
                        {r.jobTitle} ({r.companyName})
                      </p>
                      <p className="mt-1 text-slate-400">
                        {r.category} · Status: <span className="text-sky-300">{r.status}</span>
                      </p>
                      {r.adminNotes && <p className="mt-1 text-emerald-300">Admin: {r.adminNotes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-6">
              <h2 className="font-display text-lg font-semibold text-white">Feedback History</h2>
              {activity.feedback.length === 0 ? (
                <p className="mt-4 text-xs text-slate-400">No general feedback submitted yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {activity.feedback.map((f) => (
                    <div key={f.id} className="border-b border-white/[0.06] pb-3 text-xs">
                      <p className="font-semibold text-white">
                        {f.type} · {f.rating}/5 Stars
                      </p>
                      <p className="mt-1 text-slate-300">{f.message}</p>
                      {f.adminResponse && (
                        <p className="mt-1 text-emerald-300">Response: {f.adminResponse}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
