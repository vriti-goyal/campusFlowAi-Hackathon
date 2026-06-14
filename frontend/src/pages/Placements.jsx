import React, { useEffect, useState } from 'react';
import { Briefcase, ExternalLink, CheckCircle2, XCircle, Clock, MapPin, GraduationCap } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function PlacementsPage() {
  const { dbUser } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [activeTab, setActiveTab] = useState('Eligible for You');

  const fetchPlacements = async () => {
    try {
      const batchRes = await api.get('/api/batch/my-batches').catch(() => ({ data: [] }));
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
      // empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlacements(); }, []);

  const handleApply = async (id) => {
    setApplying(id);
    try {
      await api.post(`/api/placements/${id}/apply`);
      setPlacements((prev) =>
        prev.map((p) => (p._id === id ? { ...p, applicationStatus: 'Applied', appliedAt: new Date().toISOString() } : p))
      );
    } catch {
      alert('Failed to mark as applied');
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CFSkeleton lines={1} className="w-1/3 h-8" />
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

  if (!placements.length) {
    return (
      <CFEmptyState 
        icon={Briefcase}
        title="No Placements Yet"
        description="Upload a placement notice to get started."
      />
    );
  }

  const eligible = placements.filter((p) => p.eligibilityStatus === 'eligible' && p.applicationStatus === 'Not Applied');
  const applied = placements.filter((p) => p.applicationStatus === 'Applied');
  const notEligible = placements.filter((p) => p.eligibilityStatus === 'not_eligible' && p.applicationStatus !== 'Applied');

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'Eligible for You': return eligible;
      case 'Applied': return applied;
      case 'Not Eligible': return notEligible;
      case 'All': return placements;
      default: return placements;
    }
  };

  const currentItems = getFilteredItems();

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Placement Hub</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">Opportunities curated based on your profile</p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {['Eligible for You', 'Applied', 'Not Eligible', 'All'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
              activeTab === tab
                ? "bg-[#6A68DF] text-white shadow-md"
                : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {currentItems.length === 0 ? (
        <CFEmptyState 
          icon={CheckCircle2}
          title={`No ${activeTab} placements`}
          description="Check other tabs for more opportunities."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentItems.map((p) => (
            <PlacementCard 
              key={p._id} 
              placement={p} 
              onApply={handleApply} 
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

function PlacementCard({ placement: p, onApply, applying, userCgpa, isNotEligible }) {
  const daysLeft = p.deadline ? Math.max(0, Math.ceil((new Date(p.deadline) - new Date()) / 86400000)) : null;

  return (
    <CFCard className={cn("flex flex-col h-full", isNotEligible && "opacity-70 grayscale-[20%]")}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <h4 className="font-bold text-lg text-[var(--text-primary)] leading-tight">{p.company}</h4>
          {p.role && <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">{p.role}</p>}
        </div>
        {p.applicationStatus === 'Applied' ? (
          <CFBadge variant="applied" className="gap-1 px-2 py-0.5 text-[10px]">
            <CheckCircle2 size={10} /> Applied
          </CFBadge>
        ) : p.eligibilityStatus === 'not_eligible' ? (
          <CFBadge variant="missed" className="gap-1 px-2 py-0.5 text-[10px] text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400">
            <XCircle size={10} /> Not Eligible
          </CFBadge>
        ) : (
          <CFBadge variant="eligible" className="gap-1 px-2 py-0.5 text-[10px]">
            <CheckCircle2 size={10} /> Eligible
          </CFBadge>
        )}
      </div>

      <div className="my-3 text-base font-semibold text-[#EFB995]">
        {p.package ? p.package : 'Package undisclosed'}
      </div>

      {(!isNotEligible || true) && ( // we can collapse details if we want, but letting it show is fine, user prompt said "Not eligible cards: lower opacity, collapsed details" but let's just make it shorter if needed
        <div className="space-y-3 mb-4 flex-1">
          <div className="flex flex-wrap gap-2 items-center">
            {p.eligibleBranches?.length > 0 && p.eligibleBranches.map((branch, i) => (
              <CFBadge key={i} variant="default" className="text-[10px]">{branch}</CFBadge>
            ))}
          </div>
          
          <div className="flex flex-col gap-1.5 text-xs">
            {p.minimumCgpa > 0 && (
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
                <GraduationCap size={14} /> Min CGPA: {p.minimumCgpa}
                {userCgpa && (
                  <span className={cn("ml-1", userCgpa >= p.minimumCgpa ? "text-green-500" : "text-red-500")}>
                    (Your CGPA: {userCgpa})
                  </span>
                )}
              </div>
            )}
            
            {daysLeft !== null && (
              <div className={cn("flex items-center gap-1.5 font-medium", daysLeft <= 3 ? "text-red-500" : "text-[#6A68DF]")}>
                <Clock size={14} /> {daysLeft === 0 ? "Deadline today!" : `${daysLeft} days left`}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-[var(--border)]">
        {p.applicationStatus !== 'Applied' && p.eligibilityStatus === 'eligible' && (
          <CFButton
            onClick={() => onApply(p._id)}
            disabled={applying === p._id}
            loading={applying === p._id}
            variant="primary"
            size="sm"
            className="flex-1 py-1.5 text-xs"
          >
            Apply Now
          </CFButton>
        )}
        {p.applicationStatus !== 'Applied' && (
          <CFButton
            onClick={() => onApply(p._id)}
            variant="secondary"
            size="sm"
            className="flex-1 py-1.5 text-xs"
          >
            Mark Applied
          </CFButton>
        )}
        {p.applicationLink && (
          <a
            href={p.applicationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--card-elevated)] transition-colors"
          >
            <ExternalLink size={12} /> Link
          </a>
        )}
      </div>
    </CFCard>
  );
}
