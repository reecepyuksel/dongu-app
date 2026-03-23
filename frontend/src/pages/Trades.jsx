import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  MessageCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

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

const Trades = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('incoming');
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
    title: '',
  });

  const normalizeOffer = (offer) => ({
    ...offer,
    photoUrl:
      offer.photos?.[0] ||
      offer.photoUrl ||
      offer.tradeMediaUrl ||
      offer.offeredItem?.imageUrl ||
      null,
    partner: offer.sender?.id === user?.id ? offer.receiver : offer.sender,
  });

  const fetchOffers = async (showLoad = true) => {
    try {
      if (showLoad) setLoading(true);
      const response = await api.get('/messages/my-trade-offers');
      console.log('GET /messages/my-trade-offers sonucu:', response.data);
      const normalized = response.data.map(normalizeOffer);
      console.log('Normalize edilmiş teklifler:', normalized);
      setOffers(normalized);
    } catch (error) {
      console.error('Trade offers could not be loaded', error);
      showToast('Takas teklifleri yüklenemedi.', 'error');
    } finally {
      if (showLoad) setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/login');
      } else {
        fetchOffers();
      }
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Real-time: takas durumu değişince listeyi yenile
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !isAuthenticated) return;

    let userId;
    try {
      userId = JSON.parse(atob(token.split('.')[1]))?.sub;
    } catch {
      return;
    }
    if (!userId) return;

    const sock = io(
      import.meta.env.VITE_API_URL?.replace('/api', '') ||
        'http://localhost:3005',
      { query: { userId } },
    );

    sock.on('newMessage', (msg) => {
      // Takas teklifi veya takas sohbet mesajı geldiğinde listeyi sessizce yenile
      if (msg?.isTradeOffer || msg?.tradeOfferId) {
        fetchOffers(false);
      }
    });

    return () => sock.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const incomingOffers = useMemo(
    () => offers.filter((offer) => offer.receiver?.id === user?.id),
    [offers, user?.id],
  );

  const outgoingOffers = useMemo(
    () => offers.filter((offer) => offer.sender?.id === user?.id),
    [offers, user?.id],
  );

  const closeLightbox = () => {
    setLightbox({ open: false, images: [], index: 0, title: '' });
  };

  const openLightbox = (offer, defaultTitle) => {
    const images = (
      offer.photos && offer.photos.length > 0 ? offer.photos : [offer.photoUrl]
    ).filter(Boolean);

    if (!images.length) return;

    setLightbox({
      open: true,
      images,
      index: 0,
      title: defaultTitle,
    });
  };

  const goPrevImage = () => {
    setLightbox((prev) => {
      const len = prev.images.length;
      if (len <= 1) return prev;
      return { ...prev, index: (prev.index - 1 + len) % len };
    });
  };

  const goNextImage = () => {
    setLightbox((prev) => {
      const len = prev.images.length;
      if (len <= 1) return prev;
      return { ...prev, index: (prev.index + 1) % len };
    });
  };

  useEffect(() => {
    if (!lightbox.open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
      }
      if (e.key === 'ArrowLeft') {
        goPrevImage();
      }
      if (e.key === 'ArrowRight') {
        goNextImage();
      }
    };

    window.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [lightbox.open]);

  const handleTradeResponse = async (offerId, status) => {
    try {
      setProcessingId(offerId);
      await api.post(`/messages/trade-offer/${offerId}/respond`, { status });
      showToast(
        status === 'accepted'
          ? 'Takas teklifi kabul edildi.'
          : 'Takas teklifi reddedildi.',
        'success',
      );
      fetchOffers(false);
    } catch (error) {
      showToast(
        error.response?.data?.message || 'Takas teklifi güncellenemedi.',
        'error',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const renderEmptyState = (type) => (
    <div className="rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Inbox className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 font-[Outfit]">
        {type === 'incoming'
          ? 'Henüz gelen teklif yok'
          : 'Henüz gönderdiğin teklif yok'}
      </h2>
      <p className="mt-2 text-sm font-medium text-slate-500">
        {type === 'incoming'
          ? 'İlanlarına gelen teklifler burada listelenecek.'
          : 'Başka ilanlara yaptığın teklifler ve durumları burada görünecek.'}
      </p>
    </div>
  );

  const renderOfferCard = (offer, type) => {
    console.log('Render edilen teklif:', offer);
    const status = statusConfig[offer.tradeStatus] || statusConfig.pending;
    const isPendingIncoming =
      type === 'incoming' && offer.tradeStatus === 'pending';
    const offerTitle = offer.offeredItem?.title || offer.content;

    return (
      <motion.article
        key={offer.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md cursor-pointer"
        onClick={() => navigate(`/trades/${offer.id}`)}
      >
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {offer.photoUrl ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openLightbox(offer, offerTitle);
                }}
                className="h-full w-full"
                title="Fotoğrafı büyüt"
              >
                <img
                  src={offer.photoUrl}
                  alt={offerTitle}
                  className="h-full w-full object-cover cursor-zoom-in"
                />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl opacity-60">
                📦
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold text-slate-900 font-[Outfit]">
                {type === 'incoming'
                  ? offer.sender?.fullName || 'Bilinmeyen kullanıcı'
                  : offer.partner?.fullName || 'Bilinmeyen kullanıcı'}
              </p>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-700">
              {offerTitle}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {type === 'incoming'
                ? `${offer.item?.title} ilanına teklif verdi`
                : `${offer.item?.title} ilanına gönderildi`}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(
                  new Date(
                    offer.createdAt.endsWith('Z')
                      ? offer.createdAt
                      : `${offer.createdAt}Z`,
                  ),
                  { addSuffix: true, locale: tr },
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-500">
            {type === 'incoming'
              ? 'Bu teklifi takas panelinden yönetebilirsin.'
              : 'Teklif durumun burada güncel tutulur.'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {isPendingIncoming && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTradeResponse(offer.id, 'rejected');
                  }}
                  disabled={processingId === offer.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Reddet
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTradeResponse(offer.id, 'accepted');
                  }}
                  disabled={processingId === offer.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Kabul Et
                </button>
              </>
            )}

            <Link
              to={`/trades/${offer.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              Takas Detayı
            </Link>
          </div>
        </div>
      </motion.article>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-3xl border border-slate-100 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm text-slate-400 transition hover:text-emerald-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Geri Dön
      </button>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-600">
            Takas Paneli
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-900 font-[Outfit]">
            Merkezi Takas Yönetimi
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Gelen teklifleri yönet, gönderdiklerinin durumunu ayrı sekmelerde
            takip et.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOffers(false)}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </button>
      </div>

      <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('incoming')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
            activeTab === 'incoming'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Gelen Teklifler ({incomingOffers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('outgoing')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
            activeTab === 'outgoing'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Giden Teklifler ({outgoingOffers.length})
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'incoming'
          ? incomingOffers.length === 0
            ? renderEmptyState('incoming')
            : incomingOffers.map((offer) => renderOfferCard(offer, 'incoming'))
          : outgoingOffers.length === 0
            ? renderEmptyState('outgoing')
            : outgoingOffers.map((offer) => renderOfferCard(offer, 'outgoing'))}
      </div>

      <AnimatePresence>
        {lightbox.open && (
          <motion.div
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
          >
            <motion.div
              className="relative w-full max-w-6xl"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeLightbox}
                className="absolute -top-3 -right-3 z-10 rounded-full bg-white/95 p-2 text-slate-800 shadow-xl hover:bg-white"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>

              {lightbox.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 p-2 text-slate-800 shadow-lg hover:bg-white"
                    title="Önceki fotoğraf"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 p-2 text-slate-800 shadow-lg hover:bg-white"
                    title="Sonraki fotoğraf"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              <div className="rounded-2xl bg-black/30 border border-white/20 p-3">
                <img
                  src={lightbox.images[lightbox.index]}
                  alt={lightbox.title || 'Takas görseli'}
                  className="w-full max-h-[84vh] object-contain"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-white/80 px-1">
                <span className="truncate max-w-[70%]">{lightbox.title}</span>
                <span>
                  {lightbox.index + 1} / {lightbox.images.length}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Trades;
