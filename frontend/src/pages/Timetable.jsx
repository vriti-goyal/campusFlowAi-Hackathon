import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, User as UserIcon, CalendarDays, BookOpen, Loader2, Upload, Shield, FileText, X, AlertTriangle, Trash2, Edit2, Plus } from 'lucide-react';
import api from '@/lib/api';
import { CFCard, CFBadge, CFButton, CFEmptyState } from '@/components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Utility to parse time like "09:00 AM - 10:00 AM" into start/end minutes from midnight
function parseTimeRange(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return null;

  const parseTime = (t) => {
    const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let [ , h, m, ampm ] = match;
    h = parseInt(h); m = parseInt(m);
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  if (start === null || end === null) return null;
  return { start, end };
}

// Check if two ranges overlap
function isOverlapping(r1, r2) {
  if (!r1 || !r2) return false;
  return Math.max(r1.start, r2.start) < Math.min(r1.end, r2.end);
}

function ScheduleUploadPanel({ batches, onUploaded, onDeleteTimetable }) {
  const fileRef = useRef(null);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState(null);
  
  const ownerBatches = batches.filter(b => b.myRole === 'owner');

  if (ownerBatches.length === 0) return (
    <CFCard className="p-5 mb-6 bg-red-50 border-red-200">
      <p className="text-sm text-red-600">Only Batch Owners (Super Admins) can upload or clear timetables.</p>
    </CFCard>
  );

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

  const handleDelete = async () => {
    if (!selectedBatch) { setMsg({ type: 'error', text: 'Select a batch first to clear' }); return; }
    if (!confirm('Are you sure you want to permanently clear the entire timetable for this batch?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/timetable/batch/${selectedBatch}`);
      setMsg({ type: 'success', text: 'Timetable cleared successfully.' });
      if (onDeleteTimetable) onDeleteTimetable();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to clear timetable.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <CFCard className="p-5 space-y-4 mb-6 border-[#6A68DF]/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#6A68DF]" />
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">Timetable Management (Super Admin)</h3>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Upload a <strong>PDF/Image</strong> and AI will extract the schedule, or use a <strong>CSV</strong> with columns:{' '}
        <code className="bg-[var(--border)] px-1 rounded">day</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">time</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">course_code</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">course_name</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">venue</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">faculty</code>,{' '}
        <code className="bg-[var(--border)] px-1 rounded">class_type</code>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--text-primary)] mb-1 block">Batch (Owner access required)</label>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
            className="w-full px-3 py-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--text-primary)] focus:border-[#6A68DF] outline-none">
            <option value="">Select batch…</option>
            {ownerBatches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
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
      <div className="flex flex-col sm:flex-row gap-3">
        <CFButton onClick={handleUpload} disabled={uploading || !selectedBatch || !file} className="flex-1" icon={uploading ? Loader2 : Upload} loading={uploading}>
          {uploading ? 'Uploading…' : 'Upload Schedule'}
        </CFButton>
        <CFButton variant="danger" onClick={handleDelete} disabled={deleting || !selectedBatch} className="flex-1" icon={Trash2} loading={deleting}>
          Clear Entire Timetable
        </CFButton>
      </div>
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

  const hasAdmin = batches.some(b => ['owner'].includes(b.myRole));
  
  // Aggregate slots for active day
  let slots = [];
  if (selectedBatch === 'all') {
    const todayTimetables = timetables.filter(t => t.dayOfWeek === activeDay);
    todayTimetables.forEach(t => {
      t.slots.forEach(s => {
        slots.push({ ...s, batchName: t.batchId?.batchName || 'Unknown Batch', batchId: t.batchId?._id || t.batchId, timetableId: t._id });
      });
    });
  } else {
    const todayTimetable = timetables.find(t => t.dayOfWeek === activeDay);
    if (todayTimetable) {
      const batchName = batches.find(b => b._id === selectedBatch)?.batchName || '';
      todayTimetable.slots.forEach(s => {
        slots.push({ ...s, batchName, batchId: selectedBatch, timetableId: todayTimetable._id });
      });
    }
  }

  // Sort chronologically and detect overlaps
  slots.sort((a, b) => {
    const tA = parseTimeRange(a.time);
    const tB = parseTimeRange(b.time);
    if (tA && tB) return tA.start - tB.start;
    return a.time.localeCompare(b.time);
  });

  const slotsWithOverlaps = slots.map((slot, i) => {
    const t1 = parseTimeRange(slot.time);
    let isOverlappingClass = false;
    if (t1) {
      for (let j = 0; j < slots.length; j++) {
        if (i === j) continue;
        const t2 = parseTimeRange(slots[j].time);
        if (isOverlapping(t1, t2)) {
          isOverlappingClass = true;
          break;
        }
      }
    }
    return { ...slot, isOverlappingClass };
  });

  const applyOverride = async (slotId, batchId, type) => {
    const reason = prompt(`Reason for ${type}?`);
    if (reason === null) return;
    try {
      await api.post('/api/timetable/override', {
        batchId,
        originalSlotId: slotId,
        date: new Date().toISOString().split('T')[0],
        overrideType: type,
        reason
      });
      fetchTimetable();
    } catch(err) {
      alert(err.response?.data?.error || 'Failed to override');
    }
  };

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
            <CFButton variant={showUpload ? 'primary' : 'secondary'} size="sm" onClick={() => setShowUpload(s => !s)} icon={showUpload ? X : Shield}>
              {showUpload ? 'Close Admin' : 'Admin Panel'}
            </CFButton>
          )}
        </div>
      </div>

      {showUpload && <ScheduleUploadPanel batches={batches} onUploaded={fetchTimetable} onDeleteTimetable={fetchTimetable} />}

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
      ) : slotsWithOverlaps.length === 0 ? (
        <CFEmptyState icon={BookOpen} title={`No Classes on ${activeDay}`} description={selectedBatch === 'all' ? "You have no classes scheduled across your batches." : "No classes scheduled for this batch."} />
      ) : (
        <div className="space-y-4 mt-4">
          {slotsWithOverlaps.map((slot, idx) => {
            const override = overrides.find(o => o.originalSlotId === slot._id);
            const isCancelled = override?.overrideType === 'cancelled';
            const isRescheduled = override?.overrideType === 'rescheduled';
            const isRoomChanged = override?.overrideType === 'room_changed';
            const isFacultyChanged = override?.overrideType === 'faculty_changed';
            
            const displayTime = isRescheduled && override.newDetails?.time ? override.newDetails.time : slot.time;
            const displayVenue = (isRescheduled || isRoomChanged) && override.newDetails?.venue ? override.newDetails.venue : slot.venue;
            const displayFaculty = (isRescheduled || isFacultyChanged) && override.newDetails?.faculty ? override.newDetails.faculty : slot.faculty;

            const myRole = batches.find(b => b._id === slot.batchId)?.myRole;
            const canOverride = ['owner', 'moderator'].includes(myRole);

            return (
              <CFCard key={idx} className={`group p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-l-4 transition-all relative ${isCancelled ? 'border-l-red-500 opacity-60' : override ? 'border-l-amber-500 bg-amber-50/30' : slot.isOverlappingClass ? 'border-l-red-400 bg-red-50/20' : 'border-l-[#6A68DF]'}`}>
                
                {/* Time Section */}
                <div className={`flex flex-col gap-1 sm:w-32 shrink-0 ${isCancelled ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                  <div className={`flex items-center gap-2 font-semibold ${isCancelled ? 'line-through' : ''}`}>
                    <Clock size={16} className={isCancelled ? 'text-[var(--text-muted)]' : 'text-[#6A68DF]'} />
                    {displayTime}
                  </div>
                  {slot.isOverlappingClass && !isCancelled && (
                    <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                      <AlertTriangle size={10} /> Time Conflict
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6A68DF]/10 text-[#6A68DF] border border-[#6A68DF]/20">{slot.courseCode}</span>
                    <h3 className={`font-bold text-sm sm:text-base ${isCancelled ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{slot.courseName || 'Lecture'}</h3>
                    <CFBadge variant={slot.classType === 'Lab' ? 'info' : 'secondary'} className="text-[10px]">
                      {slot.classType || 'Theory'}
                    </CFBadge>
                    {override && (
                      <CFBadge variant={isCancelled ? 'danger' : 'warning'} className="text-[10px] ml-auto">
                        {override.overrideType.replace('_', ' ').toUpperCase()}
                      </CFBadge>
                    )}
                  </div>
                  
                  <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${isCancelled ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>
                    <div className="flex items-center gap-1.5 font-medium text-[#6A68DF]">
                      Batch: {slot.batchName}
                    </div>
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

                {/* Quick Actions (CR/Admin) */}
                {canOverride && !override && (
                  <div className="absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => applyOverride(slot._id, slot.batchId, 'cancelled')} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Cancel Today">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </CFCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
