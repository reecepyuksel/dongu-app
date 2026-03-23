import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  ArrowLeft,
  Check,
  X,
  Package,
  ArrowLeftRight,
  MessageSquare,
  User,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TradeChat from '../components/TradeChat';

// ── Image with loading skeleton ──────────────────────────────────────────────
const TradeImage = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-slate-100">
      {/* Loading skeleton */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-slate-300 rounded-full"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      )}

      {src && !error ? (
        <img
          src={src}
          alt={alt}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl opacity-50">
          📦
        </div>
      )}
    </div>
  );
};

TradeImage.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string.isRequired,
};

// ── Status badge ─────────────────────────────────────────────────────────────
const statusConfig = {
  pending: {
    label: 'Beklemede',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  accepted: {
    label: 'Kabul Edildi',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Reddedildi',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

// ── Main page ─────────────────────────────────────────────────────────────────
const TradeDetailPage = () => {
  const { tradeId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // ── Fetch trade offer ──────────────────────────────────────────────────────
  const fetchOffer = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/messages/trade-offer/${tradeId}`);
      setOffer(res.data);
    } catch (err) {
      console.error('Trade offer fetch error:', err);
      showToast('Takas teklifi yüklenemedi.', 'error');
      navigate('/trades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/login');
      } else {
        fetchOffer();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, tradeId]);

  // ── Accept / Reject ────────────────────────────────────────────────────────
  const handleResponse = async (status) => {
    if (processing) return;
    try {
      setProcessing(true);
      await api.post(`/messages/trade-offer/${tradeId}/respond`, { status });
      showToast(
        status === 'accepted'
          ? '🎉 Takas kabul edildi!'
          : '❌ Takas reddedildi.',
        'success',
      );
      fetchOffer();
    } catch (err) {
      showToast(err.response?.data?.message || 'İşlem başarısız.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const isReceiver = offer?.receiver?.id === user?.id;
  const isPending = offer?.tradeStatus === 'pending';
  const status = statusConfig[offer?.tradeStatus] || statusConfig.pending;

  // The "offered item" photo: prefer tradeMediaUrl, fallback to offeredItem.imageUrl
  const offeredPhotoUrl =
    offer?.tradeMediaUrl ||
    offer?.offeredItem?.imageUrl ||
    offer?.photoUrl ||
    null;
  // The "target item" photo
  const targetPhotoUrl = offer?.item?.imageUrl || null;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-3xl border border-slate-100 bg-white"
          />
        ))}
      </div>
    );
  }

  if (!offer) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Back button */}
      <button
        onClick={() => navigate('/trades')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-600 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Takas Paneline Dön
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── LEFT COLUMN: Sticky trade info + action buttons ── */}
        <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
          {/* Header */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
                  Takas Teklifi
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${status.className}`}
                  >
                    {status.label}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {offer.createdAt &&
                      formatDistanceToNow(new Date(offer.createdAt), {
                        addSuffix: true,
                        locale: tr,
                      })}
                  </span>
                </div>
              </div>
            </div>

            {/* Two items comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Offered item */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Teklif Edilen
                </p>
                <TradeImage src={offeredPhotoUrl} alt="Teklif edilen eşya" />
                <p className="mt-2 text-sm font-bold text-slate-800 line-clamp-2">
                  {offer.offeredItem?.title || offer.content || 'Manuel Teklif'}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <User className="h-3 w-3" />
                  {offer.sender?.fullName || 'Bilinmiyor'}
                </p>
              </div>

              {/* Target item */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  İstenen
                </p>
                <TradeImage src={targetPhotoUrl} alt="İstenen eşya" />
                <p className="mt-2 text-sm font-bold text-slate-800 line-clamp-2">
                  {offer.item?.title || 'İlan'}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <User className="h-3 w-3" />
                  {offer.receiver?.fullName || 'Bilinmiyor'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Trade-specific chat ── */}
        <div className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[520px]">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Takas Sohbeti</p>
              <p className="text-xs text-slate-400">
                Sadece bu takasa ait mesajlar
              </p>
            </div>
          </div>

          {/* Action buttons / trade state - directly above chat */}
          {isReceiver && isPending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b border-slate-100 bg-slate-50 px-5 py-4"
            >
              <p className="mb-3 text-sm font-semibold text-slate-600">
                Bu teklifi kabul etmek veya reddetmek ister misin?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleResponse('rejected')}
                  disabled={processing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Reddet
                </button>
                <button
                  type="button"
                  onClick={() => handleResponse('accepted')}
                  disabled={processing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Takas Kabul Edildi
                </button>
              </div>
            </motion.div>
          )}

          {offer.tradeStatus === 'accepted' && (
            <div className="border-b border-slate-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
              🎉 Takas iki tarafça onaylandı. Teslimat detaylarını sohbetten
              netleştirebilirsiniz.
            </div>
          )}

          {offer.tradeStatus === 'rejected' && (
            <div className="border-b border-slate-100 bg-red-50 px-5 py-3 text-sm font-medium text-red-700">
              ❌ Takas reddedildi.
            </div>
          )}

          {/* Chat component */}
          <div className="flex-1 min-h-0 flex flex-col">
            <TradeChat tradeId={tradeId} tradeStatus={offer.tradeStatus} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeDetailPage;
