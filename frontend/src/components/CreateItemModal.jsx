import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import citiesData from '../data/cities.json';
import SearchableSelect from './SearchableSelect';

// Zod şeması
const createItemSchema = z
  .object({
    postType: z.enum(['OFFERING', 'REQUESTING']),
    title: z.string().min(5, 'Başlık en az 5 karakter olmalı'),
    description: z.string().min(20, 'Açıklama en az 20 karakter olmalı'),
    category: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    neighborhood: z.string().optional(),
    shareType: z.enum(['donation', 'exchange']),
    tradePreferences: z.string().optional(),
    selectionType: z.enum(['lottery', 'manual']),
    deliveryMethods: z.enum(['pickup', 'shipping', 'mutual_agreement'], {
      required_error: 'Lütfen bir teslimat yöntemi seçiniz',
    }),
    drawDate: z.string().optional(), // Manuel seçimde opsiyonel
    visibilityScope: z.enum(['PUBLIC', 'COMMUNITY']),
    communityId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'Lütfen şehir seçiniz',
      });
    }

    if (!values.district) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['district'],
        message: 'Lütfen ilçe seçiniz',
      });
    }

    if (values.visibilityScope === 'COMMUNITY' && !values.communityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['communityId'],
        message: 'Topluluk içinde paylaşmak için bir topluluk seçmelisiniz.',
      });
    }
  });

const CreateItemModal = ({ isOpen, onClose, onItemCreated }) => {
  const [step, setStep] = useState(0);
  const [previews, setPreviews] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [myCommunities, setMyCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();
  const { fetchUser, isAuthenticated } = useAuth();

  // Şehir/İlçe Verisi (JSON'dan Çekiliyor)
  const cities = citiesData.cities;
  const districtsData = citiesData.districtsData;

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    reset,
    setValue,
    trigger,
  } = useForm({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      postType: 'OFFERING',
      deliveryMethods: 'mutual_agreement',
      selectionType: 'manual',
      shareType: 'donation',
      tradePreferences: '',
      visibilityScope: 'PUBLIC',
      communityId: '',
    },
  });

  const selectedCity = watch('city');
  const selectedMethod = watch('deliveryMethods');
  const selectionType = watch('selectionType');
  const shareType = watch('shareType');
  const postType = watch('postType');
  const visibilityScope = watch('visibilityScope');
  const selectedCommunityId = watch('communityId');
  const isRequesting = postType === 'REQUESTING';
  const totalSteps = isRequesting ? 2 : 3;
  const selectedCommunity = myCommunities.find(
    (community) => community.id === selectedCommunityId,
  );

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (isRequesting) {
      setValue('shareType', 'donation');
      setValue('selectionType', 'manual');
      setValue('deliveryMethods', 'mutual_agreement');
      setValue('tradePreferences', '');
    }
  }, [isOpen, isRequesting, setValue]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) {
      setMyCommunities([]);
      return;
    }

    let mounted = true;

    const fetchCommunities = async () => {
      try {
        setCommunitiesLoading(true);
        const response = await api.get('/communities/my');
        if (mounted) {
          setMyCommunities(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        if (mounted) {
          setMyCommunities([]);
        }
      } finally {
        if (mounted) {
          setCommunitiesLoading(false);
        }
      }
    };

    fetchCommunities();

    return () => {
      mounted = false;
    };
  }, [isOpen, isAuthenticated]);

  const processFiles = (files) => {
    if (files.length > 0) {
      if (selectedFiles.length + files.length > 5) {
        showToast('En fazla 5 görsel yükleyebilirsiniz', 'error');
        return;
      }
      const validFiles = [...selectedFiles];
      const objectUrls = [...previews];

      for (let file of files) {
        if (file.size > 5 * 1024 * 1024) {
          showToast(`${file.name} boyutu 5MB'dan büyük!`, 'error');
          continue;
        }
        validFiles.push(file);
        objectUrls.push(URL.createObjectURL(file));
      }
      setSelectedFiles(validFiles);
      setPreviews(objectUrls);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter((file) =>
      file.type.startsWith('image/'),
    );
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (indexToRemove, e) => {
    e.stopPropagation();
    e.preventDefault();
    setPreviews((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (coverIndex === indexToRemove) setCoverIndex(0);
    else if (coverIndex > indexToRemove) setCoverIndex((prev) => prev - 1);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/'),
    );
    processFiles(files);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (postType === 'OFFERING' && selectedFiles.length === 0) {
        showToast('Lütfen en az bir görsel yükleyin', 'error');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const isValid = await trigger([
        'title',
        'category',
        'description',
        'city',
        'district',
        'neighborhood',
      ]);
      if (isValid) setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 0) return;
    if (step === 1) {
      setStep(0);
      return;
    }
    if (isRequesting && step === 2) {
      setStep(1);
      return;
    }
    if (step > 1) setStep(step - 1);
  };

  const resetForm = () => {
    reset();
    setPreviews([]);
    setSelectedFiles([]);
    setStep(0);
    setCoverIndex(0);
  };

  const startOfferingFlow = () => {
    if (visibilityScope === 'COMMUNITY' && !selectedCommunityId) {
      showToast('Topluluk seçmeden devam edemezsiniz.', 'info');
      return;
    }
    setValue('postType', 'OFFERING');
    setValue('shareType', 'donation');
    setValue('selectionType', 'manual');
    setValue('deliveryMethods', 'mutual_agreement');
    setStep(1);
  };

  const startRequestingFlow = () => {
    if (visibilityScope === 'COMMUNITY' && !selectedCommunityId) {
      showToast('Topluluk seçmeden devam edemezsiniz.', 'info');
      return;
    }
    setValue('postType', 'REQUESTING');
    setValue('shareType', 'donation');
    setValue('selectionType', 'manual');
    setValue('deliveryMethods', 'mutual_agreement');
    setStep(1);
  };

  const onSubmit = async (data) => {
    if (data.postType === 'OFFERING' && selectedFiles.length === 0) return;

    try {
      setIsSubmitting(true);
      const resolvedCity =
        data.postType === 'REQUESTING' ? data.city : data.city;
      const resolvedDistrict =
        data.postType === 'REQUESTING' ? data.district : data.district;
      const resolvedShareType =
        data.postType === 'REQUESTING' ? 'donation' : data.shareType;
      const resolvedSelectionType =
        data.postType === 'REQUESTING'
          ? 'manual'
          : data.shareType === 'exchange'
            ? 'manual'
            : data.selectionType;
      const resolvedDeliveryMethod =
        data.postType === 'REQUESTING'
          ? 'mutual_agreement'
          : data.deliveryMethods;

      const formData = new FormData();
      formData.append('postType', data.postType);
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category || '');
      formData.append('city', resolvedCity || '');
      formData.append('district', resolvedDistrict || '');
      formData.append('neighborhood', data.neighborhood || '');
      if (data.drawDate && data.selectionType !== 'manual') {
        formData.append('drawDate', new Date(data.drawDate).toISOString());
      }

      // Reorder files so cover photo is first
      const reorderedFiles = [...selectedFiles];
      if (coverIndex > 0 && coverIndex < reorderedFiles.length) {
        const coverFile = reorderedFiles.splice(coverIndex, 1)[0];
        reorderedFiles.unshift(coverFile);
      }
      reorderedFiles.forEach((file) => {
        formData.append('images', file);
      });

      formData.append('deliveryMethods', resolvedDeliveryMethod);
      formData.append('selectionType', resolvedSelectionType);
      formData.append('shareType', resolvedShareType);
      if (data.visibilityScope === 'COMMUNITY' && data.communityId) {
        formData.append('communityId', data.communityId);
      }
      if (resolvedShareType === 'exchange' && data.tradePreferences) {
        formData.append('tradePreferences', data.tradePreferences);
      }

      await api.post('/items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (fetchUser) fetchUser(); // Update Karma on UI instantly

      showToast('İlan başarıyla oluşturuldu! 🎉', 'success');
      resetForm();
      onItemCreated();
      onClose();
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message ||
          'Paylaşım başlatılırken bir hata oluştu, lütfen tekrar deneyin.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const stepTitle =
    step === 0
      ? 'İlan Türü Seçimi'
      : step === 1
        ? isRequesting
          ? 'Fotoğraf (Opsiyonel)'
          : 'Görseller & Paylaşım Türü'
        : step === 2
          ? isRequesting
            ? 'İhtiyaç Bilgileri'
            : 'Eşya Detayları'
          : 'Seçim & Teslimat';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header with Progress Bar */}
          <div className="relative border-b border-slate-100 flex-shrink-0">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{
                  width: `${step === 0 ? 0 : (step / totalSteps) * 100}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  {stepTitle}
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  {step === 0 ? 'Başlangıç' : `Adım ${step} / ${totalSteps}`}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Form Area */}
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {step === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-slate-500">
                  İlan türünü ve yayın alanını seçin.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={startOfferingFlow}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30"
                  >
                    <div className="text-lg font-bold text-slate-900">
                      Bende Var
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Sahip olduğunuz ürünü paylaşın.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={startRequestingFlow}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30"
                  >
                    <div className="text-lg font-bold text-slate-900">
                      Var mı?
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      İhtiyacınızı hızlıca yayınlayın.
                    </p>
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Yayın Alanı
                  </label>

                  <div className="grid gap-3">
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${visibilityScope === 'PUBLIC' ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white'}`}
                    >
                      <input
                        type="radio"
                        checked={visibilityScope === 'PUBLIC'}
                        onChange={() => {
                          setValue('visibilityScope', 'PUBLIC');
                          setValue('communityId', '');
                        }}
                        className="mt-1 h-4 w-4 text-slate-900"
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Genel Döngü
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          İlan herkes tarafından görülebilir.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${visibilityScope === 'COMMUNITY' ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white'}`}
                    >
                      <input
                        type="radio"
                        checked={visibilityScope === 'COMMUNITY'}
                        onChange={() =>
                          setValue('visibilityScope', 'COMMUNITY')
                        }
                        className="mt-1 h-4 w-4 text-slate-900"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800">
                          Topluluk
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          İlan sadece seçtiğiniz topluluk üyelerine görünür.
                        </div>
                        <select
                          value={selectedCommunityId || ''}
                          onChange={(e) =>
                            setValue('communityId', e.target.value, {
                              shouldValidate: true,
                            })
                          }
                          disabled={
                            visibilityScope !== 'COMMUNITY' ||
                            communitiesLoading ||
                            myCommunities.length === 0
                          }
                          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {communitiesLoading
                              ? 'Topluluklar yükleniyor...'
                              : myCommunities.length === 0
                                ? 'Henüz üye olduğun topluluk yok'
                                : 'Topluluk seçin'}
                          </option>
                          {myCommunities.map((community) => (
                            <option key={community.id} value={community.id}>
                              {community.name}
                            </option>
                          ))}
                        </select>
                        {errors.communityId && (
                          <p className="mt-2 text-xs font-medium text-red-500">
                            {errors.communityId.message}
                          </p>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {visibilityScope === 'COMMUNITY' && selectedCommunity && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Topluluk:{' '}
                    <span className="font-semibold">
                      {selectedCommunity.name}
                    </span>
                  </div>
                )}

                {!isRequesting && (
                  <>
                    {/* Type Selection Header */}
                    <div className="space-y-3 mb-6">
                      <label className="block text-base font-bold text-slate-800 text-center mb-2">
                        Paylaşım Türünü Seçin
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label
                          className={`flex flex-col items-center justify-center p-5 border-2 rounded-[20px] cursor-pointer transition-all ${shareType === 'donation' ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-emerald-200 bg-slate-50 hover:bg-white'}`}
                        >
                          <input
                            type="radio"
                            value="donation"
                            {...register('shareType')}
                            className="sr-only"
                          />
                          <div className="text-4xl mb-3">🎁</div>
                          <span className="text-base font-bold text-slate-800">
                            Döngüye Kat
                          </span>
                          <span className="text-xs text-slate-500 font-medium mt-1">
                            Karşılıksız iyilik yap
                          </span>
                        </label>
                        <label
                          className={`flex flex-col items-center justify-center p-5 border-2 rounded-[20px] cursor-pointer transition-all ${shareType === 'exchange' ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-emerald-200 bg-slate-50 hover:bg-white'}`}
                        >
                          <input
                            type="radio"
                            value="exchange"
                            {...register('shareType')}
                            className="sr-only"
                          />
                          <div className="text-4xl mb-3">🔄</div>
                          <span className="text-base font-bold text-slate-800">
                            Takaslık
                          </span>
                          <span className="text-xs text-slate-500 font-medium mt-1">
                            Eşyaları değiştir
                          </span>
                        </label>
                      </div>
                    </div>

                    <hr className="border-slate-100" />
                  </>
                )}

                {isRequesting && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    İhtiyaç ilanı için il ve ilçe seçimi zorunludur.
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    Eşya Görselleri{' '}
                    {isRequesting && (
                      <span className="text-sm text-slate-400 font-normal">
                        (İsteğe Bağlı)
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {isRequesting
                      ? 'Aradığın eşyayı anlatan örnek görsel ekleyebilirsin.'
                      : 'Eşyayı en iyi anlatan net fotoğraflar yükleyin. İlk fotoğraf kapak olacaktır.'}
                  </p>

                  {/* Sürükle Bırak Alanı */}
                  <div
                    className={`w-full aspect-video sm:aspect-[21/9] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 transition-colors cursor-pointer
                                            ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/50'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-emerald-500 transition-transform group-hover:scale-110">
                      <Upload className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-700 mb-1">
                      Fotoğrafları Sürükleyin veya Tıklayın
                    </h4>
                    <p className="text-sm text-slate-500 text-center font-medium">
                      PNG, JPG (En fazla 5 görsel, max 5MB/adet)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      ref={fileInputRef}
                    />
                  </div>
                </div>

                {/* Yüklenenler Önizleme Grid'i */}
                {previews.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Yüklenenler (Kapak seçmek için tıklayın)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {previews.map((preview, idx) => (
                        <div
                          key={idx}
                          onClick={() => setCoverIndex(idx)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 
                                                        ${coverIndex === idx ? 'ring-4 ring-emerald-500 shadow-md scale-105 z-10' : 'border border-slate-200 hover:border-emerald-300'}`}
                        >
                          <img
                            src={preview}
                            alt={`Preview ${idx}`}
                            className="w-full h-full object-cover"
                          />

                          {coverIndex === idx && (
                            <div className="absolute inset-x-0 bottom-0 bg-emerald-500/90 py-1.5 text-center backdrop-blur-sm">
                              <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                                Kapak Fotoğrafı
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => removeFile(idx, e)}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur-sm shadow-sm rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50/90 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {isRequesting && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Bu akışta paylaşım türü, seçim yöntemi ve teslimat tipi
                    otomatik ayarlanır.
                  </div>
                )}

                {visibilityScope === 'COMMUNITY' && selectedCommunity && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Topluluk:{' '}
                    <span className="font-semibold">
                      {selectedCommunity.name}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">
                    {isRequesting ? 'Ne Arıyorsun?' : 'Başlık'}
                  </label>
                  <input
                    {...register('title')}
                    type="text"
                    placeholder={
                      isRequesting
                        ? 'Örn: Çocuk çalışma masası arıyorum'
                        : 'Örn: Az kullanılmış Bisiklet'
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-800 placeholder:font-normal"
                  />
                  {errors.title && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {!isRequesting && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">
                      Kategori
                    </label>
                    <select
                      {...register('category')}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 bg-white"
                    >
                      <option value="Diğer">
                        Kategori Seçiniz (İsteğe bağlı)
                      </option>
                      <option value="Elektronik">Elektronik</option>
                      <option value="Giyim">Giyim</option>
                      <option value="Kitap">Kitap</option>
                      <option value="Ev Eşyası">Ev Eşyası</option>
                      <option value="Hobi">Hobi</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                )}

                {!isRequesting && shareType === 'exchange' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <label className="block text-sm font-semibold text-emerald-700">
                      Karşılığında Ne Bekliyorsun?
                    </label>
                    <textarea
                      {...register('tradePreferences')}
                      rows={2}
                      placeholder="Örn: Sadece kitap veya nostaljik eşyalarla takas edebilirim..."
                      className="w-full px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none text-emerald-900 leading-relaxed placeholder:text-emerald-600/50 font-medium"
                    />
                  </motion.div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">
                    Açıklama
                  </label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    placeholder={
                      isRequesting
                        ? 'Neye ihtiyacın olduğunu ve neden aradığını kısaca anlat...'
                        : 'Eşyanın hikayesi, kullanım süresi veya neden yeni sahibini aradığı hakkında samimi bir dille bilgi verin...'
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-slate-800 leading-relaxed font-medium"
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500 font-medium">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative z-50">
                      <label className="block text-sm font-semibold text-slate-700">
                        İl
                      </label>
                      <Controller
                        name="city"
                        control={control}
                        render={({ field }) => (
                          <SearchableSelect
                            options={cities}
                            value={field.value}
                            onChange={(val) => {
                              field.onChange(val);
                              setValue('district', '');
                            }}
                            placeholder="İl seçiniz"
                          />
                        )}
                      />
                      {errors.city && (
                        <p className="text-xs text-red-500 font-medium">
                          {errors.city.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 relative z-40">
                      <label className="block text-sm font-semibold text-slate-700">
                        İlçe
                      </label>
                      <Controller
                        name="district"
                        control={control}
                        render={({ field }) => (
                          <SearchableSelect
                            options={
                              selectedCity ? districtsData[selectedCity] : []
                            }
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="İlçe seçiniz"
                            disabled={!selectedCity}
                          />
                        )}
                      />
                      {errors.district && (
                        <p className="text-xs text-red-500 font-medium">
                          {errors.district.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isRequesting && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-semibold text-slate-700">
                        Mahalle{' '}
                        <span className="text-slate-400 font-normal text-xs">
                          (İsteğe Bağlı)
                        </span>
                      </label>
                      <input
                        {...register('neighborhood')}
                        type="text"
                        placeholder="Örn: Merkez Mah."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                      />
                    </div>
                  )}
                </>
              </motion.div>
            )}

            {step === 3 && !isRequesting && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold">Görünürlük</h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {visibilityScope === 'COMMUNITY' && selectedCommunity
                      ? `Bu ilan sadece ${selectedCommunity.name} üyelerine gösterilir.`
                      : 'Bu ilan genel vitrinde herkese gösterilir.'}
                  </p>
                </div>

                {shareType === 'donation' && (
                  <>
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-700">
                        Yeni Sahibi Belirleme Yöntemi
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label
                          className={`flex flex-col items-center justify-center p-5 border-2 rounded-2xl cursor-pointer transition-all ${selectionType === 'lottery' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-200 bg-white'}`}
                        >
                          <input
                            type="radio"
                            value="lottery"
                            {...register('selectionType')}
                            className="sr-only"
                          />
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 text-2xl">
                            🎲
                          </div>
                          <span className="text-sm font-bold text-slate-800 mb-1">
                            Çekiliş Usulü
                          </span>
                          <span className="text-xs text-slate-500 text-center px-2">
                            Sistem adil bir şekilde rastgele seçer
                          </span>
                        </label>
                        <label
                          className={`flex flex-col items-center justify-center p-5 border-2 rounded-2xl cursor-pointer transition-all ${selectionType === 'manual' ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-200 bg-white'}`}
                        >
                          <input
                            type="radio"
                            value="manual"
                            {...register('selectionType')}
                            className="sr-only"
                          />
                          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 text-2xl">
                            👆
                          </div>
                          <span className="text-sm font-bold text-slate-800 mb-1">
                            Manuel Seçim
                          </span>
                          <span className="text-xs text-slate-500 text-center px-2">
                            Adayları inceleyerek bizzat seçersiniz
                          </span>
                        </label>
                      </div>
                    </div>

                    {selectionType !== 'manual' && (
                      <div className="space-y-1.5 mt-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <label className="block text-sm font-semibold text-slate-700">
                          Çekiliş Tarihi
                        </label>
                        <p className="text-xs text-slate-500 mb-3 font-medium">
                          Çekilişin sistem tarafından otomatik yapılacağı zamanı
                          belirleyin.
                        </p>
                        <input
                          {...register('drawDate')}
                          type="datetime-local"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 bg-white shadow-sm font-medium"
                        />
                        {errors.drawDate && (
                          <p className="text-xs text-red-500 font-bold mt-1.5">
                            {errors.drawDate.message}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {shareType === 'exchange' && (
                  <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex gap-4 items-center">
                    <div className="text-3xl">🤝</div>
                    <div>
                      <h4 className="font-bold text-emerald-800 mb-1">
                        Takas Şartları
                      </h4>
                      <p className="text-sm text-emerald-700 leading-snug">
                        Takas gönderilerinde çekiliş sistemi bulunmaz.
                        Paylaşımınıza gelen teklifleri bizzat inceleyerek yeni
                        sahibini kendiniz kararlaştırırsınız.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Teslimat Yöntemleri
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        id: 'pickup',
                        icon: '📍',
                        label: 'Elden Teslim',
                        desc: 'Yeni sahibi belirttiğiniz konuma gelip teslim alır.',
                      },
                      {
                        id: 'shipping',
                        icon: '📦',
                        label: 'Kargo',
                        desc: 'Teslimat kargo ile gerçekleştirilir.',
                      },
                      {
                        id: 'mutual_agreement',
                        icon: '💬',
                        label: 'Karşılıklı Anlaşma',
                        desc: 'Teslimat yöntemi sohbet üzerinden birlikte belirlenir.',
                      },
                    ].map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-start p-4 border rounded-2xl cursor-pointer transition-all group ${selectedMethod === method.id ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300 bg-white'}`}
                      >
                        <div className="pt-0.5">
                          <input
                            type="radio"
                            value={method.id}
                            {...register('deliveryMethods')}
                            className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300 mt-1 cursor-pointer"
                          />
                        </div>
                        <div className="ml-3 flex-1">
                          <span className="text-slate-800 font-bold flex items-center gap-2">
                            <span className="text-lg">{method.icon}</span>{' '}
                            {method.label}
                          </span>
                          <p className="text-xs text-slate-500 mt-1">
                            {method.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.deliveryMethods && (
                    <p className="text-xs text-red-500 font-medium pl-1">
                      {errors.deliveryMethods.message}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
            {step > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" /> Geri
              </button>
            ) : (
              <div /> // Spacer if no back button
            )}

            {step === 0 ? (
              <div className="text-xs font-medium text-slate-500">
                Bir ilan akışı seçerek devam et.
              </div>
            ) : step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95"
              >
                İleri <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className={`px-8 py-3 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 ${isRequesting ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400' : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 shadow-emerald-600/20'}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Paylaşılıyor...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />{' '}
                    {isRequesting ? 'Var mı?' : 'Döngüyü Başlat'}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateItemModal;
