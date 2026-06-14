import { useEffect, useState, useRef, useCallback } from 'react';
import {
  BookOpen, MapPin, Clock, Loader2, BookMarked, Upload,
  Calendar, AlertTriangle, CheckCircle, RefreshCw, FileText,
  ChevronDown, X, Shield
} from 'lucide-react';
import api from '@/lib/api';

// ── Days-left badge ───────────────────────────────────────────────────────────
function DaysBadge({ date }) {
  const daysLeft = Math.ceil((new Date(date) - new Date()) / 86400000);
  if (daysLeft < 0) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Passed</span>
  );
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      daysLeft === 0 ? 'bg-red-500 text-white animate-pulse' :
      daysLeft <= 3  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
      daysLeft <= 7  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                       'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
    }`}>
      {daysLeft === 0 ? '🔥 Today!' : `${daysLeft}d left`}
    </span>
  );
}

// ── CSV Upload Panel (owner/moderator only) ───────────────────────────────────
function CSVUploadPanel({ batches, onUploaded }) {
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
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        <h3 className="font-semibold text-foreground text-sm">Upload Exam Schedule (Admin)</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload a <strong>PDF/Image</strong> and AI will extract the schedule, or use a <strong>CSV</strong> with columns:{' '}
        <code className="bg-secondary px-1 rounded">course_code</code>,{' '}
        <code className="bg-secondary px-1 rounded">course_name</code>,{' '}
        <code className="bg-secondary px-1 rounded">exam_date</code>,{' '}
        <code className="bg-secondary px-1 rounded">exam_time</code>,{' '}
        <code className="bg-secondary px-1 rounded">venue</code>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Batch</label>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:border-primary outline-none appearance-none">
            <option value="">Select batch…</option>
            {adminBatches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">PDF / Image / CSV</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary cursor-pointer transition-colors text-sm text-muted-foreground"
          >
            <FileText size={14} />
            {file ? <span className="text-foreground truncate">{file.name}</span> : 'Click to choose file'}
            {file && <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
              className="ml-auto text-muted-foreground hover:text-destructive"><X size={12}/></button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.png,.jpg,.jpeg" className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>

      {msg && (
        <p className={`text-xs px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
          {msg.text}
        </p>
      )}

      <button onClick={handleUpload} disabled={uploading || !selectedBatch || !file}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? 'Uploading…' : 'Upload Schedule'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const [scheduleExams, setScheduleExams] = useState([]); // From exam-schedule API
  const [legacyExams, setLegacyExams] = useState([]);     // From old exams API
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'upcoming' | 'this-week'
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

      // Also try the legacy exams API (for manually added exams)
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

  // Merge both sources and deduplicate by subject+date
  const allExams = [
    ...scheduleExams.map(e => ({
      _id: e._id,
      subject: `${e.courseCode} – ${e.courseName || e.courseCode}`,
      date: e.examDate,
      time: e.examTime,
      venue: e.venue,
      source: 'schedule',
      courseCode: e.courseCode,
    })),
    ...legacyExams.map(e => ({
      _id: e._id,
      subject: e.subject,
      date: e.date,
      time: e.time,
      venue: e.venue,
      source: 'legacy',
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  const filtered = allExams.filter(e => {
    const d = new Date(e.date);
    if (filter === 'upcoming') return d >= now;
    if (filter === 'this-week') return d >= now && d <= nextWeek;
    return true;
  });

  const hasAdmin = batches.some(b => ['owner', 'moderator'].includes(b.myRole));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="text-primary" size={24} /> Exam Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Showing exams filtered to your enrolled course codes
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Refresh">
            <RefreshCw size={16} />
          </button>
          {hasAdmin && (
            <button onClick={() => setShowUpload(s => !s)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                ${showUpload ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
              <Upload size={15} /> {showUpload ? 'Hide Upload' : 'Upload Schedule'}
            </button>
          )}
        </div>
      </div>

      {/* CSV Upload panel (admin/moderator only) */}
      {showUpload && (
        <CSVUploadPanel batches={batches} onUploaded={() => { fetchAll(); setShowUpload(false); }} />
      )}

      {/* No course codes warning */}
      {scheduleExams.length === 0 && batches.some(b => !b.courses?.length) && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-500 font-medium">No course codes set for your batch</p>
            <p className="text-xs text-amber-500/70 mt-0.5">
              Add course codes in <a href="/batch" className="underline hover:text-amber-400">Batch Management</a> to get filtered exam schedules.
              {hasAdmin && ' Then upload a CSV schedule above.'}
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {allExams.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'this-week', label: 'This Week' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${filter === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Calendar className="mx-auto text-muted-foreground" size={48} />
          <h2 className="text-xl font-bold text-foreground">
            {allExams.length > 0 ? 'No exams match this filter' : 'No Exams Yet'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {allExams.length > 0
              ? 'Try changing the filter above.'
              : hasAdmin
              ? 'Upload an exam schedule CSV above to populate this hub.'
              : 'Your batch admin needs to upload an exam schedule.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exam) => (
            <div key={exam._id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground leading-tight text-sm">{exam.subject}</h3>
                <DaysBadge date={exam.date} />
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="shrink-0" />
                  <span>{new Date(exam.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {exam.time ? ` · ${exam.time}` : ''}</span>
                </div>
                {exam.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="shrink-0" />
                    <span>{exam.venue}</span>
                  </div>
                )}
              </div>

              {exam.courseCode && (
                <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {exam.courseCode}
                </span>
              )}

              <button
                onClick={() => alert('AI study plan feature coming in Phase 3!')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full justify-center"
              >
                <BookMarked size={13} /> Generate Study Plan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
