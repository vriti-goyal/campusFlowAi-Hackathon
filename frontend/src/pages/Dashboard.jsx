import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, AlertCircle, CalendarDays, Bot, Users, Sparkles, Loader2, Target, CheckCircle, Bell, ArrowRight, ClipboardList, BookOpen, Briefcase, X, UserCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user, dbUser } = useAuth();
  const [data, setData] = useState({ focusItems: [], urgentAlerts: [], counts: {} });
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digest, setDigest] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, batchRes] = await Promise.all([
          api.get('/api/dashboard/summary'),
          api.get('/api/batch/my-batches')
        ]);
        setData(dashRes.data);

        if (batchRes.data.length > 0) {
          const postRes = await api.get(`/api/posts/${batchRes.data[0]._id}`);
          setPosts(postRes.data.slice(0, 3)); // Top 3 posts
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateDigest = async () => {
    setDigestLoading(true);
    try {
      const res = await api.post('/api/ai/daily-digest');
      setDigest(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to generate digest');
    } finally {
      setDigestLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-8 max-w-6xl pb-10">
      {/* Profile completion banner */}
      {dbUser && dbUser.profileComplete === false && (
        <div className="relative flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <UserCircle2 size={20} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">Your profile is incomplete</p>
            <p className="text-xs text-amber-400/70">Complete your profile to get accurate eligibility checks and placement recommendations.</p>
          </div>
          <Link
            to="/profile"
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-400 transition-colors"
          >
            Complete Profile
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-primary" size={26} />
          <div>
            <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="text-primary font-medium">{user?.displayName?.split(' ')[0] || 'Student'}</span>
            </p>
          </div>
        </div>
        <button 
          onClick={handleGenerateDigest}
          disabled={digestLoading}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          {digestLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          Generate Daily Digest
        </button>
      </div>

      {/* Daily Digest Result */}
      {digest && (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-900 rounded-xl p-6">
          <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2 mb-3">
            <Sparkles size={20} /> Daily Digest
          </h3>
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {digest.digestText}
          </p>
        </div>
      )}

      {/* Urgent Alerts */}
      {data.urgentAlerts?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-red-500">
            <AlertCircle size={20} /> Urgent Alerts ({data.counts?.urgent})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.urgentAlerts.map((alert, i) => (
              <div key={i} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1 block">
                    {alert.type} DUE &lt; 24h
                  </span>
                  <p className="font-semibold text-foreground">{alert.title}</p>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md transition-colors">
                    Take Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Focus */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Target size={20} className="text-primary" /> Today's Focus
          </h3>
          
          {data.focusItems?.length === 0 ? (
            <div className="bg-secondary/30 border border-border rounded-xl p-8 text-center">
              <CheckCircle className="text-green-500 mx-auto mb-3" size={32} />
              <p className="text-muted-foreground">You're all caught up! Enjoy your day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.focusItems?.map((item, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      item.type === 'Assignment' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                      item.type === 'Exam' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                      item.type === 'Placement' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' :
                      'bg-green-100 text-green-600 dark:bg-green-900/30'
                    }`}>
                      {item.type === 'Assignment' ? <ClipboardList size={20} /> :
                       item.type === 'Exam' ? <BookOpen size={20} /> :
                       item.type === 'Placement' ? <Briefcase size={20} /> :
                       <CalendarDays size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.deadline ? `Due: ${new Date(item.deadline).toLocaleDateString()}` : item.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="text-xs font-medium border border-border hover:bg-secondary px-3 py-1.5 rounded-md transition-colors">
                      View
                    </button>
                    <button className="text-xs font-medium border border-border hover:bg-secondary px-3 py-1.5 rounded-md transition-colors">
                      Ask AI
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Community Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Users size={20} className="text-primary" /> Community
            </h3>
            <Link to="/community" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="bg-secondary/30 border border-border rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">No recent posts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post._id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                      {post.type}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm line-clamp-1">{post.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{post.originalText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
