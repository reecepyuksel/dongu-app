import React, { useState } from 'react';
import { Clock, Users, MapPin, ImageOff, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export const ItemCard = ({
  title,
  imageUrl,
  drawDate,
  status,
  participants,
  ownerAvatar,
  ownerName,
  category,
  city,
  district,
  selectionType,
  shareType,
  deliveryMethods,
  isFavorited,
  onFavoriteToggle,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Calculate if ended
  const isEnded =
    status === 'GIVEN_AWAY' ||
    status === 'DRAW_PENDING' ||
    (drawDate && new Date(drawDate) < new Date());

  // Time ago string
  const timeAgoStr = drawDate
    ? formatDistanceToNow(new Date(drawDate), { locale: tr })
    : '';

  return (
    <motion.div
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 h-full flex flex-col"
    >
      {/* Image Container */}
      <div className="relative h-64 aspect-[4/3] overflow-hidden bg-slate-100">
        {/* Skeleton placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 animate-pulse bg-slate-200" />
        )}

        {imageError || !imageUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <ImageOff className="w-12 h-12 mb-2 opacity-50" />
            <span className="text-sm font-medium opacity-70">Görsel Yok</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

        {/* Top Badges Area */}
        <div className="absolute top-4 left-0 w-full px-4 flex justify-between items-start z-30 pointer-events-none">
          {/* Left Badges */}
          <div className="flex flex-col gap-2 items-start pointer-events-auto">
            {/* Selection Type Badge */}
            {selectionType && shareType !== 'exchange' && (
              <div
                className={`bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1 ${selectionType === 'manual' ? 'text-violet-700' : 'text-purple-700'}`}
              >
                <span>
                  {selectionType === 'manual' ? '👆 Döngüde' : '🎲 Çekiliş'}
                </span>
              </div>
            )}

            {/* Trade Badge */}
            {shareType === 'exchange' && (
              <div className="bg-emerald-600/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-black text-white shadow-xl flex items-center gap-1 border border-emerald-400">
                <span className="text-sm animate-pulse-slow">🔄</span> TAKAS
              </div>
            )}

            {/* Completed Badge */}
            {isEnded && (
              <div className="bg-slate-800/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-sm border border-slate-600">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  {timeAgoStr ? `${timeAgoStr} önce bitti` : 'Tamamlandı'}
                </span>
              </div>
            )}
          </div>

          {/* Right Badges */}
          <div className="pointer-events-auto">
            {/* Favorite (Heart) Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onFavoriteToggle) onFavoriteToggle(e);
              }}
              className="p-2 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white/50 hover:bg-white hover:scale-110 transition-all duration-200 group/fav"
            >
              <Heart
                className={`w-4 h-4 transition-colors duration-300 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400 group-hover/fav:text-red-400'}`}
              />
            </button>
          </div>
        </div>

        {/* Category Badge */}
        {category && (
          <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm border border-white/20">
            {category}
          </div>
        )}

        {/* Location Badge */}
        {(city || district) && (
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-700 flex items-center gap-1 shadow-sm">
            <MapPin className="w-3 h-3 text-emerald-600" />
            <span>{district ? `${district}, ${city}` : city}</span>
          </div>
        )}

        {/* Hover effect overlay */}
        {!isEnded && (
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10"></div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        {deliveryMethods && deliveryMethods.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {deliveryMethods.includes('mutual_agreement') && (
              <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-md text-[10px] font-bold border border-violet-100">
                💬 Anlaşmalı Teslim
              </span>
            )}
            {(deliveryMethods.includes('shipping') ||
              deliveryMethods.includes('shipping_buyer') ||
              deliveryMethods.includes('shipping_seller')) && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold border border-blue-100">
                📦 Kargo
              </span>
            )}
            {deliveryMethods.includes('pickup') && (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold border border-emerald-100">
                📍 Gel-Al
              </span>
            )}
          </div>
        )}
        <h3 className="text-xl font-bold text-slate-800 mb-2 truncate font-[Outfit]">
          {title}
        </h3>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
              {ownerAvatar ? (
                <img
                  src={ownerAvatar}
                  alt="Owner"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">
                  {ownerName ? ownerName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            {ownerName && (
              <span className="text-[11px] font-bold text-slate-700">
                {ownerName}
              </span>
            )}
          </div>

          {shareType !== 'exchange' && (
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              <Users className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-slate-700">{participants}</span>
              <span className="text-xs">katılımcı</span>
            </div>
          )}
        </div>

        {/* Progress Bar - only show when there are participants */}
        {shareType !== 'exchange' && participants > 0 && (
          <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.min(participants * 5, 100)}%` }}
            />
          </div>
        )}

        {/* Hover detail link */}
        <p className="mt-auto pt-3 text-xs text-slate-400 group-hover:text-emerald-600 transition-colors font-medium text-right">
          Detayları İncele →
        </p>
      </div>
    </motion.div>
  );
};
