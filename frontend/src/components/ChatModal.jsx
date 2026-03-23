import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle, User, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { io } from 'socket.io-client';

const ChatModal = ({
  isOpen,
  onClose,
  itemId,
  itemTitle,
  partnerName,
  partnerId,
  deliveryMethods,
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const profileRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && itemId) {
      fetchMessages();
    }
  }, [isOpen, itemId]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Init Socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !isOpen) return;

    const userId = JSON.parse(atob(token.split('.')[1]))?.sub;
    if (!userId) return;

    const newSocket = io(
      import.meta.env.VITE_API_URL?.replace('/api', '') ||
        'http://localhost:3005',
      {
        query: { userId },
      },
    );

    setSocket(newSocket);

    return () => newSocket.close();
  }, [isOpen]);

  // Socket Listeners
  useEffect(() => {
    if (!socket || !partnerId) return;

    socket.on('newMessage', (msg) => {
      if (
        (msg.sender?.id === partnerId || msg.receiver?.id === partnerId) &&
        (msg.item?.id === itemId || !msg.item)
      ) {
        setMessages((prev) => {
          if (!prev.find((m) => m.id === msg.id)) {
            return [...prev, msg];
          }
          return prev;
        });
      }
    });

    socket.on('typing', (data) => {
      if (data.fromUserId === partnerId) setIsTyping(true);
    });

    socket.on('stopTyping', (data) => {
      if (data.fromUserId === partnerId) setIsTyping(false);
    });

    return () => {
      socket.off('newMessage');
      socket.off('typing');
      socket.off('stopTyping');
    };
  }, [socket, partnerId, itemId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isTyping]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let res;
      if (partnerId) {
        // Partner ID varsa, kişi bazlı tüm geçmişi getir
        res = await api.get(`/messages/chat/${partnerId}`);
      } else {
        // Yoksa sadece paylaşım bazlı (eski yöntem)
        res = await api.get(`/messages/${itemId}`);
      }
      setMessages(res.data);
    } catch (err) {
      console.error('Mesajlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const msgContent = newMessage.trim();
    setNewMessage('');

    try {
      setSending(true);
      if (itemId && itemId !== 'direct') {
        await api.post(`/messages/${itemId}`, {
          content: msgContent,
          targetUserId: partnerId, // Opsiyonel: Hedef kullanıcıyı belirt
        });
      } else if (partnerId) {
        await api.post(`/messages/direct/${partnerId}`, {
          content: msgContent,
        });
      }
      if (socket && partnerId) {
        socket.emit('stopTyping', {
          toUserId: partnerId,
          itemId: itemId || 'direct',
        });
      }
      // Fetch immediately for ourselves too
      await fetchMessages();
    } catch (err) {
      setNewMessage(msgContent); // geri yükle
      showToast(err.response?.data?.message || 'Mesaj gönderilemedi.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (socket && partnerId) {
      socket.emit('typing', {
        toUserId: partnerId,
        itemId: itemId || 'direct',
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', {
          toUserId: partnerId,
          itemId: itemId || 'direct',
        });
      }, 2000);
    }
  };

  if (!isOpen) return null;

  let currentUserId = null;
  try {
    const token = localStorage.getItem('token');
    if (token) {
      currentUserId = JSON.parse(atob(token.split('.')[1]))?.sub;
    }
  } catch (e) {
    /* token geçersiz */
  }

  const partnerInitial = (partnerName || '?').charAt(0).toUpperCase();

  const visibleMessages = messages.filter((msg) => !msg.isTradeOffer);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[480px] bg-white rounded-2xl shadow-2xl z-[201] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div
                className="flex items-center gap-3 relative"
                ref={profileRef}
              >
                {/* Avatar — tıklanabilir */}
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="bg-emerald-600 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
                  title="Profili Görüntüle"
                >
                  {partnerInitial}
                </button>
                <div>
                  <button
                    onClick={() => setShowProfile(!showProfile)}
                    className="font-bold text-sm text-slate-800 hover:text-emerald-600 transition flex items-center gap-1"
                  >
                    {partnerName || 'Kullanıcı'}
                    <User className="w-3 h-3 text-slate-400" />
                  </button>
                  <p className="text-xs text-slate-400">{itemTitle}</p>
                </div>

                {/* Profil Mini Kartı */}
                {showProfile && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in-down">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shadow-md">
                        {partnerInitial}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {partnerName || 'Kullanıcı'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                            ⭐ İyilik Puanı: 100
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <button
                        onClick={() => {
                          setShowProfile(false);
                          onClose();
                          navigate(`/items/${itemId}`);
                        }}
                        className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Paylaşım Detayına Git
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-slate-400 text-sm">
                    Yükleniyor...
                  </div>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm">Henüz mesaj yok.</p>
                  <p className="text-slate-300 text-xs mt-1">
                    İlk mesajı siz gönderin!
                  </p>
                </div>
              ) : (
                visibleMessages.map((msg) => {
                  const isSystem = !msg.sender;
                  const isMine = !isSystem && msg.sender?.id === currentUserId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSystem ? 'justify-center' : isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                          isSystem
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 text-center w-full mx-4'
                            : isMine
                              ? 'bg-emerald-600 text-white rounded-br-md'
                              : 'bg-slate-100 text-slate-700 rounded-bl-md'
                        }`}
                      >
                        {isSystem && (
                          <span className="block mb-1 text-[10px] uppercase tracking-wider opacity-70 font-bold">
                            📢 Sistem Mesajı
                          </span>
                        )}
                        <p>{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${isSystem ? 'text-amber-600' : isMine ? 'text-emerald-200' : 'text-slate-400'}`}
                        >
                          {formatDistanceToNow(
                            new Date(
                              msg.createdAt.endsWith('Z')
                                ? msg.createdAt
                                : msg.createdAt + 'Z',
                            ),
                            { addSuffix: true, locale: tr },
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 border border-slate-200 text-slate-500 rounded-bl-md rounded-2xl px-4 py-2 text-xs flex items-center gap-1">
                    <span className="font-medium mr-1">Yazıyor</span>
                    <span className="animate-bounce">.</span>
                    <span
                      className="animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    >
                      .
                    </span>
                    <span
                      className="animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    >
                      .
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Mesaj gönder */}
            <form
              onSubmit={handleSend}
              className="p-4 border-t border-slate-100"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  placeholder="Mesaj yaz..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatModal;
