import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertCircle, Target, Sparkles, ArrowRight, X, UserCircle2, 
  ClipboardList, BookOpen, Briefcase, CalendarDays, CheckCircle 
} from 'lucide-react';
import api from '@/lib/api';
import { Link } from 'react-router-dom';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CFSkeleton card lines={2} />
          <CFSkeleton card lines={2} />
          <CFSkeleton card lines={2} />
          <CFSkeleton card lines={2} />
        </div>
        <CFSkeleton card lines={4} className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl pb-10">
      {/* Profile completion banner */}
      {dbUser && dbUser.profileComplete === false && (
        <CFCard className="bg-amber-500/10 border-amber-500/30 flex items-center gap-4 py-4">
          <UserCircle2 size={24} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Your profile is incomplete</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">Complete your profile to get accurate eligibility checks and placement recommendations.</p>
          </div>
          <Link to="/profile">
            <CFButton variant="primary" size="sm" className="bg-amber-500 hover:bg-amber-600">Complete Profile</CFButton>
          </Link>
        </CFCard>
      )}

      {/* Top Greeting Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          {getGreeting()}, <span className="text-[#6A68DF]">{user?.displayName?.split(' ')[0] || 'Student'}</span> 👋
        </h2>
        <CFButton 
          variant="secondary" 
          size="sm" 
          onClick={handleGenerateDigest}
          loading={digestLoading}
          icon={Sparkles}
        >
          Generate Digest
        </CFButton>
      </div>

      {/* Digest Card */}
      {digest && (
        <CFCard gradient className="relative">
          <button 
            onClick={() => setDigest(null)} 
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={24} className="text-white" />
            <h3 className="text-xl font-bold text-white">Daily Digest</h3>
          </div>
          <p className="text-white/90 text-sm whitespace-pre-wrap leading-relaxed">
            {digest.digestText}
          </p>
        </CFCard>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Assignments', count: data.counts?.assignments || 0 },
          { label: 'Upcoming Exams', count: data.counts?.exams || 0 },
          { label: 'Open Placements', count: data.counts?.placements || 0 },
          { label: 'Urgent Alerts', count: data.counts?.urgent || 0, isUrgent: true }
        ].map((stat, idx) => (
          <CFCard key={idx} className={`p-5 flex flex-col justify-center ${stat.isUrgent && stat.count > 0 ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900' : ''}`}>
            <span className={`text-3xl font-bold ${stat.isUrgent && stat.count > 0 ? 'text-red-500' : 'text-[#6A68DF]'}`}>
              {stat.count}
            </span>
            <span className="text-sm text-[var(--text-secondary)] mt-1 font-medium">{stat.label}</span>
          </CFCard>
        ))}
      </div>

      {/* Urgent Alerts */}
      {data.urgentAlerts?.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-red-500">
            <AlertCircle size={20} /> Urgent Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.urgentAlerts.map((alert, i) => (
              <CFCard key={i} className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1 block">
                    {alert.type} DUE &lt; 24h
                  </span>
                  <p className="font-semibold text-[var(--text-primary)]">{alert.title}</p>
                </div>
                <CFButton variant="danger" size="sm">
                  Take Action
                </CFButton>
              </CFCard>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Focus */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <Target size={20} className="text-[#6A68DF]" /> Today's Focus
          </h3>
          
          {data.focusItems?.length === 0 ? (
            <CFEmptyState 
              icon={CheckCircle} 
              title="You're all caught up!" 
              description="Enjoy your day, no pending tasks for today." 
            />
          ) : (
            <div className="space-y-3">
              {data.focusItems?.map((item, i) => (
                <CFCard key={i} hover className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 shrink-0">
                      {item.type === 'Assignment' ? <ClipboardList className="text-blue-500" size={24} /> :
                       item.type === 'Exam' ? <BookOpen className="text-orange-500" size={24} /> :
                       item.type === 'Placement' ? <Briefcase className="text-purple-500" size={24} /> :
                       <CalendarDays className="text-green-500" size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CFBadge variant={item.priority === 'High' ? 'high' : 'default'} className="px-2 py-0.5 text-[10px]">
                          {item.type}
                        </CFBadge>
                      </div>
                      <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                        {item.deadline ? `Due: ${new Date(item.deadline).toLocaleDateString()}` : 'Upcoming'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CFButton variant="ghost" size="sm">View</CFButton>
                    <CFButton variant="secondary" size="sm">Ask AI</CFButton>
                  </div>
                </CFCard>
              ))}
            </div>
          )}
        </div>

        {/* Recent Notices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-primary)]">
              <Users size={20} className="text-[#6A68DF]" /> Recent Notices
            </h3>
            <Link to="/community" className="text-sm text-[#6A68DF] hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={16} />
            </Link>
          </div>

          {posts.length === 0 ? (
            <CFEmptyState title="No recent posts" description="Your community feed is quiet." />
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <CFCard key={post._id} hover className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CFBadge variant="default" className="text-[10px] py-0.5 px-2">{post.type}</CFBadge>
                  </div>
                  <h4 className="font-semibold text-[var(--text-primary)] line-clamp-1">{post.title}</h4>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1.5 leading-relaxed">{post.originalText}</p>
                </CFCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
