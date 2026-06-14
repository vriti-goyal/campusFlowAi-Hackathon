import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Edit3, Loader2, Layers, User, ChevronDown, CalendarDays, BookOpen, Sparkles } from 'lucide-react';
import api from '@/lib/api';

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
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">
        Upload For <span className="text-destructive">*</span>
      </label>
      <div className="relative">
        <Layers size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <select
          id="upload-target"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer"
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
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
      {value !== 'personal' && batches.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
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

      // batchId is still required by the backend; use the real batch ID or a placeholder
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

      // Check if the backend auto-detected a timetable or exam schedule
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-2xl p-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="text-purple-500" size={28} />
            <Icon className="text-purple-500" size={40} />
          </div>
          <h2 className="text-xl font-bold text-purple-700 dark:text-purple-400">AI Auto-Detected!</h2>
          <p className="text-purple-600 dark:text-purple-400 text-sm">{result.message}</p>
          {result.totalSlots && <p className="text-xs text-muted-foreground">✅ {result.totalSlots} slots across {result.updatedDays} days saved to timetable</p>}
          {result.inserted && <p className="text-xs text-muted-foreground">✅ {result.inserted} exam entries saved to schedule</p>}
          <button onClick={resetAll} className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  // ── Finalized success ───
  if (finalized) {
    const targetBatch = batches.find((b) => b._id === targetBatchId);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-2xl p-8 text-center space-y-4">
          <CheckCircle className="mx-auto text-green-500" size={48} />
          <h2 className="text-xl font-bold text-green-700 dark:text-green-400">Entry Created Successfully!</h2>
          <p className="text-green-600 dark:text-green-500 text-sm">
            A <span className="font-semibold">{result.extraction.category}</span> entry has been added
            {targetBatch ? ` and shared with batch "${targetBatch.batchName}"` : ' to your personal records'}.
            A calendar event was created automatically.
          </p>
          <button onClick={resetAll} className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  // ── Review card ───
  if (result) {
    const { extraction } = result;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            <FileText size={20} className="text-primary" /> AI Extraction Review
          </h2>
          <p className="text-sm text-muted-foreground mb-4">The AI found the following. Please review and confirm.</p>

          <div className="space-y-3 text-sm">
            <Row label="Category" value={extraction.category} />
            <Row label="Title" value={extraction.title} />
            <Row label="Summary" value={extraction.summary} />
            <Row label="Action Required" value={extraction.actionRequired} />
            <Row label="Deadline" value={extraction.deadline ? new Date(extraction.deadline).toLocaleDateString() : '—'} />
            <Row label="Priority" value={`${extraction.priorityLevel} (${extraction.priorityScore}/100)`} />
            {extraction.company && <Row label="Company" value={extraction.company} />}
            {extraction.role && <Row label="Role" value={extraction.role} />}
            {extraction.package && <Row label="Package" value={extraction.package} />}
            {extraction.minimumCgpa > 0 && <Row label="Min CGPA" value={extraction.minimumCgpa} />}
            {extraction.eligibleBranches?.length > 0 && (
              <Row label="Branches" value={extraction.eligibleBranches.join(', ')} />
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleConfirm} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              <CheckCircle size={16} /> Confirm
            </button>
            <button onClick={handleDiscard}
              className="flex items-center gap-2 px-5 py-2.5 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors">
              <XCircle size={16} /> Discard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload form ───
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Center</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a document or paste text. AI will extract info and create calendar entries automatically.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Batch selector — Feature 3 */}
      <BatchSelector
        batches={batches}
        value={targetBatchId}
        onChange={setTargetBatchId}
        loadingBatches={loadingBatches}
      />

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => setMode('file')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'file' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          File Upload
        </button>
        <button onClick={() => setMode('text')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'text' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Paste Text
        </button>
      </div>

      {mode === 'file' ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Upload className="mx-auto text-muted-foreground mb-3" size={36} />
          {file ? (
            <p className="text-sm font-medium text-foreground">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG — max 10MB</p>
            </>
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
          className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm resize-none"
        />
      )}

      {/* Progress indicator */}
      {loading && progressStep >= 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          {PROGRESS_STEPS.map((step, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm ${i <= progressStep ? 'text-primary' : 'text-muted-foreground/50'}`}>
              {i < progressStep ? (
                <CheckCircle size={14} className="text-green-500" />
              ) : i === progressStep ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current inline-block" />
              )}
              {step}
            </div>
          ))}
        </div>
      )}

      <button
        id="upload-submit"
        onClick={handleSubmit}
        disabled={loading || (mode === 'file' && !file) || (mode === 'text' && !text.trim())}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading
          ? <><Loader2 size={18} className="animate-spin" /> Processing...</>
          : <><Upload size={18} /> Upload &amp; Process</>}
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-4">
      <span className="font-medium text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
