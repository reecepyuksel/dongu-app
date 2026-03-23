import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { motion } from 'framer-motion';
import {
  Package,
  Trophy,
  Clock,
  Gift,
  ChevronRight,
  Star,
  Truck,
  MessageCircle,
  Plus,
  Heart,
  Share2,
  Handshake,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import CreateItemModal from '../components/CreateItemModal';
import DeliveryConfirmModal from '../components/DeliveryConfirmModal';
import { ItemCard } from '../components/ItemCard';

const Dashboard = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('items');
  const [myItems, setMyItems] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [myFavorites, setMyFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedConfirmItemId, setSelectedConfirmItemId] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showToast('Paneli görmek için giriş yapmalısınız.', 'info');
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate, showToast]);

  const fetchData = async () => {
    try {
      const [itemsRes, appsRes, favRes] = await Promise.all([
        api.get('/users/me/items'),
        api.get('/users/me/applications'),
        api.get('/favorites'),
      ]);
      setMyItems(itemsRes.data);
      setMyApplications(appsRes.data);
      setMyFavorites(favRes.data);
    } catch (err) {
      console.error('Dashboard verisi yüklenemedi:', err);
      showToast('Veriler yüklenirken hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
  }, [isAuthenticated, showToast]);

  const handleDeliveryUpdate = async (itemId, status) => {
    try {
      await api.patch(`/items/${itemId}/delivery-status`, { status });
      // Listeyi güncelle
      setMyItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, deliveryStatus: status } : item,
        ),
      );
      setMyApplications((prev) =>
        prev.map((app) =>
          app.item?.id === itemId
            ? { ...app, item: { ...app.item, deliveryStatus: status } }
            : app,
        ),
      );
      const labels = {
        SHIPPED: 'Kargoya verildi! 📦',
        DELIVERED: 'Teslim alındı! ✅',
      };
      showToast(labels[status], 'success');
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Durum güncellenemedi.',
        'error',
      );
    }
  };

  const handleFavoriteToggle = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const res = await api.post(`/favorites/${id}`);
      if (!res.data.isFavorited) {
        // Favorilerden çıkarıldıysa, listeden anında uçur
        setMyFavorites((prev) => prev.filter((item) => item.id !== id));
        showToast('Favorilerden çıkarıldı', 'info');
      } else {
        fetchData(); // Geri eklenirse tüm verileri tazele (pek olanaklı değil ama)
        showToast('Favorilere eklendi ❤️', 'success');
      }
    } catch (err) {
      showToast('Favori işlemi başarısız oldu.', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-pulse text-emerald-600 font-medium">
          Yükleniyor...
        </div>
      </div>
    );
  }

  const statusColors = {
    AVAILABLE: 'bg-emerald-100 text-emerald-700',
    DRAW_PENDING: 'bg-amber-100 text-amber-700',
    GIVEN_AWAY: 'bg-slate-100 text-slate-500',
    IN_TRADE: 'bg-indigo-100 text-indigo-700',
  };

  const statusLabels = {
    AVAILABLE: 'Aktif',
    DRAW_PENDING: 'Çekiliş Bekliyor',
    GIVEN_AWAY: 'Tamamlandı',
    IN_TRADE: 'Takas Sürecinde',
  };

  const deliveryLabels = (item) => {
    const hasShipping = item?.deliveryMethods?.some((m) =>
      m.includes('shipping'),
    );
    const isHandDelivery = !hasShipping;
    return {
      PENDING: {
        label: isHandDelivery ? 'Teslimat Bekleniyor' : 'Kargo Bekleniyor',
        color: isHandDelivery
          ? 'bg-blue-100 text-blue-700'
          : 'bg-amber-100 text-amber-700',
      },
      SHIPPED: { label: 'Kargolandı', color: 'bg-blue-100 text-blue-700' },
      DELIVERED: {
        label: isHandDelivery ? 'Elden Teslim Edildi' : 'Teslim Edildi',
        color: 'bg-emerald-100 text-emerald-700',
      },
    };
  };

  const newOwnerCount = myApplications.filter(
    (a) => a.status === 'WON' || a.item?.winner?.id === user?.id,
  ).length;
  const successfulTradesCount = user?.successfulTradesCount || 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Profil ve Karma Başlığı */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Profile Info Left */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center gap-4 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold text-4xl shadow-inner border-[4px] border-white ring-4 ring-emerald-50">
            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-[Outfit]">
              {user?.fullName}
            </h1>
            <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
            <div className="mt-3 inline-flex text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              Doğrulanmış Döngü Üyesi
            </div>
          </div>
        </div>

        {/* Karma & Impact Card Right */}
        <div className="lg:col-span-2 relative bg-white rounded-3xl p-6 md:p-8 shadow-lg overflow-visible group">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-emerald-50 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-teal-50 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8 h-full">
            {/* Sol: İlerleme & Skor */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 font-[Outfit] leading-none mb-0.5">
                    Döngü İstatistiklerin
                  </h2>
                  <p className="text-slate-400 text-xs font-medium">
                    İyilik yolculuğundaki ilerlemen
                  </p>
                </div>
              </div>

              {/* Puan & Hedef Row */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Mevcut Puan
                  </p>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="text-4xl lg:text-5xl font-black text-slate-800 font-[Outfit]"
                  >
                    {user?.karmaPoint || 0}
                  </motion.span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-medium mb-1">
                    Sıradaki Hedef
                  </p>
                  <span className="text-2xl font-bold text-emerald-600 font-[Outfit]">
                    {(() => {
                      const kp = user?.karmaPoint || 0;
                      if (kp >= 2000) return '🏆 Maks';
                      if (kp >= 751) return '2000';
                      if (kp >= 251) return '751';
                      return '251';
                    })()}
                  </span>
                </div>
              </div>

              {/* Badge */}
              {(() => {
                const kp = user?.karmaPoint || 0;
                let badgeName = 'Yeni Paylaşımcı',
                  badgeEmoji = '🥉',
                  badgeColor = 'from-amber-100 to-amber-200 text-amber-800';
                let nextName = 'İyilik Yolcusu',
                  pointsLeft = 251 - kp;
                if (kp > 2000) {
                  badgeName = 'Döngü Ustası';
                  badgeEmoji = '💎';
                  badgeColor = 'from-emerald-100 to-teal-200 text-emerald-800';
                  nextName = null;
                  pointsLeft = 0;
                } else if (kp >= 751) {
                  badgeName = 'İyilik Elçisi';
                  badgeEmoji = '🥇';
                  badgeColor = 'from-yellow-100 to-amber-200 text-yellow-800';
                  nextName = 'Döngü Ustası';
                  pointsLeft = 2001 - kp;
                } else if (kp >= 251) {
                  badgeName = 'İyilik Yolcusu';
                  badgeEmoji = '🥈';
                  badgeColor = 'from-slate-100 to-slate-200 text-slate-700';
                  nextName = 'İyilik Elçisi';
                  pointsLeft = 751 - kp;
                }

                let currentMin = 0,
                  currentMax = 250;
                if (kp >= 2000) {
                  currentMin = 2000;
                  currentMax = 2000;
                } else if (kp >= 751) {
                  currentMin = 751;
                  currentMax = 2000;
                } else if (kp >= 251) {
                  currentMin = 251;
                  currentMax = 750;
                }
                const pct =
                  kp >= 2000
                    ? 100
                    : Math.min(
                        ((kp - currentMin) / (currentMax - currentMin)) * 100,
                        100,
                      );

                return (
                  <>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${badgeColor} shadow-sm mb-4 w-fit`}
                    >
                      {badgeEmoji} {badgeName}
                    </span>

                    {/* Interactive Progress Bar */}
                    <div className="max-w-full w-full relative group/bar mt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative shadow-inner cursor-pointer">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              duration: 1.8,
                              ease: 'easeOut',
                              delay: 0.3,
                            }}
                            className={`absolute h-full rounded-full ${
                              kp < 251
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                : kp < 751
                                  ? 'bg-gradient-to-r from-slate-400 to-slate-500'
                                  : kp < 2000
                                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                    : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                            }`}
                          />
                          {kp >= 751 && (
                            <motion.div
                              initial={{ x: '-100%', opacity: 0 }}
                              animate={{ x: '250%', opacity: 0.5 }}
                              transition={{
                                repeat: Infinity,
                                duration: 2.5,
                                ease: 'linear',
                              }}
                              className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white to-transparent"
                            />
                          )}
                        </div>

                        {/* Target Indicator */}
                        {nextName && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-lg shadow-sm group-hover/bar:scale-110 transition-transform duration-300">
                            {nextName === 'İyilik Yolcusu'
                              ? '🥈'
                              : nextName === 'İyilik Elçisi'
                                ? '🥇'
                                : '💎'}
                          </div>
                        )}
                      </div>

                      {/* Hover Tooltip */}
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[11px] font-medium px-4 py-2 rounded-xl shadow-xl opacity-0 group-hover/bar:opacity-100 transition-all duration-300 pointer-events-none max-w-[min(90vw,28rem)] text-center whitespace-normal z-20">
                        {nextName
                          ? `Bu bar dolunca ${nextName} olacaksın! Kalan: ${pointsLeft} puan ✨`
                          : 'Tebrikler! Maksimum seviyeye ulaştın! 🏆'}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Sağ: İstatistikler & Buton */}
            <div className="flex flex-col items-start md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
              <div className="flex gap-4 mb-6 md:mb-0 w-full md:w-auto">
                <div className="flex-1 md:flex-none flex flex-col items-center md:items-end bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                  <span className="text-3xl font-bold text-slate-800 mb-1">
                    {myItems.length}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium text-center md:text-right">
                    Döngüye Katılan
                    <br />
                    Eşya
                  </span>
                </div>
                <div className="w-px bg-slate-100 hidden md:block"></div>
                <div className="flex-1 md:flex-none flex flex-col items-center md:items-end bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                  <span className="text-3xl font-bold text-slate-800 mb-1">
                    {newOwnerCount}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium text-center md:text-right">
                    Yeni Sahibi
                    <br />
                    Olduğun
                  </span>
                </div>
                <div className="w-px bg-slate-100 hidden md:block"></div>
                <div className="flex-1 md:flex-none flex flex-col items-center md:items-end bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                  <div className="flex items-center gap-1 mb-1 text-slate-700">
                    <Handshake className="w-4 h-4" />
                    <span className="text-3xl font-bold text-slate-800">
                      {successfulTradesCount}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium text-center md:text-right">
                    Başarılı Takas
                    <br />
                    Tamamlandı
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  const text = `Döngü'de ${myItems.length} eşyayı paylaşıma kattım, ${user?.karmaPoint || 0} İyilik Puanına ulaştım! #Döngü #PaylaşYeniBirHikayeBaşlasın`;
                  if (navigator.share) {
                    navigator
                      .share({
                        title: 'Döngü Başarımım',
                        text: text,
                        url: window.location.origin,
                      })
                      .catch(console.error);
                  } else {
                    navigator.clipboard.writeText(text);
                    showToast(
                      'Başarımınız panoya kopyalandı! Dilediğiniz yerde paylaşabilirsiniz.',
                      'success',
                    );
                  }
                }}
                className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 font-bold rounded-xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 group/btn"
              >
                <Share2 className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                Başarımı Paylaş
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tablos & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'items' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Döngüye Kattıklarım ({myItems.length})
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'applications' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Katıldıklarım ({myApplications.length})
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'favorites' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Favorilerim ({myFavorites.length})
          </button>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-200"
        >
          <Plus className="w-5 h-5" />
          Döngüye Kat
        </button>
      </div>

      <CreateItemModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onItemCreated={fetchData}
      />

      {/* Döngüye Kattıklarım */}
      {activeTab === 'items' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {myItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Gift className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                Henüz bir eşya paylaşmadınız.
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Hemen ilk döngünüzü başlatmaya ne dersiniz?
              </p>
            </div>
          ) : (
            myItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-emerald-100 transition-all"
              >
                <Link
                  to={`/items/${item.id}`}
                  className="flex items-center gap-5 group"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <img
                      src={item.imageUrl || 'https://via.placeholder.com/100'}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[item.status] || 'bg-slate-100 text-slate-500'}`}
                      >
                        {statusLabels[item.status] || item.status}
                      </span>
                      {item.deliveryStatus &&
                        (() => {
                          const labels = deliveryLabels(item);
                          const info = labels[item.deliveryStatus];
                          const hasShipping = item.deliveryMethods?.some((m) =>
                            m.includes('shipping'),
                          );
                          return (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${info?.color}`}
                            >
                              {!hasShipping ? (
                                '🤝'
                              ) : (
                                <Truck className="w-3 h-3 inline mr-1" />
                              )}
                              {info?.label}
                            </span>
                          );
                        })()}
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {format(
                          new Date(item.drawDate || item.createdAt),
                          'dd MMM yyyy',
                          { locale: tr },
                        )}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition" />
                </Link>

                {/* Kargola / Elden Teslim butonu */}
                {['GIVEN_AWAY', 'IN_TRADE'].includes(item.status) &&
                  item.deliveryStatus === 'PENDING' && (
                    <div className="mt-3 pl-[84px]">
                      {!item.deliveryMethods?.some((m) =>
                        m.includes('shipping'),
                      ) ? (
                        <button
                          onClick={() =>
                            handleDeliveryUpdate(item.id, 'DELIVERED')
                          }
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2"
                        >
                          🤝 Elden Teslim Ettim
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleDeliveryUpdate(item.id, 'SHIPPED')
                          }
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2"
                        >
                          📦 Kargoladım
                        </button>
                      )}
                    </div>
                  )}
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* Favorilerim */}
      {activeTab === 'favorites' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {myFavorites.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                Henüz favorilere eklediğiniz bir paylaşım yok.
              </p>
              <Link
                to="/"
                className="text-emerald-600 hover:underline text-sm mt-2 inline-block"
              >
                Vitrine göz atın →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myFavorites.map((item) => (
                <Link to={`/items/${item.id}`} key={item.id}>
                  <ItemCard
                    title={item.title}
                    imageUrl={
                      item.images && item.images.length > 0
                        ? item.images[0]
                        : item.imageUrl || 'https://via.placeholder.com/300'
                    }
                    drawDate={item.drawDate}
                    status={item.status}
                    participants={item.applicationsCount || 0}
                    ownerAvatar={item.owner?.avatarUrl || null}
                    category={item.category}
                    city={item.city}
                    district={item.district}
                    selectionType={item.selectionType}
                    shareType={item.shareType}
                    deliveryMethods={item.deliveryMethods}
                    isFavorited={true}
                    onFavoriteToggle={(e) => handleFavoriteToggle(e, item.id)}
                  />
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Katıldıklarım */}
      {activeTab === 'applications' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {myApplications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                Henüz bir çekilişe katılmadınız.
              </p>
              <Link
                to="/"
                className="text-emerald-600 hover:underline text-sm mt-2 inline-block"
              >
                Vitrine göz atın →
              </Link>
            </div>
          ) : (
            myApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-emerald-100 transition-all"
              >
                <Link
                  to={`/items/${app.item?.id}`}
                  className="flex items-center gap-5 group"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <img
                      src={
                        app.item?.imageUrl || 'https://via.placeholder.com/100'
                      }
                      alt={app.item?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">
                      {app.item?.title || 'Bilinmeyen Ürün'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {app.isWinner ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          🎉 Yeni Sahibi Sensin!
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                          Katıldın
                        </span>
                      )}
                      {app.isWinner &&
                        app.item?.deliveryStatus &&
                        (() => {
                          const labels = deliveryLabels(app.item);
                          const info = labels[app.item.deliveryStatus];
                          const hasShipping = app.item.deliveryMethods?.some(
                            (m) => m.includes('shipping'),
                          );
                          return (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${info?.color}`}
                            >
                              {!hasShipping ? (
                                '🤝'
                              ) : (
                                <Truck className="w-3 h-3 inline mr-1" />
                              )}
                              {info?.label}
                            </span>
                          );
                        })()}
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(app.appliedAt), {
                          addSuffix: true,
                          locale: tr,
                        })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition" />
                </Link>

                {/* Teslim aldım + mesaj butonları */}
                {app.isWinner && (
                  <div className="mt-3 pl-[84px] flex gap-2">
                    {!app.item?.deliveryMethods?.some((m) =>
                      m.includes('shipping'),
                    )
                      ? /* Pickup: Elden teslim */
                        app.item?.deliveryStatus === 'PENDING' && (
                          <button
                            onClick={() => {
                              setSelectedConfirmItemId(app.item?.id);
                              setConfirmModalOpen(true);
                            }}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2"
                          >
                            🤝 Elden Teslim Aldım
                          </button>
                        )
                      : /* Kargo: Shipped olunca 'Teslim Aldım' butonu */
                        app.item?.deliveryStatus === 'SHIPPED' && (
                          <button
                            onClick={() => {
                              setSelectedConfirmItemId(app.item?.id);
                              setConfirmModalOpen(true);
                            }}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2"
                          >
                            ✅ Teslim Aldım
                          </button>
                        )}
                    <Link
                      to={`/items/${app.item?.id}`}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {!app.item?.deliveryMethods?.some((m) =>
                        m.includes('shipping'),
                      )
                        ? 'Paylaşım Sahibiyle İletişime Geç'
                        : 'Mesaj Gönder'}
                    </Link>
                  </div>
                )}
              </div>
            ))
          )}
        </motion.div>
      )}

      <DeliveryConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        itemId={selectedConfirmItemId}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
};

export default Dashboard;
