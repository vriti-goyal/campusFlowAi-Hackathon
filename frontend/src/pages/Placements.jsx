import { useEffect, useState } from 'react';
import { Briefcase, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function PlacementsPage() {
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);

  const fetchPlacements = async () => {
    try {
      // Get user's batches, then fetch placements for each
      const batchRes = await api.get('/api/batch/my-batches').catch(() => ({ data: [] }));
      const batches = batchRes.data || [];

      if (batches.length === 0) {
        // No batches — fetch all placements without batchId filter
        const res = await api.get('/api/placements');
        setPlacements(res.data.data || []);
      } else {
        // Fetch placements for each batch and merge
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!placements.length) {
    return (
      <div className="text-center py-16 space-y-3">
        <Briefcase className="mx-auto text-muted-foreground" size={48} />
        <h2 className="text-xl font-bold text-foreground">No Placements Yet</h2>
        <p className="text-muted-foreground text-sm">Upload a placement notice to get started.</p>
      </div>
    );
  }

  // Group by eligibility + application status
  const eligible = placements.filter((p) => p.eligibilityStatus === 'eligible' && p.applicationStatus === 'Not Applied');
  const applied = placements.filter((p) => p.applicationStatus === 'Applied');
  const notEligible = placements.filter((p) => p.eligibilityStatus === 'not_eligible' && p.applicationStatus !== 'Applied');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Placement Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Opportunities curated based on your profile</p>
      </div>

      <Section title="Eligible for You" items={eligible} onApply={handleApply} applying={applying} />
      <Section title="Applied" items={applied} onApply={handleApply} applying={applying} />
      <Section title="Not Eligible" items={notEligible} onApply={handleApply} applying={applying} dimmed />
    </div>
  );
}

function Section({ title, items, onApply, applying, dimmed = false }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title} ({items.length})
      </h3>
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${dimmed ? 'opacity-60' : ''}`}>
        {items.map((p) => (
          <PlacementCard key={p._id} placement={p} onApply={onApply} applying={applying} />
        ))}
      </div>
    </div>
  );
}

function PlacementCard({ placement, onApply, applying }) {
  const p = placement;
  const daysLeft = p.deadline ? Math.max(0, Math.ceil((new Date(p.deadline) - new Date()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-foreground">{p.company}</h4>
          {p.role && <p className="text-sm text-muted-foreground">{p.role}</p>}
        </div>
        {p.applicationStatus === 'Applied' ? (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            <CheckCircle2 size={12} /> Applied
          </span>
        ) : p.eligibilityStatus === 'not_eligible' ? (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
            <XCircle size={12} /> Not Eligible
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {p.package && <span>💰 {p.package}</span>}
        {p.minimumCgpa > 0 && <span>📊 Min CGPA: {p.minimumCgpa}</span>}
        {daysLeft !== null && <span>⏰ {daysLeft}d left</span>}
        {p.eligibleBranches?.length > 0 && <span>🎓 {p.eligibleBranches.join(', ')}</span>}
      </div>

      <div className="flex gap-2 pt-1">
        {p.applicationStatus !== 'Applied' && p.eligibilityStatus === 'eligible' && (
          <button
            onClick={() => onApply(p._id)}
            disabled={applying === p._id}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {applying === p._id ? <Loader2 size={12} className="animate-spin" /> : <Briefcase size={12} />}
            Apply Now
          </button>
        )}
        {p.applicationStatus !== 'Applied' && (
          <button
            onClick={() => onApply(p._id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            <CheckCircle2 size={12} /> Mark Applied
          </button>
        )}
        {p.applicationLink && (
          <a
            href={p.applicationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
          >
            <ExternalLink size={12} /> Link
          </a>
        )}
      </div>
    </div>
  );
}
