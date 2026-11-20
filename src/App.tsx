import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthModal from './components/AuthModal';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import AdminDashboardPage from './pages/AdminDashboardPage';
import CategoriesPage from './pages/CategoriesPage';
import FeedbackPage from './pages/FeedbackPage';
import HomePage from './pages/HomePage';
import HyderabadJobsPage from './pages/HyderabadJobsPage';
import JobDetailPage from './pages/JobDetailPage';
import JobsPage from './pages/JobsPage';
import { AboutPage, ContactPage, PrivacyPage, TermsPage } from './pages/StaticPages';
import UserDashboardPage from './pages/UserDashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col bg-[#060918] text-slate-100">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:idOrSlug" element={<JobDetailPage />} />
              <Route path="/hyderabad-jobs" element={<HyderabadJobsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/dashboard" element={<UserDashboardPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
	      <Route path="/jobs" element={<SubscribeGate><JobsPage /></SubscribeGate>} />
<Route path="/jobs/:idOrSlug" element={<SubscribeGate><JobDetailPage /></SubscribeGate>} />
<Route path="/hyderabad-jobs" element={<SubscribeGate><HyderabadJobsPage /></SubscribeGate>} />
            </Routes>
          </main>
          <Footer />
          <AuthModal />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
