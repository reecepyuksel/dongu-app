import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, Info, Trophy, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { io } from 'socket.io-client';

const typeStyles = {
    SUCCESS: { icon: Trophy, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-500', badge: 'bg-emerald-500' },
    WARNING: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-500', badge: 'bg-amber-500' },
    INFO: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-500', badge: 'bg-blue-500' },
};

export default function NotificationBell() {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const [socket, setSocket] = useState(null);

    // Audio for notification pop
    // A short, pleasant base64 encoded "pop" sound
    const popSoundUrl = "data:audio/mpeg;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqoAAAH+GCAAAAOEwAA4XAACIQAAgQAAAEAAAIgAAACAAA//NExJQAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqoAAAH+GCAAAAOEwAA4XAACIQAAgQAAAEAAAIgAAACAAA";
    const audioRef = useRef(new Audio(popSoundUrl));

    // Poll unread count
    useEffect(() => {
        if (!isAuthenticated) return;

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 5000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const res = await api.get('/notifications/unread-count');
            setUnreadCount(res.data.count);
        } catch (err) {
            // silent
        }
    };

    // Web Sockets for Real-time Notifications & Sounds
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !isAuthenticated) return;
        
        const userId = JSON.parse(atob(token.split('.')[1]))?.sub;
        if (!userId) return;

        const newSocket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3005', {
            query: { userId }
        });
        
        setSocket(newSocket);

        return () => newSocket.close();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!socket) return;

        const playPopSound = () => {
            try {
                // To avoid DomException: play() failed because the user didn't interact
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(err => console.log('Audio autoplay prevented by browser', err));
            } catch(e) {}
        };

        socket.on('newMessage', (msg) => {
            // Sadece alıcı bensem bildirim göster/ses çal
            // (Mesaj gönderme anında da newMessage local'e düşmeyecek çünkü server-side sender'ı atlar, ancak yine de garanti olsun)
            const token = localStorage.getItem('token');
            const myId = token ? JSON.parse(atob(token.split('.')[1]))?.sub : null;
            if (msg.receiver?.id === myId || msg.receiver === myId) {
                playPopSound();
                fetchUnreadCount();
                if (isOpen) fetchNotifications();
            }
        });

        socket.on('newNotification', () => {
             playPopSound();
             fetchUnreadCount();
             if (isOpen) fetchNotifications();
        });

        return () => {
            socket.off('newMessage');
            socket.off('newNotification');
        };
    }, [socket, isOpen]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        if (!isOpen) {
            fetchNotifications();
        }
        setIsOpen(!isOpen);
    };

    const handleNotificationClick = async (notification) => {
        // Mark as read
        if (!notification.isRead) {
            try {
                await api.post(`/notifications/${notification.id}/read`);
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) { /* silent */ }
        }

        // Navigate to related item if exists
        if (notification.relatedId) {
            setIsOpen(false);
            navigate(`/items/${notification.relatedId}`);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Şimdi';
        if (diffMin < 60) return `${diffMin} dk önce`;
        if (diffHour < 24) return `${diffHour} saat önce`;
        if (diffDay < 7) return `${diffDay} gün önce`;
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    };

    if (!isAuthenticated) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-lg hover:bg-slate-100 transition group"
                title="Bildirimler"
            >
                <Bell className={`w-5 h-5 transition ${isOpen ? 'text-emerald-600' : 'text-slate-500 group-hover:text-slate-700'}`} />

                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-white animate-pulse shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[100] animate-fade-in-down">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-slate-400" />
                            Bildirimler
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Tümünü Okundu İşaretle
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading && notifications.length === 0 && (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-emerald-600 rounded-full"></div>
                            </div>
                        )}

                        {!loading && notifications.length === 0 && (
                            <div className="py-12 text-center">
                                <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-400">Henüz bildiriminiz yok</p>
                            </div>
                        )}

                        {notifications.slice(0, 10).map((notif) => {
                            const style = typeStyles[notif.type] || typeStyles.INFO;
                            const IconComponent = style.icon;

                            return (
                                <button
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`w-full text-left px-5 py-3.5 flex items-start gap-3 transition border-b border-slate-50 last:border-0 group
                                        ${notif.isRead
                                            ? 'bg-white hover:bg-slate-50'
                                            : `${style.bg} hover:brightness-95`
                                        }`}
                                >
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.isRead ? 'bg-slate-100' : style.bg} border ${notif.isRead ? 'border-slate-200' : style.border}`}>
                                        <IconComponent className={`w-4 h-4 ${notif.isRead ? 'text-slate-400' : style.iconColor}`} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-snug ${notif.isRead ? 'text-slate-600' : 'text-slate-800 font-semibold'}`}>
                                            {notif.title}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{formatTime(notif.createdAt)}</p>
                                    </div>

                                    {/* Unread dot or link icon */}
                                    <div className="flex-shrink-0 mt-1">
                                        {!notif.isRead ? (
                                            <div className={`w-2.5 h-2.5 rounded-full ${style.badge} shadow-sm`} />
                                        ) : notif.relatedId ? (
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition" />
                                        ) : null}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
