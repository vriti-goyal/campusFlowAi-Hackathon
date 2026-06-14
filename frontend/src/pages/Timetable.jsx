import { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, User as UserIcon, CalendarDays, BookOpen, Loader2, Upload, Shield, FileText, X } from 'lucide-react';
import api from '@/lib/api';

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
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 mb-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        <h3 className="font-semibold text-foreground text-sm">Upload Timetable (Admin)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a <strong>PDF/Image</strong> and AI will extract the schedule, or use a <strong>CSV</strong> with columns:{' '}
        <code className="bg-secondary px-1 rounded">day</code>,{' '}
        <code className="bg-secondary px-1 rounded">time</code>,{' '}
        <code className="bg-secondary px-1 rounded">course_code</code>,{' '}
        <code className="bg-secondary px-1 rounded">course_name</code>,{' '}
        <code className="bg-secondary px-1 rounded">venue</code>,{' '}
        <code className="bg-secondary px-1 rounded">faculty</code>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Batch</label>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:border-primary outline-none">
            <option value="">Select batch…</option>
            {adminBatches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">PDF / Image / CSV</label>
          <div onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary cursor-pointer transition-colors text-sm text-muted-foreground">
            <FileText size={14} />
            {file ? <span className="text-foreground truncate">{file.name}</span> : 'Click to choose file'}
            {file && <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-auto hover:text-destructive"><X size={12}/></button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>
      {msg && <p className={`text-xs px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>{msg.text}</p>}
      <button onClick={handleUpload} disabled={uploading || !selectedBatch || !file} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {uploading ? 'Uploading…' : 'Upload Schedule'}
      </button>
    </div>
  );
}

export default function TimetablePage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchBatches = async () => {
    try {
      const res = await api.get('/api/batch/my-batches');
      setBatches(res.data || []);
      if (res.data?.length > 0 && selectedBatch === 'all') {
        setSelectedBatch(res.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimetable = async () => {
    if (!selectedBatch || selectedBatch === 'all') return;
    setLoading(true);
    try {
      const res = await api.get(`/api/timetable/batch/${selectedBatch}`);
      setTimetables(res.data.data || []);
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="text-primary" size={24} /> Timetable
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your weekly class schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedBatch} 
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:border-primary outline-none"
          >
            {batches.length === 0 ? <option value="all">No Batches found</option> : null}
            {batches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
          {hasAdmin && (
            <button onClick={() => setShowUpload(s => !s)} className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${showUpload ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <Upload size={14} /> {showUpload ? 'Hide Upload' : 'Upload Schedule'}
            </button>
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
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${activeDay === day ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}`}
          >
            {day}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : slots.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <BookOpen className="mx-auto text-muted-foreground/50 mb-3" size={40} />
          <h3 className="text-lg font-medium text-foreground">No Classes on {activeDay}</h3>
          <p className="text-sm text-muted-foreground mt-1">Enjoy your free time!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.sort((a, b) => a.time.localeCompare(b.time)).map((slot, idx) => (
            <div key={idx} className="bg-card border-l-4 border-l-primary border-t border-r border-b border-border rounded-r-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 shadow-sm hover:shadow-md transition-shadow group">
              
              <div className="flex items-center gap-3 sm:w-32 shrink-0 text-foreground font-semibold">
                <Clock size={16} className="text-primary/70" />
                {slot.time}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{slot.courseCode}</span>
                  <h3 className="font-bold text-foreground text-sm sm:text-base">{slot.courseName || 'Lecture'}</h3>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {slot.venue && (
                    <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded">
                      <MapPin size={12} /> {slot.venue}
                    </div>
                  )}
                  {slot.faculty && (
                    <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded">
                      <UserIcon size={12} /> {slot.faculty}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
