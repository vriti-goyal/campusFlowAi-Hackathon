import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function Header({ setSidebarOpen }) {
  const { user, dbUser } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Map path to title
  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path) return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ');
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/api/notifications');
        setNotifications(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchNotifications();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 text-[var(--text-secondary)] hover:bg-[var(--border)] rounded-full transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#6A68DF] text-[8px] font-bold text-white border-2 border-[var(--card)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
              <div className="p-3 border-b border-[var(--border)] bg-[var(--card-elevated)] flex justify-between items-center shrink-0">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">Notifications</h3>
                {unreadCount > 0 && <span className="text-xs text-[#6A68DF] font-medium">{unreadCount} new</span>}
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {notifications.length === 0 ? (
                  <p className="text-xs text-center text-[var(--text-muted)] py-4">No notifications yet.</p>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n._id} 
                      className={`p-3 rounded-xl text-sm flex gap-3 transition-colors cursor-pointer ${n.isRead ? 'opacity-60' : 'bg-[#6A68DF]/5'}`}
                      onClick={() => !n.isRead && markAsRead(n._id)}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.isRead ? <CheckCircle2 size={16} className="text-[var(--text-muted)]" /> : <div className="w-2 h-2 rounded-full bg-[#6A68DF] mt-1" />}
                      </div>
                      <div>
                        <p className={`font-medium ${n.isRead ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{n.title}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Circle */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6A68DF] to-[#EFB995] flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm border-2 border-white dark:border-[var(--card)] overflow-hidden">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            dbUser?.name ? dbUser.name.charAt(0).toUpperCase() : 'U'
          )}
        </div>
      </div>
    </header>
  );
}
