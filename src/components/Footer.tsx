import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#050814] text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2 space-y-3">
            <Link to="/" className="font-display text-lg font-bold tracking-tight text-white">
              MURTHU JOB HUB
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              One Platform. Thousands of Opportunities. One Dream Career. Every listing preserves
              its original employer application URL and undergoes continuous live verification.
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <h3 className="font-semibold text-white">Explore Opportunities</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/jobs" className="hover:text-white transition-colors">
                  All Active Jobs
                </Link>
              </li>
              <li>
                <Link to="/hyderabad-jobs" className="hover:text-white transition-colors">
                  Hyderabad &amp; India Hubs
                </Link>
              </li>
              <li>
                <Link to="/categories" className="hover:text-white transition-colors">
                  Browse All Categories
                </Link>
              </li>
              <li>
                <Link to="/jobs?sector=Government" className="hover:text-white transition-colors">
                  Government &amp; PSU Jobs
                </Link>
              </li>
              <li>
                <Link to="/jobs?workMode=Remote" className="hover:text-white transition-colors">
                  Remote &amp; Work From Home
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <h3 className="font-semibold text-white">Platform &amp; Trust</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/feedback" className="hover:text-white transition-colors">
                  Community Feedback
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.08] pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} MURTHU JOB HUB. All rights reserved.</p>
          <p>
            Applications open directly on the original employer or authorized recruitment platform.
          </p>
        </div>
      </div>
    </footer>
  );
}
