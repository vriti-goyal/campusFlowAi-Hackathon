import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BookOpen, MapPin, Clock, Upload, Calendar as CalendarIcon, AlertTriangle, RefreshCw, FileText, X, Shield } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Days-left badge ───────────────────────────────────────────────────────────
function getDaysLeftText(daysLeft) {
  if (daysLeft < 0) return "Passed";
  if (daysLeft === 0) return "🔥 Today!";
  if (daysLeft === 1) return "Tomorrow";
  return `${daysLeft} days left`;
}

function getDaysLeftVariant(daysLeft) {
  if (daysLeft < 0) return 'missed';
  if (daysLeft === 0) return 'high';
  if (daysLeft <= 3) return 'medium';
  return 'default';
}

// ── CSV Upload Panel (owner/moderator only) ───────────────────────────────────
function CSVUploadPanel({ batches, onUploaded, onClose }) {
  const fileRef = useRef(null);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const adminBatches = batches.filter(b => ['owner', 'moderator'].includes(b.myRole));

  if (adminBatches.length === 0) return null;

  const handleUpload = async () => {
    if (!selectedBatch) { setMsg({ type: 'error', text: 'Select a batch first' }); return; }
    if (!file) { setMsg({ type: 'error', text: 'Choose a CSV file' }); return; }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('batchId', selectedBatch);
      const res = await api.post('/api/exam-schedule/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { inserted, skipped } = res.data.data;
      setMsg({ type: 'success', text: `✅ Uploaded ${inserted} exams${skipped > 0 ? `, ${skipped} rows skipped` : ''}.` });
      setFile(null);
      onUploaded();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <CFCard className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-[#6A68DF]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Upload Exam Schedule (Admin)</h3>
        </div>
        <CFButton variant="ghost" size="sm" onClick={onClose} icon={X} className="px-2 py-2" />
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        Upload a <strong>PDF/Image</strong> and AI will extract the schedule, or use a <strong>CSV</strong> with columns:{' '}
        <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border)]">course_code</code>,{' '}
        <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border)]">course_name</code>,{' '}
        <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border)]">exam_date</code>,{' '}
        <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border)]">exam_time</code>,{' '}
        <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border)]">venue</code>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">Batch</label>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/30 outline-none transition-all">
            <option value="">Select batch…</option>
            {adminBatches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">PDF / Image / CSV</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-[#6A68DF]/40 hover:border-[#6A68DF] hover:bg-[#6A68DF]/5 cursor-pointer transition-all text-sm text-[var(--text-secondary)]"
          >
            <FileText size={18} className="text-[#6A68DF]" />
            <span className="flex-1 truncate">{file ? file.name : 'Click to choose file'}</span>
            {file && <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
              className="ml-auto text-red-400 hover:text-red-500"><X size={16}/></button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.png,.jpg,.jpeg" className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>

      {msg && (
        <p className={cn("text-sm px-4 py-2.5 rounded-xl font-medium mt-2", msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
          {msg.text}
        </p>
      )}

      <div className="pt-2">
        <CFButton variant="primary" onClick={handleUpload} disabled={uploading || !selectedBatch || !file} loading={uploading} icon={Upload}>
          Upload Schedule
        </CFButton>
      </div>
    </CFCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const [scheduleExams, setScheduleExams] = useState([]);
  const [legacyExams, setLegacyExams] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [showUpload, setShowUpload] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, batchRes] = await Promise.all([
        api.get('/api/exam-schedule').catch(() => ({ data: { data: [] } })),
        api.get('/api/batch/my-batches').catch(() => ({ data: [] })),
      ]);
      setScheduleExams(schedRes.data.data || []);
      setBatches(batchRes.data || []);

      if (batchRes.data?.length > 0) {
        const legacyRes = await api.get('/api/exams', {
          params: { batchId: batchRes.data[0]._id }
        }).catch(() => ({ data: { data: [] } }));
        setLegacyExams(legacyRes.data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allExams = [
    ...scheduleExams.map(e => ({
      _id: e._id,
      subject: `${e.courseCode} – ${e.courseName || e.courseCode}`,
      date: e.examDate,
      time: e.examTime,
      venue: e.venue,
      source: 'schedule',
      courseCode: e.courseCode,
      batchId: e.batchId,
    })),
    ...legacyExams.map(e => ({
      _id: e._id,
      subject: e.subject,
      date: e.date,
      time: e.time,
      venue: e.venue,
      source: 'legacy',
      batchId: e.batchId,
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  const filtered = allExams.filter(e => {
    const d = new Date(e.date);
    if (filter === 'upcoming') return d >= now || Math.ceil((d - now) / 86400000) === 0;
    if (filter === 'this-week') return d >= now && d <= nextWeek;
    return true;
  });

  const hasAdmin = batches.some(b => ['owner', 'moderator'].includes(b.myRole));

  if (loading) {
    return (
      <div className="space-y-6">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
        <div className="flex gap-2">
          <CFSkeleton lines={1} className="w-24 h-8 rounded-full" />
          <CFSkeleton lines={1} className="w-24 h-8 rounded-full" />
        </div>
        <div className="space-y-4">
          <CFSkeleton card lines={3} className="h-32" />
          <CFSkeleton card lines={3} className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Exam Hub</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Timeline of your filtered exam schedule
          </p>
        </div>
        <div className="flex gap-2">
          <CFButton variant="ghost" size="sm" onClick={fetchAll} icon={RefreshCw} className="px-3" />
          {hasAdmin && (
            <CFButton variant={showUpload ? "primary" : "secondary"} size="sm" onClick={() => setShowUpload(s => !s)} icon={Upload}>
              {showUpload ? 'Hide Upload' : 'Upload Schedule'}
            </CFButton>
          )}
        </div>
      </div>

      {showUpload && <CSVUploadPanel batches={batches} onUploaded={() => { fetchAll(); setShowUpload(false); }} onClose={() => setShowUpload(false)} />}

      {/* No course codes warning */}
      {scheduleExams.length === 0 && batches.some(b => !b.courses?.length) && (
        <CFCard className="bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900 flex items-start gap-3 py-4">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">No course codes set for your batch</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Add course codes in <a href="/batch" className="underline font-medium hover:text-amber-500">Batch Management</a> to get filtered exam schedules.
              {hasAdmin && ' Then upload a CSV schedule above.'}
            </p>
          </div>
        </CFCard>
      )}

      {/* Filter tabs */}
      {allExams.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'this-week', label: 'This Week' },
            { key: 'all', label: 'All Exams' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                filter === key 
                  ? "bg-[#6A68DF] text-white shadow-md" 
                  : "bg-[var(--card)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]"
              )}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Timeline List */}
      {filtered.length === 0 ? (
        <CFEmptyState 
          icon={CalendarIcon}
          title={allExams.length > 0 ? 'No exams match this filter' : 'No Exams Yet'}
          description={allExams.length > 0 
            ? 'Try changing the filter above.' 
            : hasAdmin 
              ? 'Upload an exam schedule to populate this hub.' 
              : 'Your batch admin needs to upload an exam schedule.'}
        />
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#6A68DF]/20 before:to-transparent">
          {filtered.map((exam, i) => {
            const daysLeft = Math.ceil((new Date(exam.date) - now) / 86400000);
            const isToday = daysLeft === 0;

            return (
              <div key={exam._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[var(--bg)] bg-[#6A68DF]/10 text-[#6A68DF] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  <BookOpen size={16} />
                </div>
                
                <CFCard 
                  className={cn(
                    "w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-5 hover:-translate-y-1 transition-transform",
                    isToday ? "border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900" : ""
                  )}
                  gradient={isToday ? true : false}
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div>
                      <h3 className={cn("font-semibold text-lg leading-snug", isToday ? "text-white" : "text-[var(--text-primary)]")}>
                        {exam.subject}
                      </h3>
                      {exam.batchId?.batchName && (
                        <CFBadge variant="outline" className={cn("mt-1 text-[10px] px-1.5 py-0", isToday ? "border-white/40 text-white/90" : "bg-[var(--background)]")}>
                          {exam.batchId.batchName}
                        </CFBadge>
                      )}
                    </div>
                    <CFBadge variant={isToday ? "default" : getDaysLeftVariant(daysLeft)} className={isToday ? "bg-white/20 text-white" : "whitespace-nowrap"}>
                      {getDaysLeftText(daysLeft)}
                    </CFBadge>
                  </div>

                  <div className={cn("space-y-2 text-sm font-medium", isToday ? "text-white/90" : "text-[var(--text-secondary)]")}>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="shrink-0" />
                      <span>{new Date(exam.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {exam.time ? ` • ${exam.time}` : ''}</span>
                    </div>
                    {exam.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="shrink-0" />
                        <span>{exam.venue}</span>
                      </div>
                    )}
                  </div>
                  
                  {exam.courseCode && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)] border-opacity-30">
                      <span className={cn("inline-block text-[10px] font-mono px-2 py-0.5 rounded", isToday ? "bg-white/20 text-white" : "bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]")}>
                        {exam.courseCode}
                      </span>
                    </div>
                  )}
                </CFCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
