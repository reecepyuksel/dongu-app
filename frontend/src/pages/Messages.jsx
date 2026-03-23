import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  ArrowLeft,
  Clock,
  ChevronRight,
  Inbox,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import ChatModal from '../components/ChatModal';
import { io } from 'socket.io-client';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [socket, setSocket] = useState(null);

  // Sohbet açıldığında mesajları okundu yap + sayıcı sıfırla
  const handleOpenChat = async (conv) => {
    setSelectedChat(conv);
    try {
      if (conv.itemId && conv.itemId !== 'direct') {
        await api.post(`/messages/${conv.itemId}/read`);
      } else if (conv.otherUser?.id) {
        await api.post(`/messages/chat/${conv.otherUser.id}/read`);
      }
      // Anlık sıfırla
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === conv.conversationId
            ? { ...c, unreadCount: 0 }
            : c,
        ),
      );
    } catch (err) {
      console.error('Okundu işaretleme hatası:', err);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/login');
      } else {
        fetchConversations();
      }
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const partnerId = searchParams.get('partnerId');
    if (!partnerId) return;

    setSelectedChat({
      conversationId: `${partnerId}-${searchParams.get('itemId') || 'direct'}`,
      itemId: searchParams.get('itemId') || 'direct',
      itemTitle: searchParams.get('itemTitle') || 'Sohbet',
      otherUser: {
        id: partnerId,
        fullName: searchParams.get('partnerName') || 'Kullanıcı',
      },
    });
  }, [authLoading, isAuthenticated, searchParams]);

  // Init Socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !isAuthenticated) return;

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
  }, [isAuthenticated]);

  // Socket Listeners for Auto Update UI
  useEffect(() => {
    if (!socket) return;

    socket.on('newMessage', () => {
      fetchConversations(false);
    });

    return () => {
      socket.off('newMessage');
    };
  }, [socket]);

  const fetchConversations = async (showLoad = true) => {
    try {
      if (showLoad) setLoading(true);
      const res = await api.get('/messages/my-conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Konuşmalar yüklenemedi:', err);
    } finally {
      if (showLoad) setLoading(false);
    }
  };

  const handleDeleteConversation = async (e, conv) => {
    e.stopPropagation(); // Tıklayınca sohbet açılmasın
    if (
      !confirm(
        `"${conv.itemTitle}" paylaşımındaki ${conv.otherUser?.fullName || 'kullanıcı'} ile olan konuşmayı silmek istediğinize emin misiniz?`,
      )
    )
      return;

    try {
      setDeletingId(conv.conversationId);
      await api.delete(`/messages/${conv.itemId}`);
      setConversations((prev) =>
        prev.filter((c) => c.conversationId !== conv.conversationId),
      );
      showToast('Konuşma silindi.', 'success');
    } catch (err) {
      showToast('Konuşma silinemedi.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-pulse text-emerald-600">
          Oturum kontrol ediliyor...
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded-lg w-48" />
          <div className="h-4 bg-slate-100 rounded w-64" />
          <div className="space-y-3 mt-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 border border-slate-100"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-100 rounded w-48" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Başlık */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri Dön
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-xl">
            <MessageCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-[Outfit]">
              Sohbetler
            </h1>
            <p className="text-sm text-slate-400">
              Sadece Döngü Hediyeleri ile ilgili mesajlar burada listelenir
            </p>
          </div>
        </div>
      </div>

      {/* Konuşma Listesi */}
      {conversations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-100 p-12 text-center"
        >
          <Inbox className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">
            Henüz mesajınız yok
          </h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Bir paylaşıma gidip "Sahibiyle İletişime Geç" butonuna tıklayarak
            ilk mesajınızı gönderin.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition"
          >
            Vitrine Göz At
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {conversations.map((conv, index) => (
              <motion.div
                key={conv.conversationId || conv.itemId}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <button
                  onClick={() => handleOpenChat(conv)}
                  className={`w-full border hover:border-emerald-200 rounded-2xl p-5 flex items-center gap-4 transition-all text-left ${conv.unreadCount > 0 ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50' : 'bg-white hover:bg-slate-50 border-slate-100'}`}
                >
                  {/* Eşya Resmi */}
                  <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    {conv.itemImageUrl ? (
                      <img
                        src={conv.itemImageUrl}
                        alt={conv.itemTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML =
                            '<div class="w-full h-full flex items-center justify-center text-2xl">📦</div>';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Konuşma Detayı */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3
                        className={`truncate text-sm ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}
                      >
                        {conv.otherUser?.fullName ||
                          conv.otherUser?.email ||
                          'Kullanıcı'}
                      </h3>
                      <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0 ml-2">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(conv.lastMessageAt), {
                          addSuffix: true,
                          locale: tr,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-600 mb-1 font-medium truncate">
                      {conv.itemTitle}
                    </p>
                    <p
                      className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-slate-800 font-bold' : 'text-slate-400'}`}
                    >
                      {conv.lastMessage}
                    </p>
                  </div>

                  {/* Okunmamış + Ok */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {conv.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1.5 flex items-center justify-center rounded-full shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition" />
                  </div>
                </button>

                {/* Sil Butonu */}
                <button
                  onClick={(e) => handleDeleteConversation(e, conv)}
                  disabled={deletingId === conv.conversationId}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white border border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  title="Konuşmayı Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Chat Modal */}
      {selectedChat && (
        <ChatModal
          isOpen={!!selectedChat}
          onClose={() => {
            setSelectedChat(null);
            if (searchParams.get('partnerId')) {
              navigate('/messages', { replace: true });
            }
            fetchConversations(false);
          }}
          itemId={selectedChat.itemId}
          itemTitle={selectedChat.itemTitle}
          partnerName={selectedChat.otherUser?.fullName}
          partnerId={selectedChat.otherUser?.id}
        />
      )}
    </div>
  );
};

export default Messages;
