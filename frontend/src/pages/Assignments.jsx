import React, { useEffect, useState, useRef } from 'react';
import { ClipboardList, Clock, AlertTriangle, CheckCircle2, Play, Bell, Info, Upload, X, FileText, Send, Layers, ChevronDown, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Inline Upload Modal ────────────────────────────────────────────────────────
function UploadModal({ batches, onClose, onUploaded }) {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [batchId, setBatchId] = useState(batches[0]?._id || 'personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      if (mode === 'file') {
        if (!file) { setError('Please select a file.'); setLoading(false); return; }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('batchId', batchId);
        fd.append('targetBatchId', batchId);
        const res = await api.post('/api/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess(res.data?.message || 'Assignment notice uploaded!');
        setFile(null);
      } else {
        if (!text.trim()) { setError('Please enter notice text.'); setLoading(false); return; }
        const res = await api.post('/api/upload/text', { batchId, targetBatchId: batchId, text });
        setSuccess(res.data?.message || 'Notice processed!');
        setText('');
      }
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <CFCard className="max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6A68DF]/10 flex items-center justify-center">
              <Upload size={20} className="text-[#6A68DF]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-lg">Upload Assignment Notice</h3>
              <p className="text-xs text-[var(--text-muted)]">AI will extract title, deadline, and details automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><X size={20} /></button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Post To Batch</label>
          <div className="relative">
            <Layers size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={batchId} onChange={e => setBatchId(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#6A68DF]/30 outline-none appearance-none"
            >
              <option value="personal">📎 Personal</option>
              {batches.map(b => <option key={b._id} value={b._id}>🏫 {b.batchName}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>

        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden mb-4">
          {['file', 'text'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('flex-1 py-2 text-sm font-medium transition-all',
                mode === m ? 'bg-[#6A68DF] text-white' : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
              )}>
              {m === 'file' ? '📄 File / PDF' : '✏️ Paste Text'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn('border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                file ? 'border-[#6A68DF] bg-[#6A68DF]/5' : 'border-[var(--border)] hover:border-[#6A68DF]/50'
              )}>
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div className="flex items-center gap-2 justify-center">
                  <FileText size={18} className="text-[#6A68DF]" />
                  <span className="text-sm font-medium text-[#6A68DF] truncate max-w-xs">{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="text-[var(--text-muted)] hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload size={22} className="mx-auto text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">Click to select a PDF or image</p>
                </div>
              )}
            </div>
          ) : (
            <textarea rows={4} value={text} onChange={e => setText(e.target.value)}
              placeholder="Paste assignment notice text here..."
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 resize-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 text-xs font-medium">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-xl text-green-700 text-xs font-medium">
              <CheckCircle size={13} className="mt-0.5 shrink-0" /> {success}
            </div>
          )}

          <div className="flex gap-3">
            <CFButton type="button" variant="secondary" onClick={onClose} className="flex-1 py-2.5">Cancel</CFButton>
            <CFButton type="submit" variant="primary" className="flex-1 py-2.5" loading={loading} disabled={loading} icon={loading ? Loader2 : Send}>
              {loading ? 'Processing...' : 'Upload'}
            </CFButton>
          </div>
        </form>
      </CFCard>
    </div>
  );
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [activeTab, setActiveTab] = useState('Not Started');
  const [batches, setBatches] = useState([]);
  const [showUpload, setShowUpload] = useState(false);

  const fetchAssignments = async () => {
    try {
      const batchRes = await api.get('/api/batch/my-batches').catch(() => ({ data: [] }));
      const fetchedBatches = batchRes.data || [];
      setBatches(fetchedBatches);

      const allAssignments = [];
      const seenIds = new Set();

      // Fetch personal assignments
      const personalRes = await api.get('/api/assignments').catch(() => ({ data: { data: [] } }));
      for (const a of (personalRes.data?.data || [])) {
        if (!seenIds.has(a._id)) { seenIds.add(a._id); allAssignments.push(a); }
      }

      // Fetch batch assignments
      for (const b of fetchedBatches) {
        const res = await api.get('/api/assignments', { params: { batchId: b._id } }).catch(() => ({ data: { data: [] } }));
        for (const a of (res.data?.data || [])) {
          if (!seenIds.has(a._id)) { seenIds.add(a._id); allAssignments.push(a); }
        }
      }
      setAssignments(allAssignments);
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

  const tabs = ['Not Started', 'Submitted', 'Missed'];
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
      {showUpload && (
        <UploadModal
          batches={batches}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { fetchAssignments(); setShowUpload(false); }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ClipboardList className="text-[#6A68DF]" size={24} /> Assignment Hub
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Track and manage your assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <CFButton variant="primary" size="sm" onClick={() => setShowUpload(true)} icon={Upload}>
            Upload Assignment
          </CFButton>
        </div>
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
                    {a.batchId?.batchName && (
                      <CFBadge variant="outline" className="text-[10px] bg-[var(--background)]">
                        {a.batchId.batchName}
                      </CFBadge>
                    )}
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
