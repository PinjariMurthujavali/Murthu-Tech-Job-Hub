import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { groupCategories } from '../lib/categories';
import type { CategoryItem } from '../types';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    document.title = 'Job Categories – MURTHU JOB HUB';
    apiFetch<CategoryItem[]>('/api/jobs/categories')
      .then(setCategories)
      .catch(() => setLoadError('Categories are temporarily unavailable. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.groupName.toLowerCase().includes(filter.toLowerCase())
  );

  const grouped = groupCategories(filtered);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            All Job Categories
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse <span className="font-mono tabular-nums text-white">{categories.length}</span>{' '}
            curated career tracks across Software &amp; IT, Hardware &amp; Core Engineering,
            Government, and Work Types.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter categories (e.g. VLSI, Python)"
            className="w-full rounded-lg border border-white/10 bg-[#0C1228] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      {loadError && (
        <p role="alert" className="mt-6 text-sm text-amber-200">{loadError}</p>
      )}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-56 animate-pulse rounded-xl bg-[#0C1228]" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {Object.entries(grouped).map(([groupName, items]) => (
            <section key={groupName}>
              <h2 className="font-display text-xl font-bold text-white">{groupName}</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/jobs?category=${encodeURIComponent(cat.name)}`}
                    className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#0C1228] px-4 py-3.5 hover:border-violet-500/40 hover:bg-[#101836] transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-100 truncate">{cat.name}</span>
                    <span className="ml-2 font-mono text-xs tabular-nums text-sky-300 shrink-0">
                      {cat.activeCount}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
