import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Dices,
  UserCheck,
  Loader2,
  Star,
  Gift,
  Users,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';

// ─────────────────────────────────────────
// Onay Modalı
// ─────────────────────────────────────────
const ConfirmModal = ({
  isOpen,
  onConfirm,
  onCancel,
  selectedUser,
  isRandom,
  processing,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center border-2 border-amber-200">
              <Trophy className="w-10 h-10 text-amber-500" />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Yeni Sahibini Doğrula
            </h3>

            <p className="text-slate-500 mb-6">
              {isRandom ? (
                'Sistem bu eşya için bir katılımcıyı şans yoluyla belirleyecek. Bu işlem geri alınamaz.'
              ) : (
                <>
                  <span className="font-bold text-slate-700">
                    {selectedUser?.fullName}
                  </span>{' '}
                  isimli kullanıcıyı eşyanın yeni sahibi olarak onaylıyor
                  musunuz?
                </>
              )}
            </p>

            {!isRandom && selectedUser && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {selectedUser.avatarUrl ? (
                    <img
                      src={selectedUser.avatarUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    selectedUser.fullName?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-800">
                    {selectedUser.fullName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-xs text-slate-500">
                      {selectedUser.karmaPoint} İyilik Puanı
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={processing}
                className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={onConfirm}
                disabled={processing}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Onayla
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────
// Katılımcı Yönetim Paneli (Inline)
// ─────────────────────────────────────────
const ParticipantPanel = ({ itemId, itemTitle, selectionType, onSuccess }) => {
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    user: null,
    isRandom: false,
  });
  const { showToast } = useToast();

  useEffect(() => {
    if (itemId) {
      fetchApplicants();
    }
  }, [itemId]);

  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/giveaways/${itemId}/applicants`);
      const sortedApplicants = res.data.sort(
        (a, b) => b.karmaPoint - a.karmaPoint,
      );
      setApplicants(sortedApplicants);
    } catch (err) {
      console.error(err);
      showToast('Katılımcılar yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (user = null, isRandom = false) => {
    setConfirmModal({ open: true, user, isRandom });
  };

  const closeConfirm = () => {
    setConfirmModal({ open: false, user: null, isRandom: false });
  };

  const handleSelectWinner = async () => {
    setProcessing(true);
    try {
      const payload = confirmModal.isRandom
        ? { random: true }
        : { userId: confirmModal.user.userId };
      const res = await api.post(`/giveaways/${itemId}/select-winner`, payload);

      showToast(
        `🎉 Yeni sahibi belirlendi: ${res.data.winner.fullName}`,
        'success',
      );
      if (onSuccess) onSuccess(res.data.winner);
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || 'Seçim yapılırken hata oluştu.',
        'error',
      );
    } finally {
      setProcessing(false);
      closeConfirm();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                Katılımcı Yönetim Paneli
              </h3>
              <p className="text-sm text-slate-300">
                {loading ? '...' : `${applicants.length} kişi döngüye katıldı`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold border border-white/10">
            {selectionType === 'manual' ? '✋ Manuel Seçim' : '🎲 Çekiliş'}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-sm text-slate-400">Katılımcılar yükleniyor...</p>
          </div>
        ) : applicants.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Users className="w-10 h-10 text-slate-300" />
            </div>
            <h4 className="font-bold text-slate-600 text-lg mb-1">
              Henüz katılımcı yok
            </h4>
            <p className="text-sm text-slate-400">
              Bu döngüye henüz kimse katılmadı.
            </p>
          </div>
        ) : (
          <>
            {/* Rastgele Seçim Butonu */}
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-5 relative overflow-hidden group hover:border-violet-300 transition-all hover:shadow-md">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h3 className="font-bold text-violet-900 flex items-center gap-2 text-base">
                    <Dices className="w-5 h-5" />
                    Sisteme Bırak (Rastgele)
                  </h3>
                  <p className="text-sm text-violet-600/80 mt-1">
                    Adil ve şeffaf algoritma ile şans eseri seçim
                  </p>
                </div>
                <button
                  onClick={() => openConfirm(null, true)}
                  disabled={processing}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Şanslıyı Belirle
                </button>
              </div>
              <Dices className="absolute -bottom-6 -right-6 w-28 h-28 text-violet-100 rotate-12 group-hover:rotate-45 transition-transform duration-700" />
            </div>

            {/* Ayırıcı */}
            <div className="relative">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-sm text-slate-400 font-medium">
                  veya katılımcılardan birini seç
                </span>
              </div>
            </div>

            {/* Katılımcı Listesi */}
            <div className="space-y-3">
              {applicants.map((app, index) => (
                <motion.div
                  key={app.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-emerald-100">
                        {app.avatarUrl ? (
                          <img
                            src={app.avatarUrl}
                            alt={app.fullName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          app.fullName?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                        <span className="text-[8px] text-white">✓</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div>
                      <Link
                        to={`/profile/${app.userId}`}
                        className="font-bold text-slate-800 text-base hover:text-emerald-600 transition-colors inline-block"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {app.fullName}
                      </Link>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-medium text-slate-500">
                            {app.karmaPoint} İyilik Puanı
                          </span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-400">
                          {new Date(app.appliedAt).toLocaleDateString('tr-TR')}{' '}
                          tarihinde katıldı
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hediye Et Butonu */}
                  <button
                    onClick={() => openConfirm(app)}
                    disabled={processing}
                    className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    <Trophy className="w-4 h-4" />
                    Sahibi Yap
                  </button>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Onay Modalı */}
      <ConfirmModal
        isOpen={confirmModal.open}
        selectedUser={confirmModal.user}
        isRandom={confirmModal.isRandom}
        processing={processing}
        onConfirm={handleSelectWinner}
        onCancel={closeConfirm}
      />
    </motion.div>
  );
};

// Eski modal da export et (backward compat)
const WinnerSelectionModal = ({
  isOpen,
  onClose,
  itemId,
  itemTitle,
  onSuccess,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                Yeni Sahibini Belirle
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                "{itemTitle}" için seçim yap
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <ParticipantPanel
              itemId={itemId}
              itemTitle={itemTitle}
              onSuccess={(winner) => {
                if (onSuccess) onSuccess();
                onClose();
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export { ParticipantPanel };
export default WinnerSelectionModal;
