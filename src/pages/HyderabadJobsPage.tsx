import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import JobCard from '../components/JobCard';
import ReportJobModal from '../components/ReportJobModal';
import { apiFetch } from '../lib/api';
import type { JobItem } from '../types';

const CITY_TABS = [
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
  'International',
];

export default function HyderabadJobsPage() {
  const [selectedCity, setSelectedCity] = useState('Hyderabad');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<JobItem | null>(null);

  useEffect(() => {
    document.title = `${selectedCity} Jobs – MURTHU JOB HUB`;
    setLoading(true);
    const params = new URLSearchParams({ limit: '18' });
    if (selectedCity === 'Remote India') {
      params.set('workMode', 'Remote');
    } else {
      params.set('city', selectedCity);
    }

    apiFetch<{ items: JobItem[] }>(`/api/jobs?${params.toString()}`)
      .then((res) => setJobs(res.items))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [selectedCity]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/hyderabad_tech_corridor_1794806970345.jpg"
            alt="Hyderabad HITEC City and Indian technology corridor"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060918]/80 via-[#060918]/90 to-[#060918]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>LOCATION-BASED DISCOVERY</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {selectedCity} Career Opportunities
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Explore verified software, VLSI, embedded hardware, core engineering, government, and
            fresher roles across Hyderabad, Telangana, Andhra Pradesh, and major Indian tech hubs.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {CITY_TABS.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCity === city
                    ? 'bg-violet-600 text-white'
                    : 'border border-white/10 bg-[#0B1126]/90 text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <p className="text-sm text-slate-400">
            Showing active roles in <span className="font-semibold text-white">{selectedCity}</span>
          </p>
          <Link
            to={`/jobs?city=${encodeURIComponent(selectedCity)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200"
          >
            <span>Open Advanced Filters for {selectedCity}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-60 animate-pulse rounded-xl border border-white/[0.06] bg-[#0C1228]"
              />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0C1228] p-10 text-center">
            <h2 className="font-display text-lg font-semibold text-white">
              No active listings indexed specifically for {selectedCity} yet
            </h2>
            <p className="mt-2 max-w-xl mx-auto text-sm text-slate-400">
              Enable SerpApi Google Jobs in the Admin Panel with your SERPAPI_API_KEY to pull live
              local openings from LinkedIn, Naukri, Indeed, and company career portals for{' '}
              {selectedCity}, or browse all remote and national openings.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                to="/jobs?workMode=Remote"
                className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Browse Remote Jobs
              </Link>
              <Link
                to="/jobs"
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
              >
                All Active Jobs
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onReport={setReportTarget} />
            ))}
          </div>
        )}
      </section>

      <ReportJobModal job={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
