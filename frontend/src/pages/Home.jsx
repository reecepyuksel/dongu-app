import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ItemCard } from '../components/ItemCard';
import SkeletonCard from '../components/SkeletonCard';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import {
  Search,
  MapPin,
  Monitor,
  Shirt,
  Book,
  Home as HomeIcon,
  Palette,
  Package,
  Check,
  SlidersHorizontal,
  Recycle,
  Handshake,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import citiesData from '../data/cities.json';
import SearchableSelect from '../components/SearchableSelect';
import FilterPanel from '../components/FilterPanel';

const Home = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(
    () => sessionStorage.getItem('home_search_term') || '',
  );
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('home_active_tab') || 'all',
  ); // 'all', 'donation' or 'exchange'

  // Auth & Favorites
  const { isAuthenticated, user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState([]);

  // Active Filters
  const [activeCategories, setActiveCategories] = useState(() =>
    JSON.parse(sessionStorage.getItem('home_active_categories') || '[]'),
  );
  const [activeCities, setActiveCities] = useState(() =>
    JSON.parse(sessionStorage.getItem('home_active_cities') || '[]'),
  );
  const [activeDistricts, setActiveDistricts] = useState(() =>
    JSON.parse(sessionStorage.getItem('home_active_districts') || '[]'),
  );

  const { showToast } = useToast();

  // Kategori verileri ve ikonlar
  const categories = [
    { name: 'Tümü', icon: Package },
    { name: 'Elektronik', icon: Monitor },
    { name: 'Giyim', icon: Shirt },
    { name: 'Kitap', icon: Book },
    { name: 'Ev Eşyası', icon: HomeIcon },
    { name: 'Hobi', icon: Palette },
    { name: 'Diğer', icon: Package },
  ];

  // Şehir/İlçe Verisi (JSON'dan Çekiliyor)
  const cities = citiesData.cities;
  const districtsData = citiesData.districtsData;

  // Senkronize state ile sessionStorage'ı güncelle
  useEffect(() => {
    sessionStorage.setItem('home_active_tab', activeTab);
    sessionStorage.setItem('home_search_term', searchTerm);
    sessionStorage.setItem(
      'home_active_categories',
      JSON.stringify(activeCategories),
    );
    sessionStorage.setItem('home_active_cities', JSON.stringify(activeCities));
    sessionStorage.setItem(
      'home_active_districts',
      JSON.stringify(activeDistricts),
    );
  }, [activeTab, searchTerm, activeCategories, activeCities, activeDistricts]);

  // Scroll restorasyonu için ayrı useEffect
  useEffect(() => {
    if (!loading) {
      const savedScrollPos = sessionStorage.getItem('home_scroll_pos');
      if (savedScrollPos) {
        setTimeout(() => {
          window.scrollTo({
            top: parseInt(savedScrollPos, 10),
            behavior: 'instant',
          });
          sessionStorage.removeItem('home_scroll_pos');
        }, 100);
      }
    }
  }, [loading, items]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const queryParams = {};
        if (activeTab === 'donation' || activeTab === 'exchange') {
          queryParams.shareType = activeTab;
        } else if (activeTab === 'REQUESTING') {
          queryParams.postType = activeTab;
        }
        if (activeCities.length > 0) queryParams.city = activeCities.join(',');
        if (activeDistricts.length > 0)
          queryParams.district = activeDistricts.join(',');

        const res = await api.get('/items', { params: queryParams });
        setItems(res.data);
      } catch (err) {
        console.error('Paylaşımlar yüklenirken hata:', err);
        showToast(
          'Eşyaları şu an getiremiyoruz, lütfen birazdan tekrar deneyin.',
          'error',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [showToast, activeCities, activeDistricts, activeTab]);

  useEffect(() => {
    if (isAuthenticated) {
      api
        .get('/favorites')
        .then((res) => setFavoriteIds(res.data.map((f) => f.id)))
        .catch((err) => console.error('Favoriler alınamadı:', err));
    } else {
      setFavoriteIds([]);
    }
  }, [isAuthenticated]);

  const handleFavoriteToggle = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      showToast('Favorilere eklemek için giriş yapmalısınız.', 'info');
      return;
    }

    try {
      const res = await api.post(`/favorites/${id}`);
      if (res.data.isFavorited) {
        setFavoriteIds((prev) => [...prev, id]);
        showToast('Favorilere eklendi ❤️', 'success');
      } else {
        setFavoriteIds((prev) => prev.filter((fid) => fid !== id));
        showToast('Favorilerden çıkarıldı', 'info');
      }
    } catch (err) {
      showToast('Favori işlemi başarısız oldu.', 'error');
    }
  };

  const handleJoinClick = async (e, id) => {
    e.preventDefault(); // Link eylemini durdur
    e.stopPropagation();

    try {
      await api.post(`/giveaways/${id}/apply`);
      showToast('Döngüye başarıyla katıldın! 🎉', 'success');
      // Katılımcı sayısını anında artır
      setItems(
        items.map((i) =>
          i.id === id
            ? { ...i, applicationsCount: (i.applicationsCount || 0) + 1 }
            : i,
        ),
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Bir hata oluştu.';
      if (
        msg.includes('already applied') ||
        msg.includes('has already applied')
      ) {
        showToast('Bu döngüye zaten katılmışsınız.', 'info');
      } else if (err.response?.status === 401) {
        showToast('Döngüye katılmak için giriş yapmalısınız.', 'info');
      } else {
        showToast(msg, 'error');
      }
    }
  };

  // API'den gelen öğeleri ayrıca lokaldeki Text arama, Kategori ve Döngü Tipi filtrelerine göre süzüyoruz.
  // (Şehir/İlçe API bazlı olduğu için zaten süzülmüş dönüyor)
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      activeCategories.length === 0 || activeCategories.includes(item.category);

    return matchesSearch && matchesCategory;
  });

  const handleApplyFilters = (filters) => {
    if (!filters) return;
    setActiveCategories(filters.categories || []);
    setActiveCities(filters.cities || []);
    setActiveDistricts(filters.districts || []);
  };

  const removeFilter = (type, value) => {
    switch (type) {
      case 'category':
        setActiveCategories((prev) => prev.filter((v) => v !== value));
        break;
      case 'city':
        setActiveCities((prev) => prev.filter((v) => v !== value));
        break;
      case 'district':
        setActiveDistricts((prev) => prev.filter((v) => v !== value));
        break;
    }
  };

  const clearAllFilters = () => {
    setActiveCategories([]);
    setActiveCities([]);
    setActiveDistricts([]);
    setSearchTerm('');
    // Ayrıca sessionStorage'dan temizleyelim ki sayfa yenilenince geri gelmesin
    sessionStorage.removeItem('home_active_categories');
    sessionStorage.removeItem('home_active_cities');
    sessionStorage.removeItem('home_active_districts');
    sessionStorage.removeItem('home_search_term');
  };

  const handleItemClick = () => {
    sessionStorage.setItem('home_scroll_pos', window.scrollY.toString());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-emerald-900 text-white py-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-64 h-64 rounded-full bg-emerald-400 blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black mb-6 tracking-tight"
          >
            İyiliği <span className="text-emerald-400">Dolaştır</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-emerald-100 max-w-2xl mx-auto mb-10"
          >
            Paylaş, Yeni Bir Hikaye Başlasın. Tamamen şeffaf ve güvenilir bir
            topluluk döngüsü.
          </motion.p>

          {/* Apple Style Search Bar + Filter Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-3xl mx-auto flex gap-3 mt-8 relative z-0"
          >
            <div className="relative group flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Eşya veya kategori ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/95 backdrop-blur-md text-slate-800 placeholder-slate-400 rounded-full py-3.5 pl-12 pr-10 text-base shadow-sm border border-white/20 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all relative z-0"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                  <div className="p-1 rounded-full bg-slate-100 hover:bg-slate-200">
                    <X className="w-4 h-4" />
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={() => setIsFilterPanelOpen(true)}
              className="bg-white/95 backdrop-blur-md text-slate-700 hover:text-emerald-600 px-5 rounded-full font-medium shadow-sm border border-white/20 hover:border-emerald-300 transition-all flex items-center gap-2 group relative"
            >
              <SlidersHorizontal className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline text-base">Filtrele</span>
              {/* Filter Count Indicator */}
              {activeCategories.length +
                activeCities.length +
                activeDistricts.length >
                0 && (
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 flex flex-col justify-center items-center rounded-full border border-emerald-900">
                  {activeCategories.length +
                    activeCities.length +
                    activeDistricts.length}
                </span>
              )}
            </button>
          </motion.div>

          {/* Filter Badges Sidebar Replacements */}
          {(activeCategories.length > 0 ||
            activeCities.length > 0 ||
            activeDistricts.length > 0) && (
            <div className="max-w-3xl mx-auto mt-4 flex flex-wrap gap-2 items-center justify-center">
              {activeCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-emerald-300/30 text-emerald-50 text-sm font-medium shadow-sm"
                >
                  {cat}
                  <button
                    onClick={() => removeFilter('category', cat)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              {activeCities.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-emerald-300/30 text-emerald-50 text-sm font-medium shadow-sm"
                >
                  {city}
                  <button
                    onClick={() => removeFilter('city', city)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              {activeDistricts.map((dist) => (
                <span
                  key={dist}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-emerald-300/30 text-emerald-50 text-sm font-medium shadow-sm"
                >
                  {dist}
                  <button
                    onClick={() => removeFilter('district', dist)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-sm text-emerald-200 hover:text-white underline underline-offset-2 ml-2 transition-colors"
              >
                Temizle
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Vitrin */}
      <main className="w-full px-6 lg:px-12 xl:px-24 2xl:px-32 py-8 sm:py-12">
        <div>
          <div>
            <div className="flex flex-col items-center justify-center gap-4 mb-10 text-center">
              <div className="space-y-1.5">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    {activeTab === 'donation' ? (
                      <>
                        Döngüdeki Eşyalar{' '}
                        <span className="text-emerald-500 animate-pulse text-xl">
                          ✨
                        </span>
                      </>
                    ) : activeTab === 'exchange' ? (
                      <>
                        Takas Havuzu{' '}
                        <RefreshCw className="text-emerald-600 w-5 h-5 animate-spin-slow" />
                      </>
                    ) : activeTab === 'REQUESTING' ? (
                      <>
                        Aranan Eşyalar{' '}
                        <span className="text-blue-500 animate-pulse text-xl">
                          🎯
                        </span>
                      </>
                    ) : (
                      <>
                        Tüm Paylaşımlar{' '}
                        <span className="text-emerald-500 text-xl">🌍</span>
                      </>
                    )}
                  </h2>
                  <p className="text-sm md:text-base text-slate-500 font-medium max-w-xl px-4">
                    {activeTab === 'donation'
                      ? 'İyilik döngüsüne katılan son paylaşımlar.'
                      : activeTab === 'exchange'
                        ? 'Teklif bekleyen ve yeni sahiplerini arayan özel eşyalar.'
                        : activeTab === 'REQUESTING'
                          ? 'Başkalarının ihtiyacı olan aranan eşyalar.'
                          : 'Döngüdeki tüm paylaşımlar ve takaslık eşyalar bir arada.'}
                  </p>
                </motion.div>
              </div>

              <div className="relative p-1 bg-slate-100/50 backdrop-blur-md rounded-full border border-slate-200/60 shadow-inner flex items-center gap-1 w-full max-w-[440px] mx-auto overflow-x-auto scrollbar-hide">
                {[
                  { id: 'all', label: 'Hepsi', icon: Package },
                  { id: 'donation', label: 'Döngüde', icon: Recycle },
                  { id: 'exchange', label: 'Takaslık', icon: RefreshCw },
                  { id: 'REQUESTING', label: 'Var Mı?', icon: Search },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold transition-all relative ${
                      activeTab === tab.id
                        ? 'text-white'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTabBg"
                        className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/20 z-0"
                        transition={{
                          type: 'spring',
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <tab.icon
                        className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}
                      />
                      {tab.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SkeletonCard key={n} />
                ))}
              </div>
            ) : (
              <>
                {filteredItems.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-lg">
                      Aradığınız kriterlere uygun eşya bulunamadı.
                    </p>
                    <button
                      onClick={clearAllFilters}
                      className="mt-4 text-emerald-600 hover:underline font-medium"
                    >
                      Filtreleri Temizle
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                    {filteredItems.map((item) => (
                      <Link
                        to={`/items/${item.id}`}
                        key={item.id}
                        className="group"
                        onClick={handleItemClick}
                      >
                        <ItemCard
                          title={item.title}
                          imageUrl={
                            item.images && item.images.length > 0
                              ? item.images[0]
                              : item.imageUrl ||
                                'https://via.placeholder.com/300'
                          }
                          drawDate={item.drawDate}
                          status={item.status}
                          participants={item.applicationsCount || 0}
                          ownerAvatar={item.owner?.avatarUrl || null}
                          ownerName={item.owner?.fullName || null}
                          ownerKarmaPoint={item.owner?.karmaPoint || 0}
                          category={item.category}
                          city={item.city}
                          district={item.district}
                          postType={item.postType}
                          selectionType={item.selectionType}
                          shareType={item.shareType}
                          deliveryMethods={item.deliveryMethods}
                          isFavorited={favoriteIds.includes(item.id)}
                          onFavoriteToggle={(e) =>
                            handleFavoriteToggle(e, item.id)
                          }
                          onJoinClick={(e) => handleJoinClick(e, item.id)}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Custom Filter Sidebar Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        onApply={handleApplyFilters}
        categories={categories}
        initialCategories={activeCategories}
        initialCities={activeCities}
        initialDistricts={activeDistricts}
      />
    </div>
  );
};

export default Home;
