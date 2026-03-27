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
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                Doğrulanmış Döngü Üyesi
              </span>
              {user?.karma?.rank <= 10 && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 rounded-full shadow-sm"
                  title="İlk 10'da yer alıyor!"
                >
                  <Trophy className="w-3 h-3" /> Topluluk Lideri
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Karma & Impact Card — Minimalist Redesign */}
        <div className="lg:col-span-2 relative bg-white rounded-3xl p-6 md:p-8 shadow-lg overflow-visible">
          <div className="relative z-10 flex flex-col md:flex-row gap-8 h-full">
            {/* Sol: Gelişim Paneli */}
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6 -mt-2">
                Döngü İstatistiklerin
              </p>
              {/* Puan + Sıralama */}
              <div className="flex items-center gap-4 mb-4">
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="text-4xl lg:text-5xl font-black text-slate-800 font-[Outfit]"
                >
                  {user?.karmaPoint || 0}
                </motion.span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-700">
                    #{user?.karma?.rank || '-'}
                  </span>
                </div>
              </div>

              {/* Progress Bar — ince ve modern */}
              {(() => {
                const kp = user?.karmaPoint || 0;
                let badgeName = 'Yeni Paylaşımcı',
                  badgeEmoji = '🥉',
                  badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                let nextName = 'İyilik Yolcusu',
                  pointsLeft = 251 - kp;
                if (kp > 2000) {
                  badgeName = 'Döngü Ustası';
                  badgeEmoji = '💎';
                  badgeColor =
                    'bg-emerald-50 text-emerald-700 border-emerald-200';
                  nextName = null;
                  pointsLeft = 0;
                } else if (kp >= 751) {
                  badgeName = 'İyilik Elçisi';
                  badgeEmoji = '🥇';
                  badgeColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                  nextName = 'Döngü Ustası';
                  pointsLeft = 2001 - kp;
                } else if (kp >= 251) {
                  badgeName = 'İyilik Yolcusu';
                  badgeEmoji = '🥈';
                  badgeColor = 'bg-slate-50 text-slate-600 border-slate-200';
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
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          duration: 1.5,
                          ease: 'easeOut',
                          delay: 0.3,
                        }}
                        className={`h-full rounded-full ${
                          kp < 251
                            ? 'bg-amber-400'
                            : kp < 751
                              ? 'bg-slate-400'
                              : kp < 2000
                                ? 'bg-yellow-400'
                                : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}`}
                      >
                        {badgeEmoji} {badgeName}
                      </span>
                      {nextName && (
                        <span className="text-xs text-slate-400 font-medium">
                          {nextName}'e{' '}
                          <span className="text-emerald-600 font-bold">
                            {pointsLeft}
                          </span>{' '}
                          puan
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Sağ: 2x2 Stat Grid + Paylaş Butonu */}
            <div className="flex flex-col justify-between md:w-64 lg:w-72">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center text-center">
                  <Package className="w-5 h-5 text-blue-500 mb-1.5" />
                  <span className="text-xl font-bold text-slate-800">
                    {myItems.length}
                  </span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">
                    Paylaşılan
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center text-center">
                  <Handshake className="w-5 h-5 text-purple-500 mb-1.5" />
                  <span className="text-xl font-bold text-slate-800">
                    {successfulTradesCount}
                  </span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">
                    Takas
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center text-center">
                  <Heart className="w-5 h-5 text-rose-500 mb-1.5" />
                  <span className="text-xl font-bold text-slate-800">
                    {user?.resolvedRequestsCount || 0}
                  </span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">
                    İhtiyaç Giderilen
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center text-center">
                  <Gift className="w-5 h-5 text-emerald-500 mb-1.5" />
                  <span className="text-xl font-bold text-slate-800">
                    {newOwnerCount}
                  </span>
                  <span className="text-xs text-slate-400 font-medium mt-0.5">
                    Kazanılan
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
                        text,
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
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-sm font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
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
                    postType={item.postType}
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
