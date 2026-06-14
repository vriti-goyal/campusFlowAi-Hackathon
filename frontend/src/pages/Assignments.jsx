import React, { useEffect, useState } from 'react';
import { ClipboardList, Clock, AlertTriangle, CheckCircle2, Play, Bell, Info } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [activeTab, setActiveTab] = useState('Not Started');

  const fetchAssignments = async () => {
    try {
      const batchRes = await api.get('/api/batch/my-batches').catch(() => ({ data: [] }));
      const batches = batchRes.data || [];

      if (batches.length === 0) {
        const res = await api.get('/api/assignments');
        setAssignments(res.data.data || []);
      } else {
        const allAssignments = [];
        const seenIds = new Set();
        for (const b of batches) {
          const res = await api.get('/api/assignments', { params: { batchId: b._id } });
          for (const a of (res.data.data || [])) {
            if (!seenIds.has(a._id)) { seenIds.add(a._id); allAssignments.push(a); }
          }
        }
        setAssignments(allAssignments);
      }
    } catch {
      // Silently handle
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

  const tabs = ['Not Started', 'In Progress', 'Submitted', 'Missed'];
  const filteredAssignments = assignments.filter((a) => a.status === activeTab);

  if (loading) {
    return (
      <div className="space-y-6">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
        <div className="flex gap-2 mb-6">
          <CFSkeleton lines={1} className="w-24 h-10 rounded-full" />
          <CFSkeleton lines={1} className="w-24 h-10 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CFSkeleton card lines={3} className="h-40" />
          <CFSkeleton card lines={3} className="h-40" />
        </div>
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <CFEmptyState 
        icon={ClipboardList}
        title="No Assignments Yet"
        description="Upload a notice to automatically create assignments."
      />
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Assignment Hub</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">Track and manage your assignments</p>
      </div>

      {/* Status Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
              activeTab === tab
                ? "bg-[#6A68DF] text-white shadow-md"
                : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {filteredAssignments.length === 0 ? (
        <CFEmptyState 
          icon={CheckCircle2}
          title={`No ${activeTab} assignments`}
          description="You're all caught up in this category!"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssignments.map((a) => {
            const isOverdue = a.status === 'Missed' || (a.status !== 'Submitted' && a.deadline && new Date(a.deadline) < new Date());
            
            // Priority Badge Logic
            let priorityVariant = "default";
            if (a.priorityLevel === 'high' || a.priorityLevel === 'critical') priorityVariant = "high";
            else if (a.priorityLevel === 'medium') priorityVariant = "medium";
            else if (a.priorityLevel === 'low') priorityVariant = "low";

            return (
              <CFCard key={a._id} className={cn("flex flex-col h-full", isOverdue && "border-l-4 border-l-red-500")}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex flex-wrap gap-2">
                    {a.subject && (
                      <CFBadge variant="default" className="text-[10px]">
                        {a.subject}
                      </CFBadge>
                    )}
                    {a.priorityLevel && a.priorityLevel !== 'low' && (
                      <CFBadge variant={priorityVariant} className="text-[10px] uppercase">
                        {a.priorityLevel}
                      </CFBadge>
                    )}
                  </div>
                </div>
                
                <h4 className="font-semibold text-[var(--text-primary)] text-base mb-3 leading-snug">
                  {a.title}
                </h4>
                
                <div className="mt-auto space-y-3">
                  <div className="flex flex-col gap-1.5 text-xs text-[var(--text-secondary)]">
                    {a.deadline && (
                      <span className={cn("flex items-center gap-1.5 font-medium", isOverdue ? "text-red-500" : "")}>
                        <Clock size={14} /> Due: {new Date(a.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {a.submissionMode && (
                      <span className="flex items-center gap-1.5">
                        <Info size={14} /> Mode: <span className="capitalize">{a.submissionMode}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                    {a.status === 'Not Started' && (
                      <CFButton
                        onClick={() => updateStatus(a._id, 'In Progress')}
                        loading={updating === a._id}
                        icon={Play} size="sm" variant="primary" className="flex-1 text-xs py-1.5"
                      >
                        Start
                      </CFButton>
                    )}
                    {(a.status === 'Not Started' || a.status === 'In Progress') && (
                      <CFButton
                        onClick={() => updateStatus(a._id, 'Submitted')}
                        loading={updating === a._id}
                        icon={CheckCircle2} size="sm" variant="secondary" className="flex-1 text-xs py-1.5 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20"
                      >
                        Submit
                      </CFButton>
                    )}
                    {a.status !== 'Submitted' && (
                      <CFButton
                        onClick={() => alert('Reminder set! (stub)')}
                        icon={Bell} size="sm" variant="ghost" className="flex-1 text-xs py-1.5"
                      >
                        Remind
                      </CFButton>
                    )}
                  </div>
                </div>
              </CFCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
