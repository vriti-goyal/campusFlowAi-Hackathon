import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, User as UserIcon, CalendarDays, BookOpen, Loader2, Upload, Shield, FileText, X } from 'lucide-react';
import api from '@/lib/api';
import { CFCard, CFBadge, CFButton, CFEmptyState } from '@/components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ScheduleUploadPanel({ batches, onUploaded }) {
  const fileRef = useRef(null);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  
  const adminBatches = batches.filter(b => ['owner', 'moderator'].includes(b.myRole));
  if (adminBatches.length === 0) return null;

  const handleUpload = async () => {
    if (!selectedBatch) { setMsg({ type: 'error', text: 'Select a batch first' }); return; }
    if (!file) { setMsg({ type: 'error', text: 'Choose a file' }); return; }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('batchId', selectedBatch);
      const res = await api.post('/api/timetable/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg({ type: 'success', text: res.data.data.message });
      setFile(null);
      if (onUploaded) onUploaded();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <CFCard className="p-5 space-y-4 mb-6">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-[#6A68DF]" />
        <h3 className="font-semibold text-[var(--text-primary)] text-sm">Upload Timetable (Admin)</h3>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Upload a <strong>PDF/Image</strong> and AI will extract the schedule, or use a <strong>CSV</strong> with columns:{' '}
        <code className="bg-[var(--border)] px-1 rounded">day</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">time</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">course_code</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">course_name</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">venue</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">faculty</code>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--text-primary)] mb-1 block">Batch</label>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
            className="w-full px-3 py-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text-primary)] focus:border-[#6A68DF] outline-none">
            <option value="">Select batch…</option>
            {adminBatches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-primary)] mb-1 block">PDF / Image / CSV</label>
          <div onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-dashed border-[var(--border)] hover:border-[#6A68DF] cursor-pointer transition-colors text-sm text-[var(--text-muted)]">
            <FileText size={14} />
            {file ? <span className="text-[var(--text-primary)] truncate">{file.name}</span> : 'Click to choose file'}
            {file && <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-auto hover:text-red-500"><X size={12}/></button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>
      {msg && <p className={`text-xs px-3 py-2 rounded-xl ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{msg.text}</p>}
      <CFButton onClick={handleUpload} disabled={uploading || !selectedBatch || !file} className="w-full sm:w-auto" icon={uploading ? Loader2 : Upload} loading={uploading}>
        {uploading ? 'Uploading…' : 'Upload Schedule'}
      </CFButton>
    </CFCard>
  );
}

export default function TimetablePage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [timetables, setTimetables] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchBatches = async () => {
    try {
      const res = await api.get('/api/batch/my-batches');
      setBatches(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const endpoint = selectedBatch === 'all' ? '/api/timetable/my-timetable' : `/api/timetable/batch/${selectedBatch}`;
      const res = await api.get(endpoint);
      setTimetables(res.data.data.timetables || []);
      setOverrides(res.data.data.overrides || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBatches(); }, []);
  useEffect(() => { fetchTimetable(); }, [selectedBatch]);

  const hasAdmin = batches.some(b => ['owner', 'moderator'].includes(b.myRole));
  
  // Get slots for the active day
  const todayTimetable = timetables.find(t => t.dayOfWeek === activeDay);
  const slots = todayTimetable?.slots || [];

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarDays className="text-[#6A68DF]" size={24} /> Timetable
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Manage your weekly class schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedBatch} 
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="px-3 py-2 rounded-full border border-[var(--border)] bg-[var(--card)] text-sm font-medium focus:border-[#6A68DF] outline-none"
          >
            <option value="all">All My Batches</option>
            {batches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
          {hasAdmin && (
            <CFButton variant={showUpload ? 'primary' : 'secondary'} size="sm" onClick={() => setShowUpload(s => !s)} icon={showUpload ? X : Upload}>
              {showUpload ? 'Close Upload' : 'Upload Schedule'}
            </CFButton>
          )}
        </div>
      </div>

      {showUpload && <ScheduleUploadPanel batches={batches} onUploaded={fetchTimetable} />}

      {/* Days Tabs */}
      <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-2">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${activeDay === day ? 'bg-[#6A68DF] text-white shadow-sm' : 'bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[#6A68DF]/10 hover:text-[#6A68DF]'}`}
          >
            {day}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#6A68DF]" size={32} /></div>
      ) : slots.length === 0 ? (
        <CFEmptyState icon={BookOpen} title={`No Classes on ${activeDay}`} description="Enjoy your free time!" />
      ) : (
        <div className="space-y-4 mt-4">
          {slots.sort((a, b) => a.time.localeCompare(b.time)).map((slot, idx) => {
            const override = overrides.find(o => o.originalSlotId === slot._id);
            const isCancelled = override?.overrideType === 'cancelled';
            const isRescheduled = override?.overrideType === 'rescheduled';
            const isRoomChanged = override?.overrideType === 'room_changed';
            const isFacultyChanged = override?.overrideType === 'faculty_changed';
            
            const displayTime = isRescheduled && override.newDetails?.time ? override.newDetails.time : slot.time;
            const displayVenue = (isRescheduled || isRoomChanged) && override.newDetails?.venue ? override.newDetails.venue : slot.venue;
            const displayFaculty = (isRescheduled || isFacultyChanged) && override.newDetails?.faculty ? override.newDetails.faculty : slot.faculty;

            return (
              <CFCard key={idx} className={`p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-l-4 transition-all ${isCancelled ? 'border-l-red-500 opacity-60' : override ? 'border-l-amber-500 bg-amber-50/30' : 'border-l-[#6A68DF]'}`}>
                
                <div className={`flex items-center gap-3 sm:w-32 shrink-0 font-semibold ${isCancelled ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                  <Clock size={16} className={isCancelled ? 'text-[var(--text-muted)]' : 'text-[#6A68DF]'} />
                  {displayTime}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6A68DF]/10 text-[#6A68DF] border border-[#6A68DF]/20">{slot.courseCode}</span>
                    <h3 className={`font-bold text-sm sm:text-base ${isCancelled ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{slot.courseName || 'Lecture'}</h3>
                    {override && (
                      <CFBadge variant={isCancelled ? 'danger' : 'warning'} className="text-[10px] ml-2">
                        {override.overrideType.replace('_', ' ').toUpperCase()}
                      </CFBadge>
                    )}
                  </div>
                  
                  <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${isCancelled ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>
                    {displayVenue && (
                      <div className="flex items-center gap-1.5 bg-[var(--border)]/50 px-2 py-1 rounded">
                        <MapPin size={12} /> {displayVenue}
                      </div>
                    )}
                    {displayFaculty && (
                      <div className="flex items-center gap-1.5 bg-[var(--border)]/50 px-2 py-1 rounded">
                        <UserIcon size={12} /> {displayFaculty}
                      </div>
                    )}
                  </div>
                  {override?.reason && !isCancelled && (
                    <p className="text-xs text-amber-600 mt-1 italic">Reason: {override.reason}</p>
                  )}
                  {override?.reason && isCancelled && (
                    <p className="text-xs text-red-500 mt-1 italic">Reason: {override.reason}</p>
                  )}
                </div>
              </CFCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
