import React, { useState, useEffect } from 'react';
import { Users, Pin, CheckCircle, Trash2, Send, AlertCircle, ShieldCheck, FileWarning, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CFButton, CFCard, CFBadge, CFInput, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

const CATEGORIES = ['all', 'academic', 'assignment', 'exam', 'placement', 'event', 'hostel', 'transport', 'resource', 'general'];

export default function CommunityPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  
  const [newPost, setNewPost] = useState({ title: '', originalText: '', type: 'general' });
  const [posting, setPosting] = useState(false);

  const [expandedPosts, setExpandedPosts] = useState({});
  const toggleExpand = (id) => setExpandedPosts(prev => ({...prev, [id]: !prev[id]}));

  const [expandedDuplicates, setExpandedDuplicates] = useState({});
  const toggleDuplicate = (id) => setExpandedDuplicates(prev => ({...prev, [id]: !prev[id]}));

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/api/batch/my-batches');
        setBatches(res.data);
        if (res.data.length > 0) {
          setSelectedBatch(res.data[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchPosts = async () => {
    if (selectedBatch) {
      try {
        const url = `/api/posts/${selectedBatch._id}${category !== 'all' ? `?category=${category}` : ''}`;
        const res = await api.get(url);
        setPosts(res.data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [selectedBatch, category]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setPosting(true);
    try {
      await api.post('/api/posts', { ...newPost, batchId: selectedBatch._id });
      setNewPost({ title: '', originalText: '', type: 'general' });
      fetchPosts();
    } catch (err) {
      console.error(err);
      alert('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handlePin = async (postId) => {
    try {
      await api.post(`/api/posts/${postId}/pin`);
      fetchPosts();
    } catch (err) {
      console.error(err);
      alert('Failed to pin');
    }
  };

  const handleVerify = async (postId) => {
    try {
      await api.post(`/api/posts/${postId}/verify`);
      fetchPosts();
    } catch (err) {
      console.error(err);
      alert('Failed to verify');
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/api/posts/${postId}`);
      fetchPosts();
    } catch (err) {
      console.error(err);
      alert('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
        <CFSkeleton card lines={3} className="h-40" />
        <CFSkeleton card lines={4} className="h-48" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <CFEmptyState 
        icon={Users}
        title="No Batches Yet"
        description="Join or create a batch to view the community feed."
      />
    );
  }

  const isMod = selectedBatch && (selectedBatch.myRole === 'owner' || selectedBatch.myRole === 'moderator');

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="text-[#6A68DF]" size={26} />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Community Feed</h2>
        </div>
        
        <select 
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30"
          value={selectedBatch?._id || ''}
          onChange={(e) => setSelectedBatch(batches.find(b => b._id === e.target.value))}
        >
          {batches.map(b => (
            <option key={b._id} value={b._id}>{b.batchName}</option>
          ))}
        </select>
      </div>

      {/* Composer */}
      <CFCard className="space-y-4">
        <form onSubmit={handlePost}>
          <input
            required
            placeholder="Post Title"
            className="w-full bg-transparent border-none text-lg font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] mb-3"
            value={newPost.title}
            onChange={e => setNewPost({...newPost, title: e.target.value})}
          />
          <textarea
            required
            rows={3}
            placeholder="What's happening in your batch?"
            className="w-full bg-transparent border-none text-sm text-[var(--text-primary)] outline-none resize-none placeholder:text-[var(--text-muted)]"
            value={newPost.originalText}
            onChange={e => setNewPost({...newPost, originalText: e.target.value})}
          />
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
            <select
              className="bg-[var(--bg)] text-[var(--text-primary)] text-xs rounded-full px-4 py-2 outline-none border border-[var(--border)]"
              value={newPost.type}
              onChange={e => setNewPost({...newPost, type: e.target.value})}
            >
              {CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <CFButton variant="primary" loading={posting} type="submit" size="sm" icon={Send}>
              Post
            </CFButton>
          </div>
        </form>
      </CFCard>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200",
              category === c 
                ? "bg-[#6A68DF] text-white" 
                : "bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <CFEmptyState title="No posts found" description="There are no posts in this category." />
        ) : (
          posts.map(post => {
            const isDuplicateCollapsed = post.isDuplicate && !expandedDuplicates[post._id];
            
            // Verification Badge Logic
            let badgeText = "Unverified";
            let badgeVariant = "default";
            
            if (post.verificationStatus === 'verified') {
              if (post.verifiedBy?.role === 'admin') {
                badgeText = "Official Notice";
                badgeVariant = "low";
              } else if (post.verifiedBy?.role === 'cr') {
                badgeText = "Verified by CR";
                badgeVariant = "success";
              } else {
                badgeText = "Verified";
                badgeVariant = "success";
              }
            }

            // Priority Badge Logic
            let priorityVariant = "default";
            if (post.priorityLevel === 'high' || post.priorityLevel === 'urgent') priorityVariant = "high";
            else if (post.priorityLevel === 'medium') priorityVariant = "medium";
            else if (post.priorityLevel === 'low') priorityVariant = "low";

            const relativeTimestamp = new Date(post.createdAt).toLocaleDateString();

            return (
              <CFCard key={post._id} className={cn("transition-all", isDuplicateCollapsed ? "opacity-60" : "")}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CFBadge variant="default" className="capitalize">{post.type}</CFBadge>
                    
                    <CFBadge variant={badgeVariant} className="flex items-center gap-1">
                      {badgeText === "Unverified" ? <AlertCircle size={12} /> : <ShieldCheck size={12} />}
                      {badgeText}
                    </CFBadge>
                    
                    {post.isPinned && (
                      <CFBadge variant="default" className="flex items-center gap-1 bg-[#6A68DF]/20">
                        <Pin size={12} /> Pinned
                      </CFBadge>
                    )}

                    {post.priorityLevel && post.priorityLevel !== 'low' && (
                      <CFBadge variant={priorityVariant} className="uppercase">
                        {post.priorityLevel}
                      </CFBadge>
                    )}

                    {post.isDuplicate && (
                      <CFBadge variant="warning" className="flex items-center gap-1">
                        <FileWarning size={12} /> Duplicate
                      </CFBadge>
                    )}
                    
                    <span className="text-[10px] text-[var(--text-muted)] ml-2">{relativeTimestamp}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {post.title}
                  </h3>
                  {post.isDuplicate && (
                    <button onClick={() => toggleDuplicate(post._id)} className="text-xs text-[#6A68DF] hover:underline font-medium">
                      {isDuplicateCollapsed ? 'Show' : 'Hide'}
                    </button>
                  )}
                </div>

                {!isDuplicateCollapsed && (
                  <div className="space-y-4">
                    {post.actionRequired && (
                      <div className="border-l-4 border-[#6A68DF] pl-3 bg-[#6A68DF]/5 rounded-r-xl py-2">
                        <p className="text-sm font-semibold text-[#6A68DF] flex items-center gap-2">
                          <AlertCircle size={16} /> Action Required
                        </p>
                      </div>
                    )}
                    
                    {post.summary ? (
                      <div>
                        <div className={cn("text-sm text-[var(--text-secondary)]", !expandedPosts[post._id] && "line-clamp-3")}>
                          {post.summary}
                        </div>
                        
                        <div className="mt-2">
                          <button 
                            onClick={() => toggleExpand(post._id)}
                            className="flex items-center gap-1 text-xs text-[#6A68DF] hover:underline font-medium"
                          >
                            {expandedPosts[post._id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                            {expandedPosts[post._id] ? 'Hide full text' : 'Show full text'}
                          </button>
                          
                          {expandedPosts[post._id] && (
                            <div className="mt-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
                              {post.originalText}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className={cn("text-sm text-[var(--text-secondary)] whitespace-pre-wrap", !expandedPosts[post._id] && "line-clamp-3")}>
                        {post.originalText}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Bottom Row */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6A68DF]/20 to-[#EFB995]/20 flex items-center justify-center text-[10px] text-[var(--text-primary)]">
                      {post.uploadedBy?.name ? post.uploadedBy.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                    {post.uploadedBy?.name || 'Unknown'}
                  </p>
                  
                  <div className="flex gap-1">
                    {isMod && (
                      <>
                        <CFButton variant="ghost" size="sm" onClick={() => handlePin(post._id)} className={post.isPinned ? 'text-[#6A68DF] bg-[#6A68DF]/10' : 'text-[var(--text-muted)]'}>
                          <Pin size={16} className="mr-1" /> Pin
                        </CFButton>
                        {post.verificationStatus !== 'verified' && (
                          <CFButton variant="ghost" size="sm" onClick={() => handleVerify(post._id)} className="text-[var(--text-muted)] hover:text-green-600 hover:bg-green-500/10">
                            <CheckCircle size={16} className="mr-1" /> Verify
                          </CFButton>
                        )}
                      </>
                    )}
                    {(isMod || post.uploadedBy?._id === user?.uid) && (
                      <CFButton variant="ghost" size="sm" onClick={() => handleDelete(post._id)} className="text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10">
                        <Trash2 size={16} className="mr-1" /> Delete
                      </CFButton>
                    )}
                  </div>
                </div>
              </CFCard>
            );
          })
        )}
      </div>
    </div>
  );
}
