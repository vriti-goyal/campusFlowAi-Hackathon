// src/components/layout/AppLayout.jsx
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
        <header className="flex items-center gap-4 px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm">
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
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
