import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  ShieldCheck,
  Heart,
  RefreshCw,
  ArrowLeft,
  Calendar,
  MessageCircle,
  Truck,
  Trophy,
  Gift,
  CheckCircle,
  Camera,
  X,
  ChevronRight,
  ChevronLeft,
  Trash2,
} from 'lucide-react';
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DeliveryConfirmModal from '../components/DeliveryConfirmModal';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';

import WinnerSelectionModal, {
  ParticipantPanel,
} from '../components/WinnerSelectionModal';
import TradeOfferModal from '../components/TradeOfferModal';

const ItemDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, fetchUser } = useAuth();
  const { showToast } = useToast();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [joining, setJoining] = useState(false);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [requestConfirmOpen, setRequestConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publicOffers, setPublicOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Scroll lock — delete confirm modal
  useEffect(() => {
    if (!deleteConfirmOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [deleteConfirmOpen]);

  const fetchItem = async () => {
    try {
      const response = await api.get(`/items/${id}`);
      setItem(response.data);

      if (isAuthenticated && response.data.owner?.id !== user?.id) {
        try {
          const checkRes = await api.get(`/giveaways/${id}/check-application`);
          setIsJoined(checkRes.data.applied);
        } catch (e) {
          // silently pass
        }
      }

      if (isAuthenticated) {
        try {
          const favRes = await api.get(`/favorites/${id}/check`);
          setIsFavorited(favRes.data.isFavorited);
        } catch (e) {
          // silently pass
        }
      }

      if (response.data.shareType === 'exchange') {
        setLoadingOffers(true);
        try {
          const offersRes = await api.get(`/messages/item/${id}/trade-offers`);
          setPublicOffers(offersRes.data);
        } catch (e) {
          console.error('Error fetching trade offers:', e);
        } finally {
          setLoadingOffers(false);
        }
      }
    } catch (error) {
      console.error('Error fetching item:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
  }, [id, isAuthenticated]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [id, item?.images?.length]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      showToast('Döngüye katılmak için giriş yapmalısınız.', 'info');
      navigate('/login');
      return;
    }

    setJoining(true);
    try {
      await api.post(`/giveaways/${id}/apply`);
      setIsJoined(true);
      fetchUser();
      showToast('Harika! Döngüye başarıyla katıldın! 🎉', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Bir hata oluştu.';
      if (msg.includes('already applied')) {
        setIsJoined(true);
        showToast('Bu döngüye zaten katılmışsınız.', 'info');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleBendeVarClick = async () => {
    if (!isAuthenticated) {
      showToast('Mesaj göndermek için giriş yapmalısınız.', 'info');
      navigate('/login');
      return;
    }

    setRequestConfirmOpen(true);
  };

  const confirmStartRequestChat = () => {
    setRequestConfirmOpen(false);

    navigate(
      `/chat?partnerId=${item.owner.id}&partnerName=${encodeURIComponent(item.owner.fullName)}&itemId=${item.id}&itemTitle=${encodeURIComponent(item.title)}`,
    );
  };

  const handleFavoriteToggle = async () => {
    if (!isAuthenticated) {
      showToast('Favorilere eklemek için giriş yapmalısınız.', 'info');
      navigate('/login');
      return;
    }

    try {
      const res = await api.post(`/favorites/${id}`);
      setIsFavorited(res.data.isFavorited);
      if (res.data.isFavorited) {
        showToast('Favorilere eklendi ❤️', 'success');
      } else {
        showToast('Favorilerden çıkarıldı', 'info');
      }
    } catch (err) {
      showToast('Favori işlemi başarısız oldu.', 'error');
    }
  };

  const handleDeliveryUpdate = async (status) => {
    try {
      await api.patch(`/items/${id}/delivery-status`, { status });
      setItem((prev) => ({ ...prev, deliveryStatus: status }));
      if (status === 'DELIVERED') fetchUser();
      const labels = {
        SHIPPED: 'Kargoya verildi!',
        DELIVERED: 'Teslim alındı!',
      };
      showToast(labels[status] || 'Durum güncellendi.', 'success');
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Durum güncellenemedi.',
        'error',
      );
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/giveaways/${id}`);
      showToast(
        'Eşyayı döngüden çıkardık, her zaman yeni şeyler ekleyebilirsin! ✨',
        'success',
      );
      navigate('/');
    } catch (err) {
      showToast(
        err.response?.data?.message || 'İlanı kaldırırken bir hata oluştu.',
        'error',
      );
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-pulse text-emerald-600 font-medium">
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] text-center">
        <p className="text-slate-500 text-lg">Bu eşyaya şu an ulaşılamıyor.</p>
        <Link to="/" className="mt-4 text-emerald-600 hover:underline">
          Vitrine Geri Dön
        </Link>
      </div>
    );
  }
  const timeLeft = item.drawDate
    ? formatDistanceToNow(new Date(item.drawDate), { locale: tr })
    : null;
  const participants = item.applicationsCount ?? item.applications?.length ?? 0;
  const ownerName = item.owner?.fullName || 'Anonim Gönüllü';
  const ownerInitial = ownerName.charAt(0).toUpperCase();

  const isEnded =
    item.status === 'GIVEN_AWAY' ||
    item.status === 'DRAW_PENDING' ||
    (item.drawDate && new Date(item.drawDate) < new Date());
  const timeAgoStr = item.drawDate
    ? formatDistanceToNow(new Date(item.drawDate), { locale: tr })
    : '';
  const postedAgoStr = item.createdAt
    ? formatDistanceToNow(new Date(item.createdAt), {
        locale: tr,
        addSuffix: true,
      })
    : '';

  const isOwner = user?.id === item.owner?.id;
  const isWinner = user?.id === item.winner?.id;
  const canChat = isAuthenticated && !isOwner;
  const itemImages =
    item.images && item.images.length > 0
      ? item.images
      : [
          item.postType === 'REQUESTING'
            ? 'https://placehold.co/800x600/EFF6FF/2563EB?text=📸+Görsel+Bulunmuyor\nBu+ilan+bir+ihtiyaç+talebiveya+aranıyor+ilanıdır.&font=Outfit'
            : item.imageUrl ||
              'https://via.placeholder.com/800x600?text=Gorsel+Yok',
        ];
  const activeImage = itemImages[currentImageIndex] || itemImages[0];
  const tradeOfferCount = publicOffers.length;
  const tradeOfferLabel = `🔥 ${tradeOfferCount} kişi takas teklifi verdi`;

  const isPickupOnly =
    item.deliveryMethods &&
    item.deliveryMethods.length > 0 &&
    item.deliveryMethods.every((m) => m === 'pickup');

  const deliverySteps = isPickupOnly
    ? [
        { key: 'PENDING', label: 'Yeni Sahibi Belirlendi', icon: '🎉' },
        { key: 'DELIVERED', label: 'Elden Teslim Edildi', icon: '🤝' },
      ]
    : [
        { key: 'PENDING', label: 'Yeni Sahibi Belirlendi', icon: '🎉' },
        { key: 'SHIPPED', label: 'Kargolandı', icon: '📦' },
        { key: 'DELIVERED', label: 'Teslim Alındı', icon: '✅' },
      ];

  const currentDeliveryIndex = deliverySteps.findIndex(
    (s) => s.key === item.deliveryStatus,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 relative">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition mb-6 md:mb-8 hover:bg-slate-50 px-3 py-1.5 rounded-full w-fit group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium text-sm">Vitrine Dön</span>
      </button>

      {/* Owner Actions - Delete Button */}
      {isOwner && item.status === 'AVAILABLE' && (
        <div className="absolute top-8 md:top-12 right-4 md:right-8 flex items-center gap-3">
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-all border border-red-100 flex items-center gap-2 font-bold text-sm shadow-sm"
            title="Döngüyü Bitir / Kaldır"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden md:inline">İlanı Kaldır</span>
          </button>
        </div>
      )}

      {/* Owner Actions - Time Up */}
      {isOwner && item.status === 'DRAW_PENDING' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-5 animate-in fade-in slide-in-from-top-4 duration-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-amber-800 text-lg tracking-tight">
                Süre Doldu!
              </h3>
              <p className="text-amber-700 text-sm md:text-base font-medium">
                Yeni sahibini belirlemek için seçim sonuçlarını onaylamanız
                gerekiyor.
              </p>
            </div>
          </div>
          <button
            onClick={() => setWinnerModalOpen(true)}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Yeni Sahibini Belirle
          </button>
        </div>
      )}

      {/* 🏆 Winner Experience Banner */}
      {isWinner &&
        item.status === 'GIVEN_AWAY' &&
        item.shareType !== 'exchange' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-3xl overflow-hidden border border-emerald-100 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 shadow-sm"
          >
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200 shadow-inner shrink-0 text-3xl">
                  🎉
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-emerald-900 font-[Outfit] tracking-tight">
                    Tebrikler, Yeni Sahibi Sizsiniz! 🎉
                  </h2>
                  <p className="text-sm md:text-base text-emerald-700 font-medium leading-tight mt-1">
                    Bu eşyanın yeni yolculuğu sizinle başlıyor. Teslimat için
                    ilan sahibiyle iletişime geçin.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfirmModalOpen(true)}
                  className="px-6 py-3.5 bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-bold rounded-[14px] shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <CheckCircle className="w-5 h-5" />
                  Eşyayı Teslim Aldım
                </button>
                <button
                  onClick={() =>
                    navigate(
                      `/chat?partnerId=${item.owner.id}&partnerName=${encodeURIComponent(item.owner.fullName)}&itemId=${item.id}&itemTitle=${encodeURIComponent(item.title)}`,
                    )
                  }
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[14px] shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <MessageCircle className="w-5 h-5" />
                  Eski Sahibiyle Görüş
                </button>
              </div>
            </div>
          </motion.div>
        )}

      {/* 📦 Owner Experience Banner */}
      {isOwner &&
        item.status === 'GIVEN_AWAY' &&
        item.winner &&
        item.shareType !== 'exchange' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-3xl overflow-hidden border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 shadow-sm"
          >
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200 shadow-inner shrink-0 text-3xl">
                  ✅
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-blue-900 font-[Outfit] tracking-tight">
                    Yeni Sahibi Belirlendi!
                  </h2>
                  <p className="text-sm md:text-base text-blue-700 font-medium leading-tight mt-1">
                    Döngü tamamlandı. Teslimat sürecini başlatmak için{' '}
                    <b>{item.winner.fullName}</b> ile iletişime geçin.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {item.deliveryStatus !== 'SHIPPED' && (
                  <button
                    onClick={() => handleDeliveryUpdate('SHIPPED')}
                    className="px-6 py-3.5 bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 font-bold rounded-[14px] shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Truck className="w-5 h-5" />
                    Gönderdim / Teslim Ettim
                  </button>
                )}
                <button
                  onClick={() =>
                    navigate(
                      `/chat?partnerId=${item.winner.id}&partnerName=${encodeURIComponent(item.winner.fullName)}&itemId=${item.id}&itemTitle=${encodeURIComponent(item.title)}`,
                    )
                  }
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[14px] shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <MessageCircle className="w-5 h-5" />
                  Yeni Sahibine Ulaş
                </button>
              </div>
            </div>
          </motion.div>
        )}

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
        {/* Sol Taraf: Görseller & İçerik (%60) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-[60%] flex flex-col gap-12"
        >
          {/* Görseller - Trendyol tarzı galeri */}
          <div className="relative rounded-[16px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100/60 overflow-hidden">
            {/* Ana büyük görsel */}
            <div
              className="relative w-full aspect-[4/3] md:aspect-[16/10] overflow-hidden cursor-pointer group/img"
              onClick={() => setIsLightboxOpen(true)}
            >
              <img
                src={activeImage}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
              />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/img:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Favori butonu */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFavoriteToggle();
                }}
                className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-white/90 backdrop-blur-md shadow-md border border-white hover:bg-white hover:scale-110 active:scale-95 transition-all duration-200 group/fav"
              >
                <Heart
                  className={`w-5 h-5 transition-colors duration-300 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400 group-hover/fav:text-red-400'}`}
                />
              </button>

              {/* Sayaç rozeti */}
              {itemImages.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/55 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none">
                  {currentImageIndex + 1} / {itemImages.length}
                </div>
              )}

              {/* Ok butonları */}
              {itemImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex((prev) =>
                        prev === 0 ? itemImages.length - 1 : prev - 1,
                      );
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/75 hover:bg-white backdrop-blur-md rounded-full text-slate-800 transition-all shadow-sm z-20"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex((prev) =>
                        prev === itemImages.length - 1 ? 0 : prev + 1,
                      );
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/75 hover:bg-white backdrop-blur-md rounded-full text-slate-800 transition-all shadow-sm z-20"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Galeriyi Aç Butonu */}
              {itemImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLightboxOpen(true);
                  }}
                  className="hidden md:flex absolute bottom-4 left-4 bg-white/90 backdrop-blur-md shadow-md border border-slate-200 px-4 py-2 rounded-[10px] font-bold text-slate-700 items-center gap-2 hover:scale-105 active:scale-95 transition-all z-20 text-xs hover:bg-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-70"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  Tüm Görseller
                </button>
              )}
            </div>

            {/* Thumbnail strip */}
            {itemImages.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-slate-50 border-t border-slate-100">
                {itemImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-200 ${
                      currentImageIndex === idx
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
                        : 'border-transparent hover:border-emerald-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${item.title} ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Açıklama & Rozetler */}
          <div className="pe-4">
            <h2 className="text-2xl font-bold text-slate-900 font-[Outfit] mb-4">
              Eşya Hakkında
            </h2>
            <p className="text-[17px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
              {item.description}
            </p>
          </div>

          {/* Takas Tercihleri */}
          {item.shareType === 'exchange' && (
            <div className="mt-8 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[20px] border border-emerald-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <span className="text-8xl">🔄</span>
              </div>
              <h2 className="text-xl font-bold text-emerald-900 font-[Outfit] mb-3 flex items-center gap-2">
                <span className="text-2xl">🔄</span> Bu döngü bir takas teklifi
                bekliyor
              </h2>
              {item.tradePreferences ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold tracking-widest text-emerald-600 uppercase">
                    Takas Karşılığında Aranan:
                  </p>
                  <p className="text-[16px] text-emerald-800 leading-relaxed font-medium whitespace-pre-wrap relative z-10">
                    "{item.tradePreferences}"
                  </p>
                </div>
              ) : (
                <p className="text-[16px] text-emerald-700 leading-relaxed font-medium relative z-10">
                  Kullanıcı takas için özel bir tercih belirtmemiş. Neler
                  sunabileceğinizi doğrudan kendisine teklif edebilirsiniz.
                </p>
              )}
            </div>
          )}

          {/* Katılımcı Yönetim Paneli — ilan sahibi için */}
          {isOwner &&
            item.shareType !== 'exchange' &&
            item.postType !== 'REQUESTING' &&
            (item.status === 'AVAILABLE' || item.status === 'DRAW_PENDING') && (
              <div
                className="mt-4 pt-8 border-t border-slate-100"
                id="participant-panel"
              >
                <h2 className="text-2xl font-bold text-slate-900 font-[Outfit] mb-6">
                  Adaylar & Katılımcılar
                </h2>
                <ParticipantPanel
                  itemId={id}
                  itemTitle={item.title}
                  selectionType={item.selectionType}
                  onSuccess={(winner) => {
                    fetchItem();
                    showToast(
                      `🎉 Kazanan belirlendi: ${winner.fullName}. Mesajlaşma açılıyor...`,
                      'success',
                    );
                    setTimeout(() => {
                      navigate(
                        `/chat?partnerId=${winner.id}&partnerName=${encodeURIComponent(winner.fullName)}&itemId=${item.id}&itemTitle=${encodeURIComponent(item.title)}`,
                      );
                    }, 800);
                  }}
                />
              </div>
            )}
        </motion.div>

        {/* Sağ Taraf: Sticky Info Card (%40) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-[40%] lg:sticky lg:top-28"
        >
          <div className="bg-white rounded-[24px] p-6 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100/80 transition-shadow hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
            {/* Status Badges */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${item.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : item.status === 'GIVEN_AWAY' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}
              >
                {item.status === 'AVAILABLE'
                  ? '🟢 Aktif Döngü'
                  : item.status === 'GIVEN_AWAY'
                    ? '✔️ Tamamlandı'
                    : '⏳ Beklemede'}
              </span>
              {item.postType === 'REQUESTING' && (
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 flex items-center gap-1.5 border border-blue-200 shadow-sm animate-in fade-in">
                  <span className="text-[13px]">🔍</span> İHTİYAÇ İLANI
                </span>
              )}
              {item.selectionType && item.shareType !== 'exchange' && (
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${item.selectionType === 'manual' ? 'bg-violet-100 text-violet-700' : 'bg-purple-100 text-purple-700'}`}
                >
                  {item.selectionType === 'manual'
                    ? '👆 Manuel Seçim'
                    : '🎲 Çekiliş Usulü'}
                </span>
              )}
            </div>

            {/* Title and Location */}
            <h1 className="text-[28px] md:text-3xl font-extrabold text-slate-900 font-[Outfit] leading-[1.15] mb-4">
              {item.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-slate-500 font-medium flex-wrap">
              <span className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className="text-emerald-500 text-lg">📍</span> {item.city}
                , {item.district}
              </span>
              {postedAgoStr && (
                <span className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <Clock className="w-4 h-4 text-slate-400" /> {postedAgoStr}{' '}
                  paylaşıldı
                </span>
              )}
            </div>

            {item.postType === 'REQUESTING' && (
              <div className="mt-6 mb-2 p-5 bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100 rounded-[18px] flex items-center gap-4 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-400/5 mix-blend-overlay group-hover:bg-blue-400/10 transition-colors"></div>
                <div className="relative">
                  <div className="absolute -inset-2 bg-blue-200/50 rounded-full blur-sm animate-pulse"></div>
                  <span className="relative text-3xl drop-shadow-sm">🎁</span>
                </div>
                <div className="relative">
                  <p className="text-[14px] text-blue-900 font-bold leading-snug tracking-tight">
                    Bu ihtiyacı gidererek 200 İyilik Puanı kazanabilirsin!
                  </p>
                </div>
              </div>
            )}

            <div className="h-px w-full bg-slate-100 my-7" />

            {/* İlan Sahibi Profile Header */}
            <div
              className="flex items-center justify-between group cursor-pointer"
              onClick={() => navigate(`/profile/${item.owner?.id}`)}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform duration-300 shrink-0">
                  {ownerInitial}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="font-bold text-slate-900 text-[17px] group-hover:text-emerald-600 transition-colors tracking-tight leading-none mb-2">
                    {ownerName}
                  </p>
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider text-[10px]">
                      Onaylı
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      Puan:{' '}
                      <span className="text-slate-800 font-bold">
                        {item.owner?.karmaPoint || 0}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>

            <div className="h-px w-full bg-slate-100 my-7" />

            {/* Delivery Methods Grid (Tiny) */}
            {item.deliveryMethods && item.deliveryMethods.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                  Teslimat Seçenekleri
                </p>
                <div className="flex flex-col gap-2">
                  {item.deliveryMethods.includes('pickup') && (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-base">📍</span> Elden Teslim
                      (Gel-Al)
                    </div>
                  )}
                  {item.deliveryMethods.includes('mutual_agreement') && (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-base">💬</span> Karşılıklı Anlaşma
                    </div>
                  )}
                  {(item.deliveryMethods.includes('shipping') ||
                    item.deliveryMethods.includes('shipping_buyer') ||
                    item.deliveryMethods.includes('shipping_seller')) && (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-base">📦</span> Kargo
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats Info Grid (Apple Minimal) */}
            {item.shareType !== 'exchange' &&
              item.postType !== 'REQUESTING' && (
                <div className="grid grid-cols-2 gap-y-7 gap-x-4 mb-8">
                  {item.selectionType !== 'manual' && timeLeft && !isEnded && (
                    <div>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">
                        Kalan Süre
                      </p>
                      <p className="text-xl font-black text-emerald-600 tabular-nums tracking-tight">
                        {timeLeft}
                      </p>
                    </div>
                  )}
                  {isEnded && (
                    <div>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">
                        Durum
                      </p>
                      <p className="text-base font-black text-slate-800">
                        {timeAgoStr} bitti
                      </p>
                    </div>
                  )}
                  {item.selectionType === 'manual' && !isEnded && (
                    <div>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">
                        Seçim Türü
                      </p>
                      <p className="text-base font-black text-violet-600 flex items-center gap-1.5">
                        ✋ Manuel
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">
                      Aday Sayısı
                    </p>
                    <p className="text-xl font-black text-slate-800 flex items-center gap-1.5 tabular-nums tracking-tight">
                      <Users className="w-5 h-5 text-emerald-500" />
                      {participants}
                    </p>
                  </div>
                </div>
              )}

            {item.shareType === 'exchange' && (
              <div className="mb-8">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => navigate('/trades')}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:shadow-sm"
                  >
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">
                        Takas Teklifleri
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-800">
                        {tradeOfferLabel}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-emerald-600" />
                  </button>
                ) : (
                  <div className="w-full rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">
                      Takas Teklifleri
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-800">
                      {tradeOfferLabel}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {item.status === 'AVAILABLE' && !isEnded && !isOwner && (
              <AnimatePresence mode="wait">
                {!isJoined ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row gap-3">
                      {item.postType === 'REQUESTING' ? (
                        <button
                          onClick={handleBendeVarClick}
                          disabled={joining}
                          className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-[14px] shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                          <span className="text-xl">🙌</span>
                          {joining ? 'Gönderiliyor...' : 'Bende Var!'}
                        </button>
                      ) : item.shareType !== 'exchange' ? (
                        <button
                          onClick={handleJoin}
                          disabled={joining}
                          className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[15px] rounded-[14px] shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                          <Heart className="w-5 h-5 fill-emerald-500 text-emerald-500" />
                          {joining ? 'İşleniyor...' : 'Döngüye Katıl'}
                        </button>
                      ) : null}

                      {item.shareType === 'exchange' && (
                        <button
                          onClick={() => setTradeModalOpen(true)}
                          className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[15px] rounded-[14px] shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                          <span className="text-xl">🔄</span>
                          Takas Teklifi Et
                        </button>
                      )}
                    </div>

                    {canChat && (
                      <button
                        onClick={() =>
                          navigate(
                            `/chat?partnerId=${item.owner.id}&partnerName=${encodeURIComponent(item.owner.fullName)}&itemId=${item.id}&itemTitle=${encodeURIComponent(item.title)}`,
                          )
                        }
                        className="w-full py-4 border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[15px] rounded-[14px] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Bir Soru Sor
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 text-center"
                  >
                    {item.shareType !== 'exchange' && (
                      <div className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-[14px] font-bold flex items-center justify-center gap-2 mb-1">
                        <ShieldCheck className="w-5 h-5" />
                        Katılım Başarılı!
                      </div>
                    )}
                    {canChat && (
                      <button
                        onClick={() =>
                          navigate(
                            `/chat?partnerId=${item.owner.id}&partnerName=${encodeURIComponent(item.owner.fullName)}&itemId=${item.id}&itemTitle=${encodeURIComponent(item.title)}`,
                          )
                        }
                        className="w-full py-3.5 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        İlan Sahibine Mesaj Gönder
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {item.status === 'AVAILABLE' &&
              isEnded &&
              !isOwner &&
              item.shareType !== 'exchange' && (
                <div className="w-full py-4 bg-slate-50 text-slate-500 rounded-xl text-center flex items-center justify-center gap-2 border border-slate-200">
                  <Clock className="w-5 h-5" />
                  <span className="font-bold text-sm">
                    Süre doldu, çekiliş bekleniyor.
                  </span>
                </div>
              )}

            {item.status === 'GIVEN_AWAY' && (
              <div className="w-full py-4 bg-emerald-50 text-emerald-700 rounded-xl text-center font-bold border border-emerald-100 flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">🎉</span>
                Döngü Tamamlandı
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Winner Selection Modal */}
      <WinnerSelectionModal
        isOpen={winnerModalOpen}
        onClose={() => setWinnerModalOpen(false)}
        itemId={id}
        itemTitle={item.title}
        onSuccess={() => {
          fetchItem();
          fetchUser();
        }}
      />

      {/* Delivery Confirmation Modal */}
      <DeliveryConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        itemId={id}
        onSuccess={() => {
          fetchItem();
          fetchUser();
        }}
      />

      {/* Lightbox / Fullscreen Gallery */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
          >
            <div className="absolute top-0 w-full p-4 md:p-6 flex items-center justify-between z-50">
              <span className="text-white font-medium bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                {currentImageIndex + 1} / {item.images?.length || 1}
              </span>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {itemImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex((prev) =>
                      prev === 0 ? itemImages.length - 1 : prev - 1,
                    );
                  }}
                  className="absolute left-4 md:left-8 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors z-50"
                >
                  <ChevronLeft className="w-8 h-8 md:w-10 md:h-10 text-white/50 hover:text-white transition-colors" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex((prev) =>
                      prev === itemImages.length - 1 ? 0 : prev + 1,
                    );
                  }}
                  className="absolute right-4 md:right-8 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors z-50"
                >
                  <ChevronRight className="w-8 h-8 md:w-10 md:h-10 text-white/50 hover:text-white transition-colors" />
                </button>
              </>
            )}

            <div
              className="w-full h-full max-w-6xl mx-auto p-4 md:p-12 flex items-center justify-center"
              onClick={() => setIsLightboxOpen(false)}
            >
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                src={itemImages[currentImageIndex] || itemImages[0]}
                alt={item.title}
                className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {item && (
        <TradeOfferModal
          isOpen={tradeModalOpen}
          onClose={() => setTradeModalOpen(false)}
          targetItemId={item.id}
          targetItemTitle={item.title}
          onSuccess={() => {
            // Modal anında kapanır, sayı optimistik artar, arka planda da fetchItem çalışır
            setTradeModalOpen(false);
            setPublicOffers((prev) => [...prev, { id: 'temp' }]);
            fetchItem();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-slate-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6 mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 text-center mb-2 font-[Outfit]">
                İlanı Silmek İstiyor Musun?
              </h3>
              <p className="text-slate-500 text-center mb-8 font-medium leading-relaxed">
                Bu işlem geri alınamaz. İlanınla birlikte tüm başvurular ve
                mesajlar da silinecektir.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleting}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {deleting ? 'Siliniyor...' : 'Evet, Sil'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Confirmation Modal */}
      <AnimatePresence>
        {requestConfirmOpen && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRequestConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-slate-100"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6 mx-auto">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 text-center mb-2 font-[Outfit]">
                Sohbet Başlatılsın mı?
              </h3>
              <p className="text-slate-500 text-center mb-8 font-medium leading-relaxed">
                Bu ihtiyacı karşılayabileceğinizi belirterek ilan sahibiyle
                doğrudan sohbet başlatacaksınız.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRequestConfirmOpen(false)}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                >
                  Vazgeç
                </button>
                <button
                  onClick={confirmStartRequestChat}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all"
                >
                  Sohbeti Başlat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ItemDetail;
