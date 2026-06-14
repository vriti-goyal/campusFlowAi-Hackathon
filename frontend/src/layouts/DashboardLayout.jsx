import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Bot } from 'lucide-react';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] transition-colors duration-200 relative">
      <Sidebar isOpen={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <Outlet />
        </main>
      </div>

      {location.pathname !== '/assistant' && (
        <Link 
          to="/assistant" 
          className="fixed bottom-8 right-8 bg-[#6A68DF] text-white p-4 rounded-full shadow-2xl hover:bg-[#5b59c4] hover:scale-110 transition-all duration-300 z-50 group flex items-center justify-center"
          title="CampusFlow AI Assistant"
        >
          <Bot size={28} className="group-hover:animate-pulse" />
        </Link>
      )}
    </div>
  );
}
