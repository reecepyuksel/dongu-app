import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PropTypes from 'prop-types';

/**
 * TradeChat — A trade-specific chat component bound to a single trade offer.
 * Messages here are NOT shown in the general /messages feed.
 */
const TradeChat = ({ tradeId, tradeStatus }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch existing messages
  useEffect(() => {
    if (!tradeId) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/messages/trade/${tradeId}/messages`);
        setMessages(res.data);
      } catch (err) {
        console.error('Trade messages load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tradeId]);

  // WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    const sock = io(
      import.meta.env.VITE_API_URL?.replace('/api', '') ||
        'http://localhost:3005',
      { query: { userId: user.id } },
    );

    sock.on('newMessage', (msg) => {
      // Only handle messages that belong to this trade chat
      if (msg?.tradeOfferId === tradeId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);
          return exists ? prev : [...prev, msg];
        });
      }
    });

    return () => sock.close();
  }, [tradeId, user?.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    try {
      const res = await api.post(`/messages/trade/${tradeId}/message`, {
        content: text,
      });
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === res.data.id);
        return exists ? prev : [...prev, res.data];
      });
    } catch (err) {
      console.error('Send trade message error:', err);
    } finally {
      setSending(false);
    }
  };

  const isSystem = (msg) => !msg.sender;
  const isMe = (msg) => msg.sender?.id === user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 bg-emerald-400 rounded-full"
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.8,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Henüz mesaj yok. İlk mesajı siz gönderin!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              if (isSystem(msg)) {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center"
                  >
                    <div className="flex items-center gap-2 bg-slate-100 text-slate-500 text-xs font-semibold px-4 py-2 rounded-full border border-slate-200">
                      <Bot className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {msg.content}
                    </div>
                  </motion.div>
                );
              }

              const mine = isMe(msg);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      mine
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                    }`}
                  >
                    {!mine && (
                      <p className="text-[10px] font-bold text-emerald-600 mb-1">
                        {msg.sender?.fullName}
                      </p>
                    )}
                    <p>{msg.content}</p>
                    <p
                      className={`text-[10px] mt-1 ${mine ? 'text-emerald-200' : 'text-slate-400'}`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      {tradeStatus !== 'rejected' ? (
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 bg-white"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mesajınızı yazın..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-slate-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="px-4 py-3 border-t border-slate-200 text-center text-sm text-slate-400 bg-slate-50">
          Bu takas reddedildiği için mesajlaşma kapalı.
        </div>
      )}
    </div>
  );
};

TradeChat.propTypes = {
  tradeId: PropTypes.string.isRequired,
  tradeStatus: PropTypes.string,
};
export default TradeChat;
