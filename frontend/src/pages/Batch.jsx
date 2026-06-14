import { useState, useEffect } from 'react';
import { Layers, Plus, UserPlus, Loader2, Copy, Trash2, AlertTriangle, X, BookOpen, GripVertical } from 'lucide-react';
import api from '@/lib/api';

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteBatchModal({ batch, onClose, onDeleted }) {
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmName !== batch.batchName) {
      setError(`Please type exactly: ${batch.batchName}`);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/batch/${batch._id}`, { data: { confirmName } });
      onDeleted(batch._id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete batch. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle size={20} />
            <h3 className="font-bold text-lg">Delete Batch</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            Are you sure you want to delete <strong>{batch.batchName}</strong>?
          </p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
            This cannot be undone. All associated data will be archived.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Type <strong className="text-red-500">{batch.batchName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => { setConfirmName(e.target.value); setError(''); }}
            placeholder={batch.batchName}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-red-400 focus:outline-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmName !== batch.batchName}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BatchPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [createForm, setCreateForm] = useState({ batchName: '', college: '', branch: '', semester: '' });
  // Course rows for create form — Feature 4
  const [courseRows, setCourseRows] = useState([{ code: '', name: '', faculty: '' }]);
  const [joinCode, setJoinCode] = useState('');

  const fetchBatches = async () => {
    try {
      const res = await api.get('/api/batch/my-batches');
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      // Filter out blank course rows before submitting
      const courses = courseRows
        .filter(c => c.code.trim() && c.name.trim())
        .map(c => ({ code: c.code.trim(), name: c.name.trim(), faculty: c.faculty.trim() }));

      await api.post('/api/batch/create', { ...createForm, courses });
      setCreateForm({ batchName: '', college: '', branch: '', semester: '' });
      setCourseRows([{ code: '', name: '', faculty: '' }]);
      alert('Batch created!');
      fetchBatches();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create batch');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoining(true);
    try {
      await api.post('/api/batch/join', { batchCode: joinCode });
      setJoinCode('');
      alert('Joined batch!');
      fetchBatches();
    } catch (err) {
      console.error(err);
      alert('Failed to join batch');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleted = (batchId) => {
    setBatches((prev) => prev.filter((b) => b._id !== batchId));
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl pb-10">
      {/* Delete modal */}
      {deleteTarget && (
        <DeleteBatchModal
          batch={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      <div className="flex items-center gap-3">
        <Layers className="text-primary" size={26} />
        <h2 className="text-2xl font-bold text-foreground">Batch Management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Batch Form */}
        <div className="bg-secondary/30 border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Plus size={20} className="text-primary" /> Create New Batch
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Batch Name *</label>
              <input required type="text" value={createForm.batchName} onChange={e => setCreateForm({...createForm, batchName: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" placeholder="e.g., CS 2024 Section A" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">College</label>
                <input type="text" value={createForm.college} onChange={e => setCreateForm({...createForm, college: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Branch</label>
                <input type="text" value={createForm.branch} onChange={e => setCreateForm({...createForm, branch: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Semester</label>
              <input type="number" value={createForm.semester} onChange={e => setCreateForm({...createForm, semester: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" />
            </div>

            {/* ── Course Table — Feature 4 ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <BookOpen size={14} className="text-primary" /> Courses <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <button type="button"
                  onClick={() => setCourseRows(r => [...r, { code: '', name: '', faculty: '' }])}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus size={12} /> Add row
                </button>
              </div>
              <div className="space-y-2">
                {courseRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={row.code}
                      onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, code: e.target.value.toUpperCase() } : cr))}
                      placeholder="Code*"
                      className="w-24 px-2 py-1.5 bg-background border border-border rounded text-xs font-mono uppercase focus:border-primary outline-none"
                    />
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, name: e.target.value } : cr))}
                      placeholder="Subject Name*"
                      className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-xs focus:border-primary outline-none"
                    />
                    <input
                      type="text"
                      value={row.faculty}
                      onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, faculty: e.target.value } : cr))}
                      placeholder="Faculty"
                      className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs focus:border-primary outline-none"
                    />
                    <button type="button" onClick={() => setCourseRows(r => r.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0 transition-colors" title="Remove">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Course codes are used to filter your exam schedule. e.g. CSE301, MATH201</p>
            </div>

            <button disabled={creating} type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create Batch'}
            </button>
          </form>
        </div>

        {/* Join Batch Form */}
        <div className="bg-secondary/30 border border-border rounded-xl p-6 h-fit">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <UserPlus size={20} className="text-primary" /> Join Batch
          </h3>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Batch Code *</label>
              <input required type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1 uppercase" placeholder="Enter 8-character code" />
            </div>
            <button disabled={joining} type="submit" className="w-full bg-secondary-foreground text-background py-2 rounded-md font-medium hover:opacity-90 flex justify-center items-center gap-2 disabled:opacity-50">
              {joining ? <Loader2 className="animate-spin" size={18} /> : 'Join Batch'}
            </button>
          </form>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="text-xl font-bold text-foreground mb-4">My Batches</h3>
        {batches.length === 0 ? (
          <p className="text-muted-foreground text-sm">You haven't joined any batches yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map(batch => (
              <div key={batch._id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-lg">{batch.batchName}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${batch.myRole === 'owner' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                    {batch.myRole}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {batch.college && <p>College: {batch.college}</p>}
                  {batch.branch && <p>Branch: {batch.branch}</p>}
                  {batch.semester && <p>Semester: {batch.semester}</p>}
                </div>
                {/* Courses — Feature 4: show course codes */}
                {batch.courses?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
                      <BookOpen size={11}/> Courses
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {batch.courses.map(c => (
                        <span key={c.code} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                          title={`${c.name}${c.faculty ? ' · ' + c.faculty : ''}`}>
                          {c.code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(batch.myRole === 'owner' || batch.myRole === 'moderator') && (
                  <div className="mt-4 p-3 bg-secondary/50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Share Code</p>
                      <p className="font-mono font-bold tracking-widest text-foreground">{batch.batchCode}</p>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(batch.batchCode);
                        alert('Code copied to clipboard!');
                      }}
                      className="p-2 hover:bg-secondary rounded-md transition-colors"
                      title="Copy code"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                )}
                {/* Delete button — owner only */}
                {batch.myRole === 'owner' && (
                  <button
                    onClick={() => setDeleteTarget(batch)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-medium transition-colors"
                  >
                    <Trash2 size={13} /> Delete Batch
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
