import { useState, useEffect } from 'react';
import { Users, Pin, CheckCircle, Trash2, Loader2, Send } from 'lucide-react';
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
          posts.map(post => (
            <div key={post._id} className={`bg-card border ${post.isPinned ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'} rounded-xl p-5 shadow-sm`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">
                      {post.type}
                    </span>
                    {post.verificationStatus === 'verified' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        <CheckCircle size={10} /> Verified
                      </span>
                    )}
                    {post.isPinned && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        <Pin size={10} /> Pinned
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{post.title}</h3>
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
                  {(isMod || post.uploadedBy?._id === user?.uid) && ( // Simple fallback for uploader check
                    <button onClick={() => handleDelete(post._id)} className="p-1.5 rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{post.originalText}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
