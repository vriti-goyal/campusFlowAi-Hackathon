import React, { useEffect, useState, useMemo } from 'react';
import { Briefcase, ExternalLink, CheckCircle2, XCircle, Clock, Search, Mail, RefreshCw, GraduationCap } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState, CFInput } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useGmail } from '@/hooks/useGmail';
import toast from 'react-hot-toast';

export default function PlacementsPage() {
  const { dbUser } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  
  const [activeTab, setActiveTab] = useState('Eligible');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('Deadline ↑');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  
  const [syncResult, setSyncResult] = useState(null);

  const gmail = useGmail();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [batchRes, statsRes] = await Promise.all([
        api.get('/api/batch/my-batches').catch(() => ({ data: [] })),
        api.get('/api/placements/stats').catch(() => ({ data: { data: null } }))
      ]);
      
      if (statsRes.data.data) setStats(statsRes.data.data);

      const batches = batchRes.data || [];
      if (batches.length === 0) {
        const res = await api.get('/api/placements');
        setPlacements(res.data.data || []);
      } else {
        const allPlacements = [];
        const seenIds = new Set();
        for (const b of batches) {
          const res = await api.get('/api/placements', { params: { batchId: b._id } });
          for (const p of (res.data.data || [])) {
            if (!seenIds.has(p._id)) { seenIds.add(p._id); allPlacements.push(p); }
          }
        }
        setPlacements(allPlacements);
      }
    } catch {
      toast.error('Failed to load placements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      toast.success('Gmail connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
      gmail.fetchStatus().then(() => {
        handleSync();
      });
    }
  }, []);

  const handleSync = async () => {
    try {
      const res = await gmail.sync();
      toast.success(`Found ${res.added} new placements!`);
      setSyncResult(res);
      setTimeout(() => setSyncResult(null), 5000);
      fetchData(); // Refresh list
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    }
  };

  const handleApply = async (id) => {
    setApplying(id);
    try {
      await api.post(`/api/placements/${id}/apply`);
      setPlacements((prev) =>
        prev.map((p) => (p._id === id ? { ...p, applicationStatus: 'Applied', appliedAt: new Date().toISOString() } : p))
      );
      toast.success('Marked as applied');
      fetchData(); // Refresh stats
    } catch {
      toast.error('Failed to mark as applied');
    } finally {
      setApplying(null);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.patch(`/api/placements/${id}/dismiss`);
      setPlacements((prev) =>
        prev.map((p) => (p._id === id ? { ...p, applicationStatus: 'Dismissed' } : p))
      );
      toast.success('Placement dismissed');
    } catch {
      toast.error('Failed to dismiss');
    }
  };

  const handleRemind = async (placement) => {
    try {
      await api.post('/api/calendar/events', {
        title: `Reminder: Apply for ${placement.company}`,
        category: 'placement',
        date: new Date(placement.deadline),
        sourceType: 'placement',
        sourceId: placement._id
      });
      toast.success('Reminder added to calendar');
    } catch {
      toast.error('Failed to set reminder');
    }
  };

  const filteredAndSortedPlacements = useMemo(() => {
    let result = [...placements];

    // Dismissed filter
    result = result.filter(p => p.applicationStatus !== 'Dismissed');

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.company?.toLowerCase().includes(q) || p.role?.toLowerCase().includes(q));
    }

    // Source Filter
    if (sourceFilter === '📧 Gmail') {
      result = result.filter(p => p.source === 'gmail');
    } else if (sourceFilter === '📄 Uploaded') {
      result = result.filter(p => p.source !== 'gmail');
    }

    // Tab Filter
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    switch (activeTab) {
      case 'Eligible':
        result = result.filter(p => p.eligibilityStatus === 'eligible' && p.applicationStatus === 'Not Applied');
        break;
      case 'Applied':
        result = result.filter(p => p.applicationStatus === 'Applied');
        break;
      case 'Deadline Soon':
        result = result.filter(p => p.applicationStatus !== 'Applied' && p.deadline && new Date(p.deadline) <= fortyEightHoursFromNow && new Date(p.deadline) >= now);
        break;
      case 'Not Eligible':
        result = result.filter(p => p.eligibilityStatus === 'not_eligible' && p.applicationStatus !== 'Applied');
        break;
      case 'Missed':
        result = result.filter(p => p.applicationStatus !== 'Applied' && p.deadline && new Date(p.deadline) < now);
        break;
      case 'All':
      default:
        break;
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'Deadline ↑') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      } else if (sortOption === 'Priority ↓') {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      } else if (sortOption === 'Company A-Z') {
        return a.company.localeCompare(b.company);
      }
      return 0;
    });

    return result;
  }, [placements, activeTab, searchQuery, sortOption, sourceFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CFSkeleton card lines={2} className="h-24" />
            <CFSkeleton card lines={2} className="h-24" />
            <CFSkeleton card lines={2} className="h-24" />
            <CFSkeleton card lines={2} className="h-24" />
        </div>
        <div className="flex gap-2 mb-6">
          <CFSkeleton lines={1} className="w-32 h-10 rounded-full" />
          <CFSkeleton lines={1} className="w-24 h-10 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CFSkeleton card lines={3} className="h-48" />
          <CFSkeleton card lines={3} className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Placement Hub</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">Opportunities curated based on your profile</p>
      </div>

      {/* Gmail Banner */}
      {!gmail.connected ? (
        <CFCard className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="text-amber-500 shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200">Connect Gmail to auto-scan placement emails</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">CampusFlow AI will scan your inbox for TNP and placement emails automatically</p>
            </div>
          </div>
          <CFButton variant="primary" onClick={gmail.connect} className="shrink-0">Connect Gmail</CFButton>
        </CFCard>
      ) : (
        <CFCard className="border-green-200 bg-green-50 dark:bg-green-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-500 shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-200">Gmail Connected</h3>
              <p className="text-sm text-green-700 dark:text-green-400">{gmail.email}</p>
              {gmail.lastSync && <p className="text-xs text-green-600/70 dark:text-green-500/70">Last synced: {new Date(gmail.lastSync).toLocaleString()}</p>}
            </div>
          </div>
          <CFButton variant="secondary" size="sm" onClick={handleSync} disabled={gmail.syncing} className="shrink-0 gap-2">
            <RefreshCw size={16} className={cn(gmail.syncing && "animate-spin")} />
            {gmail.syncing ? "Syncing..." : "Sync Now"}
          </CFButton>
        </CFCard>
      )}

      {/* Sync Result Toast-like Card */}
      {syncResult && (
        <CFCard className="bg-[#6A68DF]/10 border-[#6A68DF]/20 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="font-bold text-[#6A68DF] flex items-center gap-2"><CheckCircle2 size={18}/> Sync Complete</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {syncResult.processed} emails scanned • {syncResult.added} new placements found • {syncResult.skipped} skipped (duplicates)
          </p>
        </CFCard>
      )}

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CFCard className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium"><Briefcase size={18} className="text-[#6A68DF]" /> Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CFCard>
          <CFCard className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium"><CheckCircle2 size={18} className="text-green-500" /> Eligible</div>
            <div className="text-2xl font-bold">{stats.eligible}</div>
          </CFCard>
          <CFCard className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium"><CheckCircle2 size={18} className="text-[#EFB995]" /> Applied</div>
            <div className="text-2xl font-bold">{stats.applied}</div>
          </CFCard>
          <CFCard className="flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <Clock size={18} className={cn("text-red-500", stats.deadlineSoon > 0 && "animate-pulse")} /> Deadline Soon
            </div>
            <div className="text-2xl font-bold text-red-500">{stats.deadlineSoon}</div>
            {stats.deadlineSoon > 0 && <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 m-4 animate-ping" />}
          </CFCard>
        </div>
      )}

      {/* Filter + Search Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <CFInput 
              placeholder="Search companies, roles..." 
              className="pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto hide-scrollbar pb-1">
            <select 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg focus:ring-[#6A68DF] focus:border-[#6A68DF] block p-2"
            >
              <option>Deadline ↑</option>
              <option>Priority ↓</option>
              <option>Company A-Z</option>
            </select>
          </div>
        </div>

        <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
          {['All', 'Eligible', 'Applied', 'Deadline Soon', 'Not Eligible', 'Missed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === tab
                  ? "bg-[#6A68DF] text-white shadow-md"
                  : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)]"
              )}
            >
              {tab}
            </button>
          ))}
          <div className="w-px h-6 bg-[var(--border)] self-center mx-1" />
          {['All Sources', '📧 Gmail', '📄 Uploaded'].map((source) => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={cn(
                "whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border",
                sourceFilter === source
                  ? "bg-[var(--card-elevated)] border-[#6A68DF] text-[var(--text-primary)]"
                  : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--card)]"
              )}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {placements.length === 0 && !gmail.connected ? (
        <CFEmptyState 
          icon={Mail}
          title="No placements yet"
          description="Connect your Gmail to auto-import TNP emails, or upload placement notices manually"
        >
          <div className="flex gap-3 mt-4">
            <CFButton variant="primary" onClick={gmail.connect}>Connect Gmail</CFButton>
            <CFButton variant="secondary" onClick={() => window.location.href='/upload'}>Upload Notice</CFButton>
          </div>
        </CFEmptyState>
      ) : placements.length === 0 && gmail.connected ? (
        <CFEmptyState 
          icon={Briefcase}
          title="No placements found"
          description="Try syncing Gmail again or upload a placement PDF manually"
        >
          <CFButton variant="primary" onClick={handleSync} loading={gmail.syncing}>Sync Gmail Now</CFButton>
        </CFEmptyState>
      ) : filteredAndSortedPlacements.length === 0 ? (
        <CFEmptyState 
          icon={Search}
          title="No results for this filter"
          description="Try changing the filter or search term"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedPlacements.map((p) => (
            <PlacementCard 
              key={p._id} 
              placement={p} 
              onApply={handleApply} 
              onDismiss={handleDismiss}
              onRemind={handleRemind}
              applying={applying} 
              userCgpa={dbUser?.cgpa}
              isNotEligible={p.eligibilityStatus === 'not_eligible'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlacementCard({ placement: p, onApply, onDismiss, onRemind, applying, userCgpa, isNotEligible }) {
  const isPassed = p.deadline && new Date(p.deadline) < new Date();
  const daysLeft = p.deadline ? Math.max(0, Math.ceil((new Date(p.deadline) - new Date()) / 86400000)) : null;

  const isApplied = p.applicationStatus === 'Applied';
  const isMissed = isPassed && !isApplied;

  return (
    <CFCard className={cn(
      "flex flex-col h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1", 
      (isNotEligible || isMissed) && "opacity-60 grayscale-[10%]"
    )}>
      {/* TOP ROW */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6A68DF] to-[#EFB995] flex items-center justify-center text-white font-bold text-lg shrink-0">
            {p.company?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{p.company}</h4>
            {p.role && <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">{p.role}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <CFBadge variant="default" className="text-[10px] px-1.5 py-0">
            {p.source === 'gmail' ? '📧 Gmail' : '📄 Upload'}
          </CFBadge>
          {p.priorityScore >= 85 ? (
             <CFBadge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0 border-0">High</CFBadge>
          ) : p.priorityScore >= 50 ? (
             <CFBadge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0 border-0">Medium</CFBadge>
          ) : (
             <CFBadge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] px-1.5 py-0 border-0">Low</CFBadge>
          )}
        </div>
      </div>

      {/* PACKAGE ROW */}
      <div className="my-2">
        <span className="font-bold text-xl text-[#EFB995]">
          {p.package ? p.package : <span className="text-lg text-[var(--text-muted)] font-semibold">Package TBD</span>}
        </span>
      </div>

      {/* ELIGIBILITY ROW */}
      <div className="space-y-3 mb-4 flex-1">
        <div className="flex flex-wrap gap-2 items-center">
          {p.eligibleBranches?.length > 0 ? p.eligibleBranches.map((branch, i) => (
            <CFBadge key={i} variant="default" className="text-[10px] bg-[var(--background)]">{branch}</CFBadge>
          )) : (
            <CFBadge variant="default" className="text-[10px] bg-[var(--background)]">All Branches</CFBadge>
          )}
        </div>
        
        <div className="flex flex-col gap-1.5 text-xs">
          {p.minimumCgpa > 0 && (
            <div className="text-[var(--text-secondary)] font-medium">
              Min CGPA: {p.minimumCgpa}
            </div>
          )}
          
          <div className="font-medium mt-1">
            {userCgpa ? (
              userCgpa >= p.minimumCgpa ? (
                <span className="text-green-500 font-semibold flex items-center gap-1"><CheckCircle2 size={12}/> Your CGPA {userCgpa} — Eligible</span>
              ) : (
                <span className="text-red-500 font-semibold flex items-center gap-1"><XCircle size={12}/> Your CGPA {userCgpa} — Not Eligible (need {p.minimumCgpa})</span>
              )
            ) : (
              <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Check eligibility</span>
            )}
          </div>
        </div>
      </div>

      {/* DEADLINE ROW */}
      <div className="flex items-center justify-between mt-auto bg-[var(--card-elevated)] p-2 rounded-lg mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
          <Clock size={16} /> 
          {p.deadline ? new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No deadline'}
        </div>
        {p.deadline && !isApplied && (
          <div className={cn(
            "text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1",
            isMissed ? "bg-gray-100 text-gray-500 dark:bg-gray-800" :
            daysLeft <= 3 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
            daysLeft <= 7 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          )}>
            {isMissed ? "Deadline passed" : `${daysLeft} days left`}
            {!isMissed && daysLeft <= 3 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-1" />}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] my-3" />

      {/* ACTIONS ROW */}
      <div className="flex flex-wrap gap-2">
        {isApplied ? (
          <>
            <CFBadge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 py-1.5 px-3 font-semibold text-xs flex items-center gap-1">
              <CheckCircle2 size={14}/> Applied
            </CFBadge>
            <CFButton variant="ghost" size="sm" className="ml-auto text-xs py-1.5">View Details</CFButton>
          </>
        ) : isNotEligible ? (
          <>
            <CFBadge variant="missed" className="py-1.5 px-3 text-xs border-0 font-semibold">Not Eligible</CFBadge>
            <CFButton variant="ghost" size="sm" className="ml-auto text-xs py-1.5" onClick={() => onDismiss(p._id)}>Dismiss</CFButton>
          </>
        ) : isMissed ? (
          <CFBadge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 py-1.5 px-3 font-semibold text-xs flex items-center gap-1">
             Missed
          </CFBadge>
        ) : (
          <>
            <CFButton
              onClick={() => {
                if (p.applicationLink) window.open(p.applicationLink, '_blank');
                else toast('No link available', { icon: 'ℹ️' });
              }}
              variant="primary"
              size="sm"
              className="flex-1 py-1.5 text-xs font-semibold"
            >
              Apply Now
            </CFButton>
            <CFButton
              onClick={() => onApply(p._id)}
              disabled={applying === p._id}
              loading={applying === p._id}
              variant="secondary"
              size="sm"
              className="flex-1 py-1.5 text-xs font-semibold"
            >
              Mark Applied
            </CFButton>
            <CFButton
              onClick={() => onRemind(p)}
              variant="ghost"
              size="sm"
              className="px-2 py-1.5 text-[var(--text-secondary)]"
              title="Remind Me"
            >
              <Clock size={16} />
            </CFButton>
          </>
        )}
      </div>
    </CFCard>
  );
}
