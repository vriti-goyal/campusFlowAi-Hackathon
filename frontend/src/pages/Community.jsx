import { useState, useEffect } from 'react';
import { Users, Pin, CheckCircle, Trash2, Loader2, Send, AlertCircle, ChevronDown, ChevronUp, ShieldCheck, FileWarning } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
    if (!selectedBatch) return;
    try {
      const url = `/api/posts/${selectedBatch._id}${category !== 'all' ? `?category=${category}` : ''}`;
      const res = await api.get(url);
      setPosts(res.data);
    } catch (err) {
      console.error(err);
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
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 space-y-4">
        <Users size={48} className="text-muted-foreground" />
        <h2 className="text-xl font-bold">No Batches Yet</h2>
        <p className="text-muted-foreground">Join or create a batch to view the community feed.</p>
      </div>
    );
  }

  const isMod = selectedBatch && (selectedBatch.myRole === 'owner' || selectedBatch.myRole === 'moderator');

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-primary" size={26} />
          <h2 className="text-2xl font-bold text-foreground">Community Feed</h2>
        </div>
        
        <select 
          className="bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          value={selectedBatch?._id || ''}
          onChange={(e) => setSelectedBatch(batches.find(b => b._id === e.target.value))}
        >
          {batches.map(b => (
            <option key={b._id} value={b._id}>{b.batchName}</option>
          ))}
        </select>
      </div>

      {/* Composer */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <form onSubmit={handlePost}>
          <input
            required
            placeholder="Post Title"
            className="w-full bg-transparent border-none text-lg font-semibold outline-none placeholder:text-muted-foreground mb-2"
            value={newPost.title}
            onChange={e => setNewPost({...newPost, title: e.target.value})}
          />
          <textarea
            required
            rows={3}
            placeholder="What's happening in your batch?"
            className="w-full bg-transparent border-none text-sm outline-none resize-none placeholder:text-muted-foreground/70"
            value={newPost.originalText}
            onChange={e => setNewPost({...newPost, originalText: e.target.value})}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <select
              className="bg-secondary text-secondary-foreground text-xs rounded-md px-2 py-1 outline-none"
              value={newPost.type}
              onChange={e => setNewPost({...newPost, type: e.target.value})}
            >
              {CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <button disabled={posting} type="submit" className="bg-primary text-primary-foreground p-2 rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50">
              {posting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </button>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">No posts found in this category.</p>
        ) : (
          posts.map(post => {
            const isDuplicateCollapsed = post.isDuplicate && !expandedDuplicates[post._id];
            
            // Verification Badge Logic
            let badgeText = "Unverified Student Upload";
            let badgeIcon = <AlertCircle size={10} />;
            let badgeColor = "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";
            
            if (post.verificationStatus === 'verified') {
              if (post.verifiedBy?.role === 'admin') {
                badgeText = "Official College Notice";
                badgeIcon = <ShieldCheck size={10} />;
                badgeColor = "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400";
              } else if (post.verifiedBy?.role === 'cr') {
                badgeText = "Verified by CR";
                badgeIcon = <CheckCircle size={10} />;
                badgeColor = "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400";
              } else {
                badgeText = "Verified by Moderator";
                badgeIcon = <CheckCircle size={10} />;
                badgeColor = "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400";
              }
            }

            // Priority Badge Logic
            let priorityColor = "bg-gray-100 text-gray-700";
            if (post.priorityLevel === 'high' || post.priorityLevel === 'urgent') priorityColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
            else if (post.priorityLevel === 'medium') priorityColor = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
            else if (post.priorityLevel === 'low') priorityColor = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";

            return (
              <div key={post._id} className={`bg-card border ${post.isPinned ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'} rounded-xl p-5 shadow-sm transition-all`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">
                        {post.type}
                      </span>
                      
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeColor}`}>
                        {badgeIcon} {badgeText}
                      </span>
                      
                      {post.isPinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <Pin size={10} /> Pinned
                        </span>
                      )}

                      {post.priorityLevel && post.priorityLevel !== 'low' && (
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${priorityColor}`}>
                          {post.priorityLevel} Priority
                        </span>
                      )}

                      {post.isDuplicate && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <FileWarning size={10} /> Duplicate — merged
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <h3 className={`text-lg font-bold ${isDuplicateCollapsed ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {post.title}
                      </h3>
                      {post.isDuplicate && (
                        <button onClick={() => toggleDuplicate(post._id)} className="text-xs text-primary hover:underline">
                          {isDuplicateCollapsed ? 'Show' : 'Hide'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {post.uploadedBy?.name || 'Unknown'} • {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    {isMod && (
                      <>
                        <button onClick={() => handlePin(post._id)} className={`p-1.5 rounded-md hover:bg-secondary ${post.isPinned ? 'text-primary' : 'text-muted-foreground'}`} title="Pin">
                          <Pin size={16} />
                        </button>
                        {post.verificationStatus !== 'verified' && (
                          <button onClick={() => handleVerify(post._id)} className="p-1.5 rounded-md hover:bg-green-100 text-muted-foreground hover:text-green-600" title="Verify">
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </>
                    )}
                    {(isMod || post.uploadedBy?._id === user?.uid) && (
                      <button onClick={() => handleDelete(post._id)} className="p-1.5 rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {!isDuplicateCollapsed && (
                  <div className="space-y-3 mt-4">
                    {post.actionRequired && (
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-r-md">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                          <AlertCircle size={16} /> Action Required
                        </p>
                      </div>
                    )}
                    
                    {post.summary ? (
                      <div>
                        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">AI Summary</p>
                          {post.summary}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-border">
                          <button 
                            onClick={() => toggleExpand(post._id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                          >
                            {expandedPosts[post._id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                            {expandedPosts[post._id] ? 'Hide full text' : 'Show full text'}
                          </button>
                          
                          {expandedPosts[post._id] && (
                            <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-md">
                              {post.originalText}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{post.originalText}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
