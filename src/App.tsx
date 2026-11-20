import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthModal from './components/AuthModal';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import SubscribeGate from './components/SubscribeGate';
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
              <Route path="/" element={<SubscribeGate><HomePage /></SubscribeGate>} />
              <Route path="/jobs" element={<SubscribeGate><JobsPage /></SubscribeGate>} />
              <Route path="/jobs/:idOrSlug" element={<SubscribeGate><JobDetailPage /></SubscribeGate>} />
              <Route path="/hyderabad-jobs" element={<SubscribeGate><HyderabadJobsPage /></SubscribeGate>} />
              <Route path="/categories" element={<SubscribeGate><CategoriesPage /></SubscribeGate>} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/dashboard" element={<UserDashboardPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
            </Routes>
          </main>
          <Footer />
          <AuthModal />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}