import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Edit3, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const PROGRESS_STEPS = [
  'Extracting text...',
  'Classifying document...',
  'Generating summary...',
  'Extracting deadline...',
  'Creating entry...',
];

export default function UploadPage() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('file'); // 'file' | 'text'
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [batchId, setBatchId] = useState('default-batch');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(-1);
  const [result, setResult] = useState(null); // { post, extraction }
  const [error, setError] = useState('');
  const [finalized, setFinalized] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const simulateProgress = () => {
    return new Promise((resolve) => {
      let step = 0;
      const interval = setInterval(() => {
        setProgressStep(step);
        step++;
        if (step >= PROGRESS_STEPS.length) {
          clearInterval(interval);
          resolve();
        }
      }, 600);
    });
  };

  const handleSubmit = async () => {
    setError('');
    setResult(null);
    setFinalized(false);
    setLoading(true);
    setProgressStep(0);

    try {
      const progressPromise = simulateProgress();

      let response;
      if (mode === 'file') {
        if (!file) { setError('Please select a file'); setLoading(false); return; }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('batchId', batchId);
        response = await api.post('/api/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        if (!text.trim()) { setError('Please enter text'); setLoading(false); return; }
        response = await api.post('/api/upload/text', { batchId, text });
      }

      await progressPromise;
      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
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

  const handleDiscard = () => {
    setResult(null);
    setFile(null);
    setText('');
  };

  const resetAll = () => {
    setResult(null);
    setFile(null);
    setText('');
    setFinalized(false);
    setError('');
  };

  // ─── Finalized success state ───
  if (finalized) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="mx-auto text-green-500" size={48} />
          <h2 className="text-xl font-bold text-green-800">Entry Created Successfully!</h2>
          <p className="text-green-700 text-sm">
            A <span className="font-semibold">{result.extraction.category}</span> entry has been added and a calendar event was created.
          </p>
          <button onClick={resetAll} className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  // ─── Review card ───
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
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={16} /> Confirm
            </button>
            <button
              onClick={() => alert('Edit mode coming in Phase 2!')}
              className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              <Edit3 size={16} /> Edit
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-2 px-5 py-2.5 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
            >
              <XCircle size={16} /> Discard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Upload form ───
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

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('file')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'file' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          File Upload
        </button>
        <button
          onClick={() => setMode('text')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'text' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          Paste Text
        </button>
      </div>

      {/* Batch ID */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Batch ID</label>
        <input
          type="text"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          placeholder="e.g., CSE-2025-A"
        />
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
        onClick={handleSubmit}
        disabled={loading || (mode === 'file' && !file) || (mode === 'text' && !text.trim())}
        className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><Upload size={18} /> Upload &amp; Process</>}
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
