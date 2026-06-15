import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Zap, Sun, Moon, LayoutDashboard, FileText, 
  Calendar as CalendarIcon, Bell, Briefcase, 
  MessageSquare, User, UsersRound, 
  LogOut 
} from 'lucide-react';
import { CFButton } from '@/components/ui';

const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }
    ]
  },
  {
    label: 'ACADEMICS',
    items: [
      { path: '/assignments', label: 'Assignments', icon: FileText },
      { path: '/exams', label: 'Exams', icon: FileText },
      { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
      { path: '/timetable', label: 'Timetable', icon: CalendarIcon }
    ]
  },
  {
    label: 'CAMPUS',
    items: [
      { path: '/notices', label: 'Notices', icon: Bell },
      { path: '/placements', label: 'Placements', icon: Briefcase },
    ]
  },
  {
    label: 'AI',
    items: [
      { path: '/assistant', label: 'Assistant', icon: MessageSquare }
    ]
  },
  {
    label: 'SETTINGS',
    items: [
      { path: '/profile', label: 'Profile', icon: User },
      { path: '/batch', label: 'Batch', icon: UsersRound }
    ]
  }
];


const Sidebar = ({ isOpen, setOpen }) => {
  const { dbUser, logout } = useAuth();
  // Theme state removed

  const handleItemClick = () => setOpen(false); // Close on mobile

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Logo & Theme Toggle */}
        <div className="flex items-center justify-between p-4 mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-[var(--primary)]" />
            <span className="font-bold text-xl bg-gradient-to-r from-[#6A68DF] to-[#EFB995] text-transparent bg-clip-text">
              CampusFlow AI
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-6">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx}>
              <h4 className="text-[10px] font-semibold tracking-widest text-[var(--text-muted)] px-4 mb-2 uppercase">
                {section.label}
              </h4>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={handleItemClick}
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 ${
                        isActive 
                          ? 'bg-[#6A68DF]/10 text-[#6A68DF] font-semibold' 
                          : 'text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)] font-medium'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: User Profile & Logout */}
        <div className="p-4 border-t border-[var(--border)] mt-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6A68DF] to-[#EFB995] flex items-center justify-center text-white font-bold flex-shrink-0">
            {dbUser?.name ? dbUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {dbUser?.name || 'Loading...'}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {dbUser?.email || ''}
            </p>
          </div>
          <CFButton 
            variant="ghost" 
            size="sm" 
            className="px-2 py-2 text-red-500 hover:bg-red-500/10 hover:text-red-600" 
            onClick={logout}
            icon={LogOut} 
          />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
