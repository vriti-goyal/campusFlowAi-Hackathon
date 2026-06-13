import { useEffect, useState } from 'react';
import { ClipboardList, Clock, AlertTriangle, CheckCircle2, Play, Bell, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const STATUS_CONFIG = {
  'Not Started': { color: 'bg-gray-100 text-gray-700', icon: Clock },
  'In Progress': { color: 'bg-blue-100 text-blue-700', icon: Play },
  Submitted: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  Missed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

const PRIORITY_COLORS = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-gray-500',
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/api/assignments', { params: { batchId: 'default-batch' } });
      setAssignments(res.data.data || []);
    } catch {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssignments(); }, []);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.patch(`/api/assignments/${id}/status`, { status });
      setAssignments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status } : a))
      );
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const grouped = {
    'Not Started': assignments.filter((a) => a.status === 'Not Started'),
    'In Progress': assignments.filter((a) => a.status === 'In Progress'),
    Submitted: assignments.filter((a) => a.status === 'Submitted'),
    Missed: assignments.filter((a) => a.status === 'Missed'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="text-center py-16 space-y-3">
        <ClipboardList className="mx-auto text-muted-foreground" size={48} />
        <h2 className="text-xl font-bold text-foreground">No Assignments Yet</h2>
        <p className="text-muted-foreground text-sm">Upload a notice to automatically create assignments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assignment Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Track and manage your assignments</p>
      </div>

      {Object.entries(grouped).map(([status, items]) => {
        if (!items.length) return null;
        const { color, icon: Icon } = STATUS_CONFIG[status];
        return (
          <div key={status}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              <Icon size={16} /> {status} ({items.length})
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <div key={a._id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-foreground text-sm leading-snug">{a.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{status}</span>
                  </div>
                  {a.subject && <p className="text-xs text-muted-foreground">Subject: {a.subject}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {a.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(a.deadline).toLocaleDateString()}
                      </span>
                    )}
                    <span className={`font-medium ${PRIORITY_COLORS[a.priorityLevel] || ''}`}>
                      {a.priorityLevel}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {status === 'Not Started' && (
                      <ActionBtn
                        onClick={() => updateStatus(a._id, 'In Progress')}
                        loading={updating === a._id}
                        icon={Play} label="Start"
                      />
                    )}
                    {(status === 'Not Started' || status === 'In Progress') && (
                      <ActionBtn
                        onClick={() => updateStatus(a._id, 'Submitted')}
                        loading={updating === a._id}
                        icon={CheckCircle2} label="Mark Submitted"
                        variant="green"
                      />
                    )}
                    <ActionBtn
                      onClick={() => alert('Reminder set! (stub)')}
                      icon={Bell} label="Remind"
                      variant="outline"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({ onClick, loading, icon: Icon, label, variant = 'default' }) {
  const base = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50';
  const variants = {
    default: 'bg-primary/10 text-primary hover:bg-primary/20',
    green: 'bg-green-100 text-green-700 hover:bg-green-200',
    outline: 'border border-border text-muted-foreground hover:bg-accent',
  };
  return (
    <button onClick={onClick} disabled={loading} className={`${base} ${variants[variant]}`}>
      {Icon && <Icon size={12} />} {label}
    </button>
  );
}
