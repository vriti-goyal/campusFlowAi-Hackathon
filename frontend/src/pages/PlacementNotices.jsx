import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail, RefreshCw, Link, CheckCircle, XCircle, AlertCircle,
  Clock, Briefcase, BookOpen, Code2, Brain, Lightbulb, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Wifi, WifiOff, Zap, Building2,
  Calendar, MapPin, DollarSign, GraduationCap
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ── Eligibility badge ────────────────────────────────────────────────────────
function EligibilityBadge({ status }) {
  const map = {
    eligible:    { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <CheckCircle size={12}/>, label: 'Eligible' },
    not_eligible:{ color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: <XCircle size={12}/>, label: 'Not Eligible' },
    partial:     { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: <AlertCircle size={12}/>, label: 'Partial' },
    pending:     { color: 'bg-white/10 text-white/50 border-white/10', icon: <Clock size={12}/>, label: 'Analysing…' },
  };
  const { color, icon, label } = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {icon} {label}
    </span>
  );
}

// ── Eligibility breakdown tooltip ────────────────────────────────────────────
function BreakdownRow({ label, check }) {
  if (!check || check.status === 'not_required') return null;
  const icon = check.status === 'pass'
    ? <CheckCircle size={13} className="text-emerald-400 shrink-0" />
    : check.status === 'fail'
    ? <XCircle size={13} className="text-red-400 shrink-0" />
    : <AlertCircle size={13} className="text-amber-400 shrink-0" />;

  const detail = () => {
    if (check.status === 'unknown') return `Your ${label.toLowerCase()} not set`;
    if (label === 'CGPA') return `${check.actual} / min ${check.required}`;
    if (label === 'Backlogs') return `${check.actual} / max ${check.maxAllowed}`;
    if (label === 'Branch') return `${check.actual} (allowed: ${check.allowed?.join(', ')})`;
    if (label === 'Grad Year') return `${check.actual} (allowed: ${check.allowed?.join(', ')})`;
    return '';
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span className="text-white/70">{label}:</span>
      <span className="text-white/50">{detail()}</span>
    </div>
  );
}

// ── Prep Plan card ────────────────────────────────────────────────────────────
function PrepPlanCard({ plan }) {
  const sections = [
    { icon: <Code2 size={14}/>, label: 'Coding Topics', items: plan.codingTopics, color: 'text-violet-400' },
    { icon: <Brain size={14}/>, label: 'Aptitude Areas', items: plan.aptitudeAreas, color: 'text-blue-400' },
    { icon: <BookOpen size={14}/>, label: 'Core Subjects', items: plan.coreSubjects, color: 'text-cyan-400' },
    { icon: <Lightbulb size={14}/>, label: 'Interview Tips', items: plan.interviewTips, color: 'text-amber-400' },
  ];

  return (
    <div className="mt-4 border-t border-white/10 pt-4 space-y-4">
      <h4 className="text-sm font-bold text-white flex items-center gap-2">
        <Zap size={14} className="text-violet-400" /> Preparation Plan
      </h4>
      {plan.summary && (
        <p className="text-xs text-white/60 leading-relaxed">{plan.summary}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map(({ icon, label, items, color }) =>
          items?.length > 0 ? (
            <div key={label} className="bg-white/[0.03] rounded-xl p-3">
              <p className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${color}`}>
                {icon} {label}
              </p>
              <ul className="space-y-1">
                {items.slice(0, 5).map((item) => (
                  <li key={item} className="text-xs text-white/60 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 w-1 h-1 rounded-full bg-white/30" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
      {plan.resources?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-white/60 mb-2">Resources</p>
          <div className="flex flex-wrap gap-2">
            {plan.resources.map((r) => (
              <span key={r.title} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-violet-400 flex items-center gap-1">
                    {r.title} <ExternalLink size={10}/>
                  </a>
                ) : r.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single notice card ────────────────────────────────────────────────────────
function NoticeCard({ notice }) {
  const [expanded, setExpanded] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [plan, setPlan] = useState(notice.preparationPlan || null);

  const p = notice.parsed;

  const fetchPrepPlan = async () => {
    setLoadingPlan(true);
    try {
      const res = await api.post(`/api/placement-notices/${notice._id}/prep-plan`);
      setPlan(res.data.data?.plan);
    } catch {
      // silently fail; user can retry
    } finally {
      setLoadingPlan(false);
    }
  };

  const deadline = p?.applicationDeadline ? new Date(p.applicationDeadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} className="text-violet-400 shrink-0" />
              <h3 className="font-bold text-white text-sm truncate">
                {p?.companyName || notice.subject || 'Untitled Notice'}
              </h3>
            </div>
            {p?.roleTitle && (
              <p className="text-xs text-white/50 ml-6">{p.roleTitle}</p>
            )}
          </div>
          <EligibilityBadge status={notice.eligibilityStatus} />
        </div>

        {/* Key info pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {p?.ctc && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <DollarSign size={10}/> {p.ctc}
            </span>
          )}
          {p?.stipend && (
            <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
              <DollarSign size={10}/> {p.stipend}
            </span>
          )}
          {deadline && (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border
              ${daysLeft <= 1 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                daysLeft <= 3 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                'text-white/50 bg-white/5 border-white/10'}`}>
              <Calendar size={10}/> {daysLeft <= 0 ? 'Deadline passed' : `${daysLeft}d left`}
            </span>
          )}
          {p?.jobLocation && (
            <span className="flex items-center gap-1 text-xs text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              <MapPin size={10}/> {p.jobLocation}
            </span>
          )}
        </div>

        {/* Skills */}
        {p?.requiredSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {p.requiredSkills.slice(0, 5).map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {s}
              </span>
            ))}
            {p.requiredSkills.length > 5 && (
              <span className="text-[10px] text-white/30">+{p.requiredSkills.length - 5} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {expanded ? 'Less' : 'Details'}
          </button>

          {!plan && p?.roleTitle && (
            <button
              onClick={fetchPrepPlan}
              disabled={loadingPlan}
              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-colors disabled:opacity-50"
            >
              {loadingPlan ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12}/>}
              {loadingPlan ? 'Generating…' : 'Get Prep Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-3">
          {/* Eligibility breakdown */}
          {p?.eligibilityCriteria && (
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Eligibility Breakdown</p>
              <div className="space-y-1.5">
                <BreakdownRow label="CGPA" check={notice._eligibilityBreakdown?.cgpa} />
                <BreakdownRow label="Backlogs" check={notice._eligibilityBreakdown?.backlogs} />
                <BreakdownRow label="Branch" check={notice._eligibilityBreakdown?.branch} />
                <BreakdownRow label="Grad Year" check={notice._eligibilityBreakdown?.graduationYear} />
                {!notice._eligibilityBreakdown && (
                  <p className="text-xs text-white/30">
                    {p.eligibilityCriteria.minCGPA != null && `Min CGPA: ${p.eligibilityCriteria.minCGPA}  `}
                    {p.eligibilityCriteria.maxBacklogs != null && `Max Backlogs: ${p.eligibilityCriteria.maxBacklogs}  `}
                    {p.eligibilityCriteria.branches?.length > 0 && `Branches: ${p.eligibilityCriteria.branches.join(', ')}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 gap-1.5">
            {p?.applicationDeadline && (
              <p className="text-xs text-white/40"><span className="text-white/60">Apply by:</span> {new Date(p.applicationDeadline).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
            )}
            {p?.assessmentDate && (
              <p className="text-xs text-white/40"><span className="text-white/60">Assessment:</span> {new Date(p.assessmentDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
            )}
            {p?.interviewDate && (
              <p className="text-xs text-white/40"><span className="text-white/60">Interview:</span> {new Date(p.interviewDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
            )}
          </div>

          {/* Preparation plan */}
          {plan && <PrepPlanCard plan={plan} />}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlacementNoticesPage() {
  const { dbUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gmailStatus, setGmailStatus] = useState({ connected: false });
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState(null);
  const [filter, setFilter] = useState('all');
  const [tnpEmails, setTnpEmails] = useState('');
  const [savingEmails, setSavingEmails] = useState(false);

  useEffect(() => {
    if (dbUser?.tnpEmail) {
      setTnpEmails(dbUser.tnpEmail);
    }
  }, [dbUser]);

  const handleSaveEmails = async () => {
    setSavingEmails(true);
    setSyncMsg(null);
    try {
      await api.patch('/api/users/me', { tnpEmail: tnpEmails });
      setSyncMsg({ type: 'success', text: '✅ Sender email filters saved!' });
    } catch {
      setSyncMsg({ type: 'error', text: '❌ Failed to save sender emails.' });
    } finally {
      setSavingEmails(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/gmail/status');
      setGmailStatus(res.data);
    } catch { /* ignore */ } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchNotices = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await api.get('/api/placement-notices', { params });
      setNotices(res.data.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // Handle OAuth callback query params
  useEffect(() => {
    const gmail = searchParams.get('gmail');
    if (gmail === 'connected') {
      setSyncMsg({ type: 'success', text: '✅ Gmail connected successfully! Click Sync to fetch placement emails.' });
      setGmailStatus({ connected: true });
    } else if (gmail === 'denied') {
      setSyncMsg({ type: 'error', text: '❌ Gmail connection was denied.' });
    } else if (gmail === 'error') {
      setSyncMsg({ type: 'error', text: '❌ Gmail connection failed. Please try again.' });
    } else if (gmail === 'no_refresh_token') {
      setSyncMsg({ type: 'warn', text: '⚠️ No refresh token received. Please revoke Gmail access in your Google Account and try again.' });
    }
  }, [searchParams]);

  const handleConnectGmail = async () => {
    try {
      const res = await api.get('/api/gmail/auth-url');
      window.location.href = res.data.url;
    } catch {
      setSyncMsg({ type: 'error', text: 'Failed to generate Gmail auth URL. Check server config.' });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.post('/api/gmail/sync');
      const { newEmails } = res.data;
      setSyncMsg({
        type: 'success',
        text: `✅ Sync complete! Found ${newEmails} new placement email${newEmails !== 1 ? 's' : ''}. AI parsing running in background — refresh in a moment.`,
      });
      await fetchNotices();
    } catch (err) {
      const msg = err.response?.data?.error || 'Sync failed. Please try again.';
      setSyncMsg({ type: 'error', text: `❌ ${msg}` });
      if (err.response?.status === 401) {
        setGmailStatus({ connected: false });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Gmail? You can reconnect anytime.')) return;
    try {
      await api.delete('/api/gmail/disconnect', { data: { confirm: true } });
      setGmailStatus({ connected: false });
      setSyncMsg({ type: 'success', text: 'Gmail disconnected successfully.' });
    } catch {
      setSyncMsg({ type: 'error', text: 'Failed to disconnect Gmail.' });
    }
  };

  const filteredNotices = filter === 'all' ? notices : notices.filter(n => n.eligibilityStatus === filter);

  const counts = {
    all: notices.length,
    eligible: notices.filter(n => n.eligibilityStatus === 'eligible').length,
    partial: notices.filter(n => n.eligibilityStatus === 'partial').length,
    not_eligible: notices.filter(n => n.eligibilityStatus === 'not_eligible').length,
    pending: notices.filter(n => n.eligibilityStatus === 'pending').length,
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'eligible', label: '✅ Eligible' },
    { key: 'partial', label: '⚠️ Partial' },
    { key: 'not_eligible', label: '❌ Not Eligible' },
    { key: 'pending', label: '⏳ Pending' },
  ];

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="text-violet-400" size={24} /> Placement Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-parsed placement notices from your TNP Gmail
          </p>
        </div>

        {/* Gmail connection controls */}
        <div className="flex items-center gap-3">
          {!statusLoading && (
            <>
              {gmailStatus.connected ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Wifi size={14}/> Gmail Connected
                  </span>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors"
                    title="Disconnect Gmail"
                  >
                    <WifiOff size={14}/>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectGmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition-all shadow-md"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.6 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.7 20-21 0-1.4-.1-2.7-.4-4z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.9 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 45c5.2 0 10-1.9 13.6-5l-6.3-5.1C29.4 36.5 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-8H6.1v5.4C9.5 40.9 16.3 45 24 45z"/>
                    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.3 5.1C40.7 36.1 44 30.5 44 24c0-1.4-.1-2.7-.4-4z"/>
                  </svg>
                  Connect TNP Gmail
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sender Email Filter Config */}
      {!statusLoading && gmailStatus.connected && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
          <label className="block text-sm font-medium text-white/80">
            Fetch from specific sender emails (comma-separated)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={tnpEmails}
              onChange={(e) => setTnpEmails(e.target.value)}
              placeholder="e.g. placements@college.edu, tnp@university.edu"
              className="flex-1 px-4 py-2 rounded-xl bg-background border border-border focus:border-violet-500 outline-none text-sm"
            />
            <button
              onClick={handleSaveEmails}
              disabled={savingEmails}
              className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-all disabled:opacity-50"
            >
              {savingEmails ? 'Saving...' : 'Save Filters'}
            </button>
          </div>
          <p className="text-xs text-white/40">If left blank, all emails in your inbox will be scanned for placement notices.</p>
        </div>
      )}

      {/* Status message */}
      {syncMsg && (
        <div className={`p-4 rounded-xl border text-sm
          ${syncMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            syncMsg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
          {syncMsg.text}
        </div>
      )}

      {/* Profile incomplete warning */}
      {dbUser && (!dbUser.cgpa || !dbUser.branch) && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm text-amber-400 font-medium">Profile incomplete</p>
            <p className="text-xs text-amber-400/70">Add your CGPA and Branch in <a href="/profile" className="underline hover:text-amber-300">Profile Settings</a> to get accurate eligibility checks.</p>
          </div>
        </div>
      )}

      {/* Empty state — Gmail not connected */}
      {!statusLoading && !gmailStatus.connected && notices.length === 0 && (
        <div className="text-center py-16 space-y-4 border border-dashed border-white/10 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto">
            <Mail className="text-violet-400" size={24} />
          </div>
          <h2 className="text-lg font-bold text-foreground">Connect Your TNP Gmail</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Connect your Training &amp; Placement cell Gmail account. We'll automatically find placement-related emails and parse them using AI.
          </p>
          <button
            onClick={handleConnectGmail}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-all"
          >
            <Link size={16} /> Connect Gmail
          </button>
          <p className="text-xs text-muted-foreground">
            Read-only access only · We never send emails on your behalf
          </p>
        </div>
      )}

      {/* Filter tabs */}
      {notices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${filter === key
                  ? 'bg-violet-600 text-white'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70'}`}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-violet-400" size={32} />
        </div>
      ) : filteredNotices.length === 0 && gmailStatus.connected ? (
        <div className="text-center py-12 text-muted-foreground">
          {filter === 'all'
            ? 'No placement emails found. Click "Sync Now" to fetch from Gmail.'
            : `No ${filter.replace('_', ' ')} notices found.`}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredNotices.map((notice) => (
            <NoticeCard key={notice._id} notice={notice} />
          ))}
        </div>
      )}
    </div>
  );
}
