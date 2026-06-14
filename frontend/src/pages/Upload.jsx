import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Layers, ChevronDown, CalendarDays, BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

const PROGRESS_STEPS = [
  'Extracting text...',
  'Classifying document...',
  'Generating summary...',
  'Extracting deadline...',
  'Creating entry...',
];

// ── Batch Selector ─────────────────────────────────────────────────────────────
function BatchSelector({ batches, value, onChange, loadingBatches }) {
  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide">
        Upload For <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Layers size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <select
          id="upload-target"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-12 pr-10 py-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] outline-none appearance-none cursor-pointer transition-all"
          disabled={loadingBatches}
        >
          <option value="personal">📎 Personal Use (not shared)</option>
          {batches.map((b) => (
            <option key={b._id} value={b._id}>
              🏫 {b.batchName}
              {b.branch ? ` · ${b.branch}` : ''}
              {b.semester ? ` · Sem ${b.semester}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>
      {value !== 'personal' && batches.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">
          This will be shared with all members of the selected batch.
        </p>
      )}
    </div>
  );
}

export default function UploadPage() {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('file'); // 'file' | 'text'
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [targetBatchId, setTargetBatchId] = useState('personal');
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [finalized, setFinalized] = useState(false);

  // Fetch user's batches on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/batch/my-batches');
        setBatches(res.data || []);
      } catch {
        // If fetch fails, gracefully degrade to personal only
      } finally {
        setLoadingBatches(false);
      }
    })();
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const simulateProgress = () =>
    new Promise((resolve) => {
      let step = 0;
      const interval = setInterval(() => {
        setProgressStep(step);
        step++;
        if (step >= PROGRESS_STEPS.length) { clearInterval(interval); resolve(); }
      }, 600);
    });

  const handleSubmit = async () => {
    setError('');
    setResult(null);
    setFinalized(false);
    setLoading(true);
    setProgressStep(0);

    try {
      const progressPromise = simulateProgress();
      const isPersonal = targetBatchId === 'personal';

      const batchId = isPersonal ? 'personal' : targetBatchId;
      const body = {
        batchId,
        targetType: isPersonal ? 'personal' : 'batch',
        ...(isPersonal ? {} : { targetBatchId }),
      };

      let response;
      if (mode === 'file') {
        if (!file) { setError('Please select a file'); setLoading(false); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('batchId', batchId);
        formData.append('targetType', body.targetType);
        if (!isPersonal) formData.append('targetBatchId', targetBatchId);
        response = await api.post('/api/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        if (!text.trim()) { setError('Please enter text'); setLoading(false); return; }
        response = await api.post('/api/upload/text', { ...body, text });
      }

      await progressPromise;
      const responseData = response.data.data;

      if (responseData.autoDetected) {
        setResult({ autoDetected: responseData.autoDetected, message: responseData.message, ...responseData });
      } else {
        setResult(responseData);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
      setProgressStep(-1);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await api.post('/api/upload/finalize', {
        postId: result.post._id,
        extraction: result.extraction,
      });
      setFinalized(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Finalize failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => { setResult(null); setFile(null); setText(''); };
  const resetAll = () => { setResult(null); setFile(null); setText(''); setFinalized(false); setError(''); };

  // ── Auto-detected timetable/exam schedule success ───
  if (result?.autoDetected) {
    const isExam = result.autoDetected === 'exam_schedule';
    const Icon = isExam ? BookOpen : CalendarDays;
    return (
      <div className="max-w-2xl mx-auto pb-10">
        <CFCard gradient className="text-center p-8 space-y-6">
          <div className="flex items-center justify-center gap-4">
            <Sparkles className="text-white animate-pulse" size={32} />
            <Icon className="text-white" size={48} />
            <Sparkles className="text-white animate-pulse" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white">AI Auto-Detected!</h2>
          <p className="text-white/90 text-sm font-medium">{result.message}</p>
          
          <div className="bg-black/10 rounded-xl p-4 inline-block text-left space-y-2">
            {result.totalSlots && <p className="text-sm text-white/90 font-medium">✅ {result.totalSlots} slots across {result.updatedDays} days saved to timetable</p>}
            {result.inserted && <p className="text-sm text-white/90 font-medium">✅ {result.inserted} exam entries saved to schedule</p>}
          </div>
          
          <div>
            <CFButton variant="secondary" onClick={resetAll} className="mt-4 px-8">
              Upload Another
            </CFButton>
          </div>
        </CFCard>
      </div>
    );
  }

  // ── Finalized success ───
  if (finalized) {
    const targetBatch = batches.find((b) => b._id === targetBatchId);
    return (
      <div className="max-w-2xl mx-auto pb-10">
        <CFCard className="text-center p-8 space-y-6 border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900">
          <CheckCircle className="mx-auto text-green-500" size={56} />
          <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Entry Created Successfully!</h2>
          <p className="text-green-600 dark:text-green-500 text-sm font-medium leading-relaxed max-w-md mx-auto">
            A <span className="font-bold">{result.extraction.category}</span> entry has been added
            {targetBatch ? ` and shared with batch "${targetBatch.batchName}"` : ' to your personal records'}.
            A calendar event was created automatically.
          </p>
          <div>
            <CFButton variant="primary" onClick={resetAll} className="mt-4 px-8 bg-green-600 hover:bg-green-700 border-none text-white">
              Upload Another
            </CFButton>
          </div>
        </CFCard>
      </div>
    );
  }

  // ── Review card ───
  if (result) {
    const { extraction } = result;
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-10">
        <CFCard className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6A68DF] to-[#EFB995] flex items-center justify-center shadow-md">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">AI Extraction Review</h2>
              <p className="text-sm text-[var(--text-secondary)]">Please review and confirm the extracted details.</p>
            </div>
          </div>

          <div className="bg-[var(--bg)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              <ReviewRow label="Category" value={<CFBadge className="capitalize">{extraction.category}</CFBadge>} />
              <ReviewRow label="Title" value={<span className="font-semibold text-[var(--text-primary)]">{extraction.title}</span>} />
              <ReviewRow label="Summary" value={extraction.summary} />
              
              {extraction.actionRequired && (
                <ReviewRow label="Action Required" value={
                  <div className="flex items-start gap-2 text-[#6A68DF] bg-[#6A68DF]/10 p-2 rounded-lg text-sm font-medium">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{extraction.actionRequired}</span>
                  </div>
                } />
              )}
              
              <ReviewRow label="Deadline" value={extraction.deadline ? new Date(extraction.deadline).toLocaleDateString() : '—'} />
              <ReviewRow label="Priority" value={
                <CFBadge variant={extraction.priorityLevel === 'high' ? 'high' : extraction.priorityLevel === 'medium' ? 'medium' : 'low'} className="uppercase">
                  {extraction.priorityLevel} ({extraction.priorityScore}/100)
                </CFBadge>
              } />
              
              {extraction.company && <ReviewRow label="Company" value={<span className="font-semibold">{extraction.company}</span>} />}
              {extraction.role && <ReviewRow label="Role" value={extraction.role} />}
              {extraction.package && <ReviewRow label="Package" value={<span className="text-[#EFB995] font-semibold">{extraction.package}</span>} />}
              {extraction.minimumCgpa > 0 && <ReviewRow label="Min CGPA" value={extraction.minimumCgpa} />}
              {extraction.eligibleBranches?.length > 0 && (
                <ReviewRow label="Branches" value={
                  <div className="flex flex-wrap gap-1.5">
                    {extraction.eligibleBranches.map((b, i) => <CFBadge key={i} variant="default" className="text-[10px]">{b}</CFBadge>)}
                  </div>
                } />
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <CFButton onClick={handleConfirm} disabled={loading} loading={loading} icon={CheckCircle} className="flex-1 bg-green-600 hover:bg-green-700 text-white border-none py-2.5">
              Confirm & Save
            </CFButton>
            <CFButton variant="ghost" onClick={handleDiscard} icon={XCircle} className="flex-1 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 py-2.5">
              Discard
            </CFButton>
          </div>
        </CFCard>
      </div>
    );
  }

  // ── Upload form ───
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Upload className="text-[#6A68DF]" size={24} /> Upload Center
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Upload a document or paste text. AI will extract info and create calendar entries automatically.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <CFCard className="p-6">
        {/* Batch selector */}
        <BatchSelector
          batches={batches}
          value={targetBatchId}
          onChange={setTargetBatchId}
          loadingBatches={loadingBatches}
        />

        {/* Mode toggle */}
        <div className="flex bg-[var(--bg)] p-1 rounded-full mb-6 border border-[var(--border)] w-fit mx-auto sm:mx-0">
          <button onClick={() => setMode('file')}
            className={cn("px-6 py-2 rounded-full text-sm font-bold transition-all duration-300", mode === 'file' ? "bg-white dark:bg-[var(--card)] text-[#6A68DF] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
            File Upload
          </button>
          <button onClick={() => setMode('text')}
            className={cn("px-6 py-2 rounded-full text-sm font-bold transition-all duration-300", mode === 'text' ? "bg-white dark:bg-[var(--card)] text-[#6A68DF] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
            Paste Text
          </button>
        </div>

        {mode === 'file' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group",
              file ? "border-[#6A68DF] bg-[#6A68DF]/5" : "border-[#6A68DF]/30 hover:border-[#6A68DF] hover:bg-[#6A68DF]/5 bg-[var(--bg)]"
            )}
          >
            <div className={cn("w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 transition-all duration-300", file ? "bg-[#6A68DF] text-white" : "bg-[#6A68DF]/10 text-[#6A68DF] group-hover:scale-110")}>
              {file ? <FileText size={28} /> : <Upload size={28} />}
            </div>
            
            {file ? (
              <div>
                <p className="text-base font-bold text-[var(--text-primary)]">{file.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="text-base font-bold text-[var(--text-primary)]">Drop file here or click to browse</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">PDF, PNG, JPG — max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the notice, circular, or announcement text here..."
            className="w-full px-5 py-4 rounded-2xl border border-[#6A68DF]/30 bg-[var(--bg)] focus:ring-2 focus:ring-[#6A68DF]/20 focus:border-[#6A68DF] outline-none text-sm resize-none transition-all text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        )}

        {/* Progress indicator */}
        {loading && progressStep >= 0 && (
          <div className="mt-6 bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">AI Processing</h4>
            {PROGRESS_STEPS.map((step, i) => (
              <div key={i} className={cn("flex items-center gap-3 text-sm font-medium transition-all duration-300", 
                i < progressStep ? "text-green-500" : 
                i === progressStep ? "text-[#6A68DF]" : 
                "text-[var(--text-muted)] opacity-50"
              )}>
                {i < progressStep ? (
                  <CheckCircle size={16} />
                ) : i === progressStep ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center shrink-0" />
                )}
                {step}
              </div>
            ))}
          </div>
        )}

        <CFButton
          onClick={handleSubmit}
          disabled={loading || (mode === 'file' && !file) || (mode === 'text' && !text.trim())}
          loading={loading}
          variant="primary"
          icon={Upload}
          className="w-full py-3.5 mt-6 text-sm"
        >
          {loading ? "Processing Document..." : "Upload & Process with AI"}
        </CFButton>
      </CFCard>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 p-4 hover:bg-[var(--card)] transition-colors">
      <span className="font-semibold text-xs text-[var(--text-secondary)] uppercase tracking-wider w-32 shrink-0 sm:pt-0.5">{label}</span>
      <div className="text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
