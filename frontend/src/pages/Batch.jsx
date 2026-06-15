import React, { useState, useEffect } from 'react';
import { Layers, Plus, UserPlus, Loader2, Copy, Trash2, AlertTriangle, X, BookOpen, ChevronRight, Hash, Edit3 } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFInput, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Edit Batch Modal ──────────────────────────────────────────────────────────
function EditBatchModal({ batch, onClose, onEdited }) {
  const [editForm, setEditForm] = useState({
    batchName: batch.batchName || '',
    college: batch.college || '',
    branch: batch.branch || '',
    semester: batch.semester || '',
  });
  const [courseRows, setCourseRows] = useState(
    batch.courses?.length > 0 ? batch.courses : [{ code: '', name: '', faculty: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const courses = courseRows
        .filter(c => c.code.trim() && c.name.trim())
        .map(c => ({ code: c.code.trim(), name: c.name.trim(), faculty: c.faculty?.trim() || '' }));

      const res = await api.patch(`/api/batch/${batch._id}`, { ...editForm, courses });
      onEdited(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update batch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <CFCard className="max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6A68DF]/10 flex items-center justify-center">
              <Edit3 size={20} className="text-[#6A68DF]" />
            </div>
            <h3 className="font-bold text-xl text-[var(--text-primary)]">Edit Batch</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Batch Name <span className="text-[#6A68DF]">*</span></label>
            <input required type="text" value={editForm.batchName} onChange={e => setEditForm({...editForm, batchName: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">College</label>
              <input type="text" value={editForm.college} onChange={e => setEditForm({...editForm, college: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Branch</label>
              <input type="text" value={editForm.branch} onChange={e => setEditForm({...editForm, branch: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" />
            </div>
          </div>
          
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Semester</label>
            <input type="number" value={editForm.semester} onChange={e => setEditForm({...editForm, semester: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" />
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#6A68DF]" /> Courses <span className="text-[var(--text-muted)] font-medium lowercase normal-case">(optional)</span>
              </label>
              <button type="button"
                onClick={() => setCourseRows(r => [...r, { code: '', name: '', faculty: '' }])}
                className="text-xs text-[#6A68DF] font-bold hover:underline flex items-center gap-1 bg-[#6A68DF]/10 px-2 py-1 rounded-full">
                <Plus size={12} /> Add row
              </button>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {courseRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center bg-[var(--bg)] p-2 rounded-xl border border-[var(--border)] group">
                  <input
                    type="text"
                    value={row.code}
                    onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, code: e.target.value.toUpperCase() } : cr))}
                    placeholder="Code*"
                    className="w-20 px-2 py-1.5 bg-transparent border-none text-xs font-mono uppercase focus:ring-0 outline-none text-[var(--text-primary)] font-bold placeholder-[var(--text-muted)]"
                  />
                  <div className="w-px h-6 bg-[var(--border)]"></div>
                  <input
                    type="text"
                    value={row.name}
                    onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, name: e.target.value } : cr))}
                    placeholder="Subject Name*"
                    className="flex-1 px-2 py-1.5 bg-transparent border-none text-xs focus:ring-0 outline-none text-[var(--text-primary)] font-medium placeholder-[var(--text-muted)]"
                  />
                  <div className="w-px h-6 bg-[var(--border)] hidden sm:block"></div>
                  <input
                    type="text"
                    value={row.faculty}
                    onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, faculty: e.target.value } : cr))}
                    placeholder="Faculty"
                    className="w-24 px-2 py-1.5 bg-transparent border-none text-xs focus:ring-0 outline-none text-[var(--text-primary)] font-medium placeholder-[var(--text-muted)] hidden sm:block"
                  />
                  <button type="button" onClick={() => setCourseRows(r => r.filter((_, idx) => idx !== i))}
                    className="text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg shrink-0 transition-all opacity-50 group-hover:opacity-100" title="Remove row">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <CFButton variant="secondary" type="button" onClick={onClose} className="flex-1 py-3">
              Cancel
            </CFButton>
            <CFButton disabled={saving} loading={saving} variant="primary" type="submit" className="flex-1 py-3" icon={Edit3}>
              Save Changes
            </CFButton>
          </div>
        </form>
      </CFCard>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <CFCard className="max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 text-red-500">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <h3 className="font-bold text-xl text-[var(--text-primary)]">Delete Batch</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            Are you sure you want to delete <strong className="font-bold">{batch.batchName}</strong>?
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1.5 font-medium">
            This action cannot be undone. All associated data, including notices, assignments, and exams, will be permanently archived.
          </p>
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-semibold text-[var(--text-secondary)]">
            Type <strong className="text-red-500 select-none">{batch.batchName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => { setConfirmName(e.target.value); setError(''); }}
            placeholder={batch.batchName}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 focus:outline-none transition-all text-[var(--text-primary)]"
          />
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <CFButton
            variant="secondary"
            onClick={onClose}
            className="flex-1 py-2.5"
          >
            Cancel
          </CFButton>
          <CFButton
            variant="danger"
            onClick={handleDelete}
            disabled={deleting || confirmName !== batch.batchName}
            loading={deleting}
            icon={Trash2}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white border-none"
          >
            Delete Batch
          </CFButton>
        </div>
      </CFCard>
    </div>
  );
}

export default function BatchPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const [createForm, setCreateForm] = useState({ batchName: '', college: '', branch: '', semester: '' });
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

  const handleEdited = (updatedBatch) => {
    setBatches((prev) => prev.map((b) => b._id === updatedBatch._id ? { ...b, ...updatedBatch } : b));
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CFSkeleton card lines={6} className="h-96" />
          <CFSkeleton card lines={3} className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl pb-12">
      {/* Delete modal */}
      {deleteTarget && (
        <DeleteBatchModal
          batch={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditBatchModal
          batch={editTarget}
          onClose={() => setEditTarget(null)}
          onEdited={handleEdited}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
          <Layers className="text-[#6A68DF]" size={28} /> Batch Management
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1.5 font-medium">Create or join batches to collaborate with your peers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Create Batch Form */}
        <CFCard className="p-6">
          <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
            <Plus size={22} className="text-[#6A68DF]" /> Create New Batch
          </h3>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Batch Name <span className="text-[#6A68DF]">*</span></label>
              <input required type="text" value={createForm.batchName} onChange={e => setCreateForm({...createForm, batchName: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" placeholder="e.g., CS 2024 Section A" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">College</label>
                <input type="text" value={createForm.college} onChange={e => setCreateForm({...createForm, college: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Branch</label>
                <input type="text" value={createForm.branch} onChange={e => setCreateForm({...createForm, branch: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" placeholder="Optional" />
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Semester</label>
              <input type="number" value={createForm.semester} onChange={e => setCreateForm({...createForm, semester: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" placeholder="Optional" />
            </div>

            {/* ── Course Table ── */}
            <div className="pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} className="text-[#6A68DF]" /> Courses <span className="text-[var(--text-muted)] font-medium lowercase normal-case">(optional)</span>
                </label>
                <button type="button"
                  onClick={() => setCourseRows(r => [...r, { code: '', name: '', faculty: '' }])}
                  className="text-xs text-[#6A68DF] font-bold hover:underline flex items-center gap-1 bg-[#6A68DF]/10 px-2 py-1 rounded-full">
                  <Plus size={12} /> Add row
                </button>
              </div>
              <div className="space-y-3">
                {courseRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center bg-[var(--bg)] p-2 rounded-xl border border-[var(--border)] group">
                    <input
                      type="text"
                      value={row.code}
                      onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, code: e.target.value.toUpperCase() } : cr))}
                      placeholder="Code*"
                      className="w-20 px-2 py-1.5 bg-transparent border-none text-xs font-mono uppercase focus:ring-0 outline-none text-[var(--text-primary)] font-bold placeholder-[var(--text-muted)]"
                    />
                    <div className="w-px h-6 bg-[var(--border)]"></div>
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, name: e.target.value } : cr))}
                      placeholder="Subject Name*"
                      className="flex-1 px-2 py-1.5 bg-transparent border-none text-xs focus:ring-0 outline-none text-[var(--text-primary)] font-medium placeholder-[var(--text-muted)]"
                    />
                    <div className="w-px h-6 bg-[var(--border)] hidden sm:block"></div>
                    <input
                      type="text"
                      value={row.faculty}
                      onChange={e => setCourseRows(r => r.map((cr, idx) => idx === i ? { ...cr, faculty: e.target.value } : cr))}
                      placeholder="Faculty"
                      className="w-24 px-2 py-1.5 bg-transparent border-none text-xs focus:ring-0 outline-none text-[var(--text-primary)] font-medium placeholder-[var(--text-muted)] hidden sm:block"
                    />
                    <button type="button" onClick={() => setCourseRows(r => r.filter((_, idx) => idx !== i))}
                      className="text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg shrink-0 transition-all opacity-50 group-hover:opacity-100" title="Remove row">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-2 font-medium">Course codes are used to filter your exam schedule automatically (e.g. CSE301, MATH201).</p>
            </div>

            <CFButton disabled={creating} loading={creating} variant="primary" type="submit" className="w-full py-3 mt-4" icon={Plus}>
              Create Batch
            </CFButton>
          </form>
        </CFCard>

        {/* Join Batch Form */}
        <CFCard className="p-6 h-fit bg-gradient-to-br from-[#6A68DF]/5 to-[#EFB995]/5 border-[#6A68DF]/20">
          <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
            <UserPlus size={22} className="text-[#6A68DF]" /> Join Existing Batch
          </h3>
          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Batch Code <span className="text-[#6A68DF]">*</span></label>
              <div className="relative">
                <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input required type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[#6A68DF]/30 rounded-2xl text-sm font-mono tracking-widest uppercase focus:outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 transition-all text-[var(--text-primary)]" placeholder="Enter 8-character code" />
              </div>
            </div>
            <CFButton disabled={joining} loading={joining} variant="primary" type="submit" className="w-full py-3" icon={ChevronRight}>
              Join Batch
            </CFButton>
          </form>
        </CFCard>
      </div>

      <div className="pt-8 border-t border-[var(--border)]">
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
          <Layers className="text-[#EFB995]" size={22} /> My Enrolled Batches
        </h3>
        
        {batches.length === 0 ? (
          <CFEmptyState 
            icon={Layers}
            title="No batches yet"
            description="Create a new batch or join an existing one using a code."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {batches.map(batch => (
              <CFCard key={batch._id} className="flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight pr-2">{batch.batchName}</h4>
                  <CFBadge variant={batch.myRole === 'owner' ? 'high' : batch.myRole === 'moderator' ? 'medium' : 'default'} className="uppercase">
                    {batch.myRole}
                  </CFBadge>
                </div>
                
                <div className="space-y-1.5 text-sm font-medium text-[var(--text-secondary)] flex-1">
                  {batch.college && <p><span className="text-[var(--text-muted)]">College:</span> {batch.college}</p>}
                  {batch.branch && <p><span className="text-[var(--text-muted)]">Branch:</span> {batch.branch}</p>}
                  {batch.semester && <p><span className="text-[var(--text-muted)]">Sem:</span> {batch.semester}</p>}
                </div>
                
                {batch.courses?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] border-dashed">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                      <BookOpen size={12} className="text-[#6A68DF]" /> Tracked Courses ({batch.courses.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {batch.courses.map(c => (
                        <span key={c.code} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)]"
                          title={`${c.name}${c.faculty ? ' · ' + c.faculty : ''}`}>
                          {c.code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {(batch.myRole === 'owner' || batch.myRole === 'moderator') && (
                  <div className="mt-5 p-3.5 bg-[var(--bg)] rounded-xl border border-[var(--border)] flex items-center justify-between shadow-inner">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-0.5">Invite Code</p>
                      <p className="font-mono font-bold tracking-widest text-[#6A68DF] text-sm">{batch.batchCode}</p>
                    </div>
                    <CFButton 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(batch.batchCode);
                        alert('Code copied to clipboard!');
                      }}
                      className="text-[var(--text-secondary)] hover:text-[#6A68DF] hover:bg-[#6A68DF]/10 bg-white dark:bg-[var(--card)] border border-[var(--border)] shadow-sm px-2 py-2"
                      icon={Copy}
                    />
                  </div>
                )}
                
                {(batch.myRole === 'owner' || batch.myRole === 'moderator') && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                    <CFButton
                      variant="secondary"
                      onClick={() => setEditTarget(batch)}
                      className="flex-1 py-2 bg-transparent hover:bg-[#6A68DF]/5 border-[#6A68DF]/20 text-[#6A68DF]"
                      icon={Edit3}
                      size="sm"
                    >
                      Edit
                    </CFButton>
                    
                    {batch.myRole === 'owner' && (
                      <CFButton
                        variant="ghost"
                        onClick={() => setDeleteTarget(batch)}
                        className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 border border-red-100 dark:border-red-900/30"
                        icon={Trash2}
                        size="sm"
                      >
                        Delete
                      </CFButton>
                    )}
                  </div>
                )}
              </CFCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
