import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BookOpen,
  Briefcase,
  CalendarDays,
  Bot,
  Upload,
  Layers,
  UserCircle,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Bell,
  CheckCircle2
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/community',   label: 'Community',   icon: Users },
  { to: '/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/exams',       label: 'Exams',       icon: BookOpen },
  { to: '/placements',  label: 'Placements',  icon: Briefcase },
  { to: '/calendar',    label: 'Calendar',    icon: CalendarDays },
  { to: '/assistant',   label: 'AI Assistant', icon: Bot },
  { to: '/upload',      label: 'Upload',      icon: Upload },
  { to: '/batch',       label: 'Batch Ops',   icon: Layers },
  { to: '/profile',     label: 'Profile',     icon: UserCircle },
];

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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
        setIsOpen(false);
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
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-3 border-b border-border bg-secondary/50 flex justify-between items-center shrink-0">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && <span className="text-xs text-primary">{unreadCount} new</span>}
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-4">No notifications yet.</p>
            ) : (
              notifications.map(n => (
                <div 
                  key={n._id} 
                  className={`p-3 rounded-lg text-sm flex gap-3 transition-colors ${n.isRead ? 'opacity-60' : 'bg-primary/5'}`}
                  onClick={() => !n.isRead && markAsRead(n._id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.isRead ? <CheckCircle2 size={16} className="text-muted-foreground" /> : <div className="w-2 h-2 rounded-full bg-primary mt-1" />}
                  </div>
                  <div>
                    <p className={`font-medium ${n.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside
        className={`
          flex flex-col shrink-0 transition-all duration-300 ease-in-out
          bg-secondary border-r border-border
          ${sidebarOpen ? 'w-60' : 'w-16'}
        `}
      >
        {/* Logo row */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <GraduationCap className="shrink-0 text-primary" size={24} />
          {sidebarOpen && (
            <span className="font-semibold text-sm text-foreground truncate">
              CampusFlow <span className="text-primary">AI</span>
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                 ${isActive
                   ? 'bg-primary/20 text-primary font-medium'
                   : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                 }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-border px-2 py-3 space-y-1">
          {sidebarOpen && user && (
            <div className="flex items-center gap-2 px-3 py-2">
              <img
                src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}`}
                alt="avatar"
                className="w-7 h-7 rounded-full object-cover"
              />
              <p className="text-xs text-muted-foreground truncate flex-1">{user.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm z-10 relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-sm font-medium text-foreground">
              Welcome back, <span className="text-primary">{user?.displayName?.split(' ')[0] || 'Student'}</span>
            </h1>
          </div>
          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
