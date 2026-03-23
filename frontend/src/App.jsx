import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import ItemDetail from './pages/ItemDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PublicProfile from './pages/PublicProfile';
import Messages from './pages/Messages';
import Trades from './pages/Trades';
import TradeDetailPage from './pages/TradeDetailPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Gift, User, LogOut, MessageCircle, Heart } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingChatWidget from './components/FloatingChatWidget';
import NotificationBell from './components/NotificationBell';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import HowItWorks from './pages/HowItWorks';
import About from './pages/About';
import FAQ from './pages/FAQ';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import logo from './assets/dongu-.png';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutModal(false);
  };

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm">
      <div className="w-full px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center justify-center group -ml-2 h-full pb-1"
        >
          <img
            src={logo}
            alt="Sistem Logosu"
            className="h-[64px] scale-[1.5] origin-center w-auto mix-blend-multiply brightness-[1.05] contrast-[1.1] object-contain group-hover:scale-[1.55] transition-transform"
          />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-[15px] font-medium text-slate-600">
          <Link to="/" className="hover:text-emerald-600 transition">
            Vitrin
          </Link>
          <Link
            to="/how-it-works"
            className="hover:text-emerald-600 transition"
          >
            Nasıl Çalışır?
          </Link>
          <Link to="/about" className="hover:text-emerald-600 transition">
            Hakkımızda
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-5 border-l border-slate-200/60 pl-5 pr-2">
              <NotificationBell />
              <Link
                to="/messages"
                className="hover:text-emerald-600 transition text-sm font-medium text-slate-600"
              >
                Sohbetler
              </Link>
              <Link
                to="/trades"
                className="hover:text-emerald-600 transition text-sm font-medium text-slate-600"
              >
                Takaslar
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition border border-slate-200/50"
              >
                <div className="w-7 h-7 bg-slate-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'M'}
                </div>
                <span className="text-slate-700 font-medium text-sm whitespace-nowrap">
                  {user?.fullName || 'Mehmet Y.'}
                </span>
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2 rounded-full hover:bg-emerald-600 transition shadow-md shadow-emerald-500/20 font-medium text-sm"
              >
                Döngüye Kat
                <Heart className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1"
                title="Döngüden Ayrıl"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-5 border-l border-slate-200/60 pl-5 pr-2">
              <Link
                to="/login"
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Giriş Yap
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2 rounded-full hover:bg-emerald-600 transition shadow-md shadow-emerald-500/20 font-medium text-sm"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600">
              <LogOut className="w-6 h-6 ml-1" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-8 font-[Outfit] text-center">
              Bir süreliğine döngüden ayrılıyor musun?
            </h3>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition active:scale-95"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative">
              <ScrollToTop />
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/items/:id" element={<ItemDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/trades" element={<Trades />} />
                <Route path="/trades/:tradeId" element={<TradeDetailPage />} />
                <Route path="/profile/:id" element={<PublicProfile />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/about" element={<About />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
              </Routes>
              <FloatingChatWidget />
              <Footer />
            </div>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
