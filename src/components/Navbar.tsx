import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Shield, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, unreadNotifications, setAuthModalOpen } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: '/jobs', label: 'Jobs' },
    { to: '/hyderabad-jobs', label: 'Hyderabad' },
    { to: '/categories', label: 'Categories' },
    { to: '/feedback', label: 'Feedback' },
    { to: '/about', label: 'About' },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#060918]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-violet-300 transition-colors"
        >
          MURTHU JOB HUB
        </Link>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
        >
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                isActive(item.to)
                  ? 'text-white underline decoration-violet-400 decoration-2 underline-offset-8'
                  : ''
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/dashboard'}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-violet-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              {user.role === 'admin' ? (
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <User className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
                {unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hidden sm:inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-violet-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-200 hover:bg-white/5"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#0B1026] px-4 py-4 space-y-2">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-sky-300 hover:bg-white/5"
              >
                My Dashboard {unreadNotifications > 0 ? `(${unreadNotifications})` : ''}
              </Link>
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-violet-300 hover:bg-white/5"
                >
                  Admin Control Panel
                </Link>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setAuthModalOpen(true);
              }}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Sign In / Register
            </button>
          )}
        </div>
      )}
    </header>
  );
}
