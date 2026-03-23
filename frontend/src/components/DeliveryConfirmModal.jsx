import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Upload, CheckCircle, Loader2 } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const DeliveryConfirmModal = ({ isOpen, onClose, itemId, onSuccess }) => {
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const confirmDelivery = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      if (file) {
        formData.append('image', file);
      }

      await api.post(`/items/${itemId}/confirm-delivery`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showToast(
        'Harika! Teslimat onaylandı ve +100 İyilik Puanı kazandın. 🎉',
        'success',
      );
      onSuccess();
      onClose();
    } catch (error) {
      showToast(
        error.response?.data?.message || 'Onaylanırken bir hata oluştu.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative"
        >
          {/* Header */}
          <div className="bg-emerald-500 p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <CheckCircle className="w-24 h-24 text-white" />
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-emerald-100 hover:text-white transition-colors z-10 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <span className="text-3xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-white font-[Outfit]">
                Mutlu Son!
              </h2>
              <p className="text-emerald-50 text-sm mt-1">
                Eşyanızı teslim aldınız, harika!
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6 space-y-3">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-3 text-sm text-amber-800 font-medium">
                <span className="text-xl">✨</span>
                <p>
                  Onay işlemiyle birlikte hem paylaşım sahibi hem de sana{' '}
                  <strong>+100 İyilik Puanı</strong> anında eklenecek.
                </p>
              </div>
              <p className="text-sm text-slate-500 font-medium text-center">
                İsteğe bağlı olarak bu güzel anı bir fotoğrafla
                ölümsüzleştirebilirsin! (Döngü Kanıtı)
              </p>
            </div>

            {/* Image Upload Area */}
            <div className="mb-6">
              {!preview ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-500 rounded-full flex items-center justify-center mb-3 transition-colors">
                      <Camera className="w-6 h-6" />
                    </div>
                    <p className="mb-1 text-sm font-bold text-slate-600">
                      Mutlu Son Fotoğrafı Yükle
                    </p>
                    <p className="text-xs text-slate-400">
                      Tıkla veya sürükle (İsteğe Bağlı)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                  />
                </label>
              ) : (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden group border border-slate-200 shadow-sm">
                  <img
                    src={preview}
                    alt="Kanıt Önizleme"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <label className="cursor-pointer bg-white text-slate-800 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Fotoğrafı Değiştir
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition"
              >
                İptal
              </button>
              <button
                onClick={confirmDelivery}
                disabled={loading}
                className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Onaylanıyor..
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Teslim Aldım, Onayla!
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DeliveryConfirmModal;
