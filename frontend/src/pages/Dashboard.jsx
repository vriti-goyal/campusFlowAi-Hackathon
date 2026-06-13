// src/pages/Dashboard.jsx
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, BookOpen, ClipboardList, CalendarDays, Bot } from 'lucide-react';

const cards = [
  { label: 'Assignments Due', value: '—', icon: ClipboardList, color: 'text-violet-400' },
  { label: 'Upcoming Exams', value: '—', icon: BookOpen,      color: 'text-sky-400' },
  { label: 'Events This Week', value: '—', icon: CalendarDays, color: 'text-emerald-400' },
  { label: 'AI Queries Today', value: '—', icon: Bot,          color: 'text-amber-400' },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="text-primary" size={22} />
        <div>
          <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Good to see you, <span className="text-primary">{user?.displayName?.split(' ')[0] || 'Student'}</span>!
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-secondary rounded-xl p-5 border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              <Icon className={color} size={18} />
            </div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder activity feed */}
      <div className="bg-secondary rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
        <p className="text-sm text-muted-foreground">No recent activity yet. Start exploring CampusFlow AI!</p>
      </div>
    </div>
  );
}
