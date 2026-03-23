import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Loader2, ArrowRight, Camera } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const TradeOfferModal = ({
  isOpen,
  onClose,
  targetItemId,
  targetItemTitle,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeItems, setActiveItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [offerType, setOfferType] = useState('item');
  const [manualOfferText, setManualOfferText] = useState('');
  const [sending, setSending] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  useEffect(() => {
    if (isOpen && user?.id) {
      setOfferType('item');
      setManualOfferText('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setVideoFile(null);
      setVideoPreview(null);
      setSelectedItemId(null);
      fetchUserItems();
    }
  }, [isOpen, user]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const fetchUserItems = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${user.id}/profile`);
      if (response.data && response.data.activeItems) {
        // Sadece Takas ya da her şeyi sunabilir, varsayılan olarak her şey sunulabilir.
        setActiveItems(response.data.activeItems);
      }
    } catch (error) {
      console.error('Error fetching user items', error);
      showToast('Eşyalarınız listelenirken bir sorun oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOffer = async () => {
    if (offerType === 'item' && !selectedItemId) {
      showToast('Lütfen teklif etmek için bir eşya seçin.', 'info');
      return;
    }
    if (offerType === 'text' && !manualOfferText.trim()) {
      showToast('Lütfen teklifinizi yazın.', 'info');
      return;
    }

    setSending(true);
    try {
      let config = {};
      let payload;

      if (photoFile || videoFile) {
        payload = new FormData();
        payload.append('targetItemId', targetItemId);
        if (offerType === 'item') {
          payload.append('offeredItemId', selectedItemId);
        } else {
          payload.append('manualOfferText', manualOfferText);
        }
        if (photoFile) payload.append('photo', photoFile);
        if (videoFile) payload.append('video', videoFile);
        // NOT: Axios'un FormData'yı algılayıp boundary ekleyebilmesi için Content-Type başlığını manuel ezmiyoruz.
        config = {};
      } else {
        payload = { targetItemId };
        if (offerType === 'item') {
          payload.offeredItemId = selectedItemId;
        } else {
          payload.manualOfferText = manualOfferText;
        }
      }

      const response = await api.post(
        `/messages/trade-offer/send`,
        payload,
        config,
      );
      showToast('Takas teklifiniz başarıyla gönderildi! 🔄', 'success');
      onSuccess?.(response.data);
      onClose();
    } catch (error) {
      console.error('Error sending trade offer', error);
      showToast(
        error.response?.data?.message || 'Takas teklifi gönderilemedi.',
        'error',
      );
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-emerald-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  Takas Teklifi Et
                </h2>
                <p className="text-xs font-medium text-slate-500 truncate max-w-[250px]">
                  <span className="text-slate-700 font-bold">
                    {targetItemTitle}
                  </span>{' '}
                  için bir döngü başlat
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="flex bg-slate-100 p-1 mb-5 rounded-xl">
              <button
                onClick={() => setOfferType('item')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  offerType === 'item'
                    ? 'bg-white shadow-sm text-emerald-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Zaten Vitrinimde Olan Bir Eşya
              </button>
              <button
                onClick={() => setOfferType('text')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  offerType === 'text'
                    ? 'bg-white shadow-sm text-emerald-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Farklı Bir Teklif / Açıklama
              </button>
            </div>

            {offerType === 'item' ? (
              <>
                <p className="text-sm text-slate-600 font-medium mb-4">
                  Takas için önermek istediğin eşyayı seçin:
                </p>

                {loading ? (
                  <div className="flex flex-col items-center justify-center p-8 text-emerald-600">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <span className="font-bold text-sm">
                      Eşyaların hazırlanıyor...
                    </span>
                  </div>
                ) : activeItems.length === 0 ? (
                  <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-3xl mb-3 block">📦</span>
                    <h3 className="font-bold text-slate-800 mb-1">
                      Henüz eşya eklememişsin
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Mevcut bir eşya seçmek yerine sekme değiştirerek doğrudan
                      teklifinizi yazabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {activeItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                          selectedItemId === item.id
                            ? 'border-emerald-500 bg-emerald-50/50'
                            : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <img
                            src={
                              item.imageUrl || 'https://via.placeholder.com/150'
                            }
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 truncate text-sm">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {item.category} • {item.city}
                          </p>
                        </div>
                        <div className="pr-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedItemId === item.id
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-slate-300'
                            }`}
                          >
                            {selectedItemId === item.id && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="animate-fade-in">
                <p className="text-sm text-slate-600 font-medium mb-2">
                  Takas için vereceğiniz eşyayı veya sunduğunuz şartları buraya
                  yazın:
                </p>
                <textarea
                  value={manualOfferText}
                  onChange={(e) => setManualOfferText(e.target.value)}
                  placeholder="Örn: Ev yapımı elma reçeli ve 2 adet okunmuş kitap ile takas edebilirim..."
                  className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                />
                <div className="flex bg-amber-50 rounded-xl p-3 border border-amber-100 items-start gap-3 mt-4">
                  <span className="text-lg leading-none pt-0.5">💡</span>
                  <p className="text-xs text-amber-800 font-medium">
                    Bu teklifi gönderdikten sonra aranızda direkt bir sohbet
                    başlar. Fotoğraf yüklemek isterseniz veya daha fazla detayı
                    sonrasında konuşarak tamamlarsınız.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  {/* Photo Upload */}
                  {!photoPreview ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition group">
                      <div className="flex flex-col items-center justify-center text-center px-2">
                        <div className="w-10 h-10 bg-slate-100 group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-500 rounded-full flex items-center justify-center mb-2 transition-colors">
                          <Camera className="w-5 h-5" />
                        </div>
                        <p className="mb-1 text-sm font-bold text-slate-600">
                          Fotoğraf Yükle
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  ) : (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden group border border-slate-200 shadow-sm bg-black">
                      <img
                        src={photoPreview}
                        alt="Fotoğraf Önizleme"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <label className="cursor-pointer bg-white text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-transform">
                          Değiştir
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handlePhotoChange}
                          />
                        </label>
                      </div>
                      <button
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Video Upload */}
                  {!videoPreview ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition group">
                      <div className="flex flex-col items-center justify-center text-center px-2">
                        <div className="w-10 h-10 bg-slate-100 group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-500 rounded-full flex items-center justify-center mb-2 transition-colors">
                          <span className="text-xl">📹</span>
                        </div>
                        <p className="mb-1 text-sm font-bold text-slate-600">
                          Video Yükle
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/*"
                        onChange={handleVideoChange}
                      />
                    </label>
                  ) : (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden group border border-slate-200 shadow-sm bg-black">
                      <video
                        src={videoPreview}
                        className="w-full h-full object-contain"
                        muted
                        autoPlay
                        loop
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <label className="cursor-pointer bg-white text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-transform">
                          Değiştir
                          <input
                            type="file"
                            className="hidden"
                            accept="video/*"
                            onChange={handleVideoChange}
                          />
                        </label>
                      </div>
                      <button
                        onClick={() => {
                          setVideoFile(null);
                          setVideoPreview(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-sm font-bold text-emerald-700">
                ⭐ Başarılı her takas size <span className="text-xl">+100</span>{' '}
                İyilik Puanı kazandırır!
              </p>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSendOffer}
              disabled={
                (offerType === 'item' && !selectedItemId) ||
                (offerType === 'text' && !manualOfferText.trim()) ||
                sending
              }
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...
                </>
              ) : (
                <>
                  Teklifi Gönder <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TradeOfferModal;
