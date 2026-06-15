import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, Upload, FileText, Send, ChevronDown, Layers, X, AlertCircle,
  ShieldCheck, Pin, CheckCircle, Trash2, FileWarning, ChevronUp, Loader2
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Upload Panel ────────────────────────────────────────────────────────────
function UploadPanel({ batches, onUploaded }) {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [batchId, setBatchId] = useState(batches[0]?._id || 'personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (batches.length > 0 && batchId === 'personal') setBatchId(batches[0]._id);
  }, [batches]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'file') {
        if (!file) { setError('Please select a file.'); setLoading(false); return; }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('batchId', batchId);
        fd.append('targetBatchId', batchId);
        const res = await api.post('/api/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess(res.data?.message || 'Notice uploaded successfully!');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        if (!text.trim()) { setError('Please enter notice text.'); setLoading(false); return; }
        const res = await api.post('/api/upload/text', { batchId, targetBatchId: batchId, text });
        setSuccess(res.data?.message || 'Notice processed successfully!');
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
    <CFCard className="p-5 space-y-4 border-[#6A68DF]/20">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[#6A68DF]/10 flex items-center justify-center">
          <Upload size={16} className="text-[#6A68DF]" />
        </div>
        <h3 className="font-bold text-[var(--text-primary)]">Upload Notice</h3>
      </div>

      {/* Batch selector */}
      <div>
        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
          Post To Batch <span className="text-[#6A68DF]">*</span>
        </label>
        <div className="relative">
          <Layers size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <select
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] outline-none appearance-none"
          >
            <option value="personal">📎 Personal</option>
            {batches.map(b => (
              <option key={b._id} value={b._id}>🏫 {b.batchName}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
        {['file', 'text'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-all',
              mode === m
                ? 'bg-[#6A68DF] text-white'
                : 'bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
            )}
          >
            {m === 'file' ? '📄 File / PDF' : '✏️ Paste Text'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'file' ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              file
                ? 'border-[#6A68DF] bg-[#6A68DF]/5'
                : 'border-[var(--border)] hover:border-[#6A68DF]/50 hover:bg-[var(--bg)]'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={e => setFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText size={20} className="text-[#6A68DF]" />
                <span className="text-sm font-medium text-[#6A68DF] truncate max-w-[200px]">{file.name}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-[var(--text-muted)] hover:text-red-500 ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload size={24} className="mx-auto text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)] font-medium">Click to select a PDF or image</p>
                <p className="text-xs text-[var(--text-muted)]">AI will extract and categorize it automatically</p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            rows={4}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste notice text here. AI will extract deadlines, category, and summary automatically..."
            className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 resize-none placeholder:text-[var(--text-muted)]"
          />
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 text-xs font-medium">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-xl text-green-700 text-xs font-medium">
            <CheckCircle size={14} className="mt-0.5 shrink-0" /> {success}
          </div>
        )}

        <CFButton
          type="submit"
          variant="primary"
          className="w-full py-2.5"
          loading={loading}
          disabled={loading}
          icon={loading ? Loader2 : Send}
        >
          {loading ? 'Processing with AI...' : 'Upload Notice'}
        </CFButton>
      </form>
    </CFCard>
  );
}

// ── Main Notices Page ────────────────────────────────────────────────────────
const CATEGORIES = ['academic', 'placement', 'event', 'general'];

export default function NoticesPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [expandedPosts, setExpandedPosts] = useState({});
  const [editingPost, setEditingPost] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', summary: '', originalText: '', type: 'general' });
  const toggleExpand = id => setExpandedPosts(p => ({ ...p, [id]: !p[id] }));

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/api/batch/my-batches');
        setBatches(res.data || []);
        if (res.data?.length > 0) setSelectedBatch(res.data[0]);
      } catch { } finally { setLoading(false); }
    };
    init();
  }, []);

  const fetchPosts = async () => {
    if (!selectedBatch) return;
    try {
      const url = `/api/posts/${selectedBatch._id}${category !== 'all' ? `?category=${category}` : ''}`;
      const res = await api.get(url);
      setPosts(res.data || []);
    } catch { }
  };

  useEffect(() => { fetchPosts(); }, [selectedBatch, category]);

  const handlePin = async (postId) => {
    try { await api.post(`/api/posts/${postId}/pin`); fetchPosts(); } catch { alert('Failed to pin'); }
  };

  const handleVerify = async (postId) => {
    try { await api.post(`/api/posts/${postId}/verify`); fetchPosts(); } catch { alert('Failed to verify'); }
  };

  const handleDelete = async (postId) => {
    if (!confirm('Delete this notice?')) return;
    try { await api.delete(`/api/posts/${postId}`); fetchPosts(); } catch { alert('Failed to delete'); }
  };

  const startEdit = (post) => {
    setEditingPost(post._id);
    setEditForm({
      title: post.title || '',
      summary: post.summary || '',
      originalText: post.originalText || '',
      type: post.type || 'general'
    });
  };

  const handleEditSubmit = async (e, postId) => {
    e.preventDefault();
    try {
      await api.put(`/api/posts/${postId}`, editForm);
      setEditingPost(null);
      fetchPosts();
    } catch { alert('Failed to edit'); }
  };

  if (loading) return (
    <div className="space-y-6">
      <CFSkeleton lines={1} className="w-1/3 h-8" />
      <CFSkeleton card lines={4} className="h-48" />
      <CFSkeleton card lines={3} className="h-36" />
    </div>
  );

  const isMod = selectedBatch && (selectedBatch.myRole === 'owner' || selectedBatch.myRole === 'moderator');

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <Bell className="text-[#6A68DF]" size={26} /> Notice Board
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">All important notices from your batches</p>
        </div>
        {batches.length > 1 && (
          <select
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30"
            value={selectedBatch?._id || ''}
            onChange={e => setSelectedBatch(batches.find(b => b._id === e.target.value))}
          >
            {batches.map(b => <option key={b._id} value={b._id}>{b.batchName}</option>)}
          </select>
        )}
      </div>

      {batches.length === 0 ? (
        <CFEmptyState icon={Bell} title="No Batches Yet" description="Join or create a batch to see notices." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload Panel */}
          <div className="lg:col-span-1">
            <UploadPanel batches={batches} onUploaded={fetchPosts} />
          </div>

          {/* Right: Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Posts */}
            {posts.length === 0 ? (
              <CFEmptyState title="No notices" description="No notices in this category yet." />
            ) : (
              posts.map(post => {
                let badgeText = 'Unverified', badgeVariant = 'default';
                if (post.verificationStatus === 'verified') {
                  if (post.verifiedBy?.role === 'admin') { badgeText = 'Official'; badgeVariant = 'low'; }
                  else { badgeText = 'Verified'; badgeVariant = 'success'; }
                }

                return (
                  <CFCard key={post._id} className={cn(post.isPinned && 'border-[#6A68DF]/30 bg-[#6A68DF]/[0.02]')}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.batchId?.batchName && (
                          <CFBadge variant="outline" className="text-[10px]">{post.batchId.batchName}</CFBadge>
                        )}
                        <CFBadge variant="default" className="capitalize">{post.type}</CFBadge>
                        <CFBadge variant={badgeVariant} className="flex items-center gap-1">
                          {badgeText === 'Unverified' ? <AlertCircle size={11} /> : <ShieldCheck size={11} />}
                          {badgeText}
                        </CFBadge>
                        {post.isPinned && (
                          <CFBadge variant="default" className="flex items-center gap-1 bg-[#6A68DF]/20">
                            <Pin size={11} /> Pinned
                          </CFBadge>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {editingPost === post._id ? (
                      <form onSubmit={(e) => handleEditSubmit(e, post._id)} className="space-y-3 mb-4">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
                          placeholder="Title"
                        />
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <textarea
                          value={editForm.originalText}
                          onChange={(e) => setEditForm({ ...editForm, originalText: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm resize-none"
                          rows={4}
                          placeholder="Original Text"
                        />
                        <textarea
                          value={editForm.summary}
                          onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm resize-none"
                          rows={2}
                          placeholder="Summary"
                        />
                        <div className="flex gap-2">
                          <CFButton type="submit" variant="primary" size="sm">Save</CFButton>
                          <CFButton type="button" variant="ghost" size="sm" onClick={() => setEditingPost(null)}>Cancel</CFButton>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{post.title}</h3>

                        <div className={cn('text-sm text-[var(--text-secondary)]', !expandedPosts[post._id] && 'line-clamp-3')}>
                          {post.summary || post.originalText}
                        </div>
                        {(post.summary || post.originalText) && (
                          <button
                            onClick={() => toggleExpand(post._id)}
                            className="flex items-center gap-1 text-xs text-[#6A68DF] mt-2 font-medium hover:underline"
                          >
                            {expandedPosts[post._id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {expandedPosts[post._id] ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6A68DF]/20 to-[#EFB995]/20 flex items-center justify-center text-[10px]">
                          {post.uploadedBy?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                        {post.uploadedBy?.name || 'Unknown'}
                      </p>
                      <div className="flex gap-1">
                        {isMod && (
                          <>
                            <CFButton variant="ghost" size="sm" onClick={() => handlePin(post._id)}
                              className={post.isPinned ? 'text-[#6A68DF] bg-[#6A68DF]/10' : 'text-[var(--text-muted)]'}>
                              <Pin size={15} className="mr-1" /> Pin
                            </CFButton>
                            {post.verificationStatus !== 'verified' && (
                              <CFButton variant="ghost" size="sm" onClick={() => handleVerify(post._id)}
                                className="text-[var(--text-muted)] hover:text-green-600 hover:bg-green-500/10">
                                <CheckCircle size={15} className="mr-1" /> Verify
                              </CFButton>
                            )}
                          </>
                        )}
                        {(isMod || post.uploadedBy?._id === user?.uid) && (
                          <>
                            <CFButton variant="ghost" size="sm" onClick={() => startEdit(post)}
                              className="text-[var(--text-muted)] hover:text-blue-500 hover:bg-blue-500/10">
                              <FileText size={15} className="mr-1" /> Edit
                            </CFButton>
                            <CFButton variant="ghost" size="sm" onClick={() => handleDelete(post._id)}
                              className="text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10">
                              <Trash2 size={15} className="mr-1" /> Delete
                            </CFButton>
                          </>
                        )}
                      </div>
                    </div>
                  </CFCard>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
