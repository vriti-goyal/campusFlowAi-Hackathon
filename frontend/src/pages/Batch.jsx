import { useState, useEffect } from 'react';
import { Layers, Plus, UserPlus, Loader2, Copy } from 'lucide-react';
import api from '@/lib/api';

export default function BatchPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const [createForm, setCreateForm] = useState({ batchName: '', college: '', branch: '', semester: '' });
  const [joinCode, setJoinCode] = useState('');

  const fetchBatches = async () => {
    try {
      const res = await api.get('/api/batch/my-batches');
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/batch/create', createForm);
      setCreateForm({ batchName: '', college: '', branch: '', semester: '' });
      alert('Batch created!');
      fetchBatches();
    } catch (err) {
      console.error(err);
      alert('Failed to create batch');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoining(true);
    try {
      await api.post('/api/batch/join', { batchCode: joinCode });
      setJoinCode('');
      alert('Joined batch!');
      fetchBatches();
    } catch (err) {
      console.error(err);
      alert('Failed to join batch');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl pb-10">
      <div className="flex items-center gap-3">
        <Layers className="text-primary" size={26} />
        <h2 className="text-2xl font-bold text-foreground">Batch Management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Batch Form */}
        <div className="bg-secondary/30 border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Plus size={20} className="text-primary" /> Create New Batch
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Batch Name *</label>
              <input required type="text" value={createForm.batchName} onChange={e => setCreateForm({...createForm, batchName: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" placeholder="e.g., CS 2024 Section A" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">College</label>
                <input type="text" value={createForm.college} onChange={e => setCreateForm({...createForm, college: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Branch</label>
                <input type="text" value={createForm.branch} onChange={e => setCreateForm({...createForm, branch: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Semester</label>
              <input type="number" value={createForm.semester} onChange={e => setCreateForm({...createForm, semester: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1" />
            </div>
            <button disabled={creating} type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create Batch'}
            </button>
          </form>
        </div>

        {/* Join Batch Form */}
        <div className="bg-secondary/30 border border-border rounded-xl p-6 h-fit">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <UserPlus size={20} className="text-primary" /> Join Batch
          </h3>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Batch Code *</label>
              <input required type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm mt-1 uppercase" placeholder="Enter 8-character code" />
            </div>
            <button disabled={joining} type="submit" className="w-full bg-secondary-foreground text-background py-2 rounded-md font-medium hover:opacity-90 flex justify-center items-center gap-2 disabled:opacity-50">
              {joining ? <Loader2 className="animate-spin" size={18} /> : 'Join Batch'}
            </button>
          </form>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="text-xl font-bold text-foreground mb-4">My Batches</h3>
        {batches.length === 0 ? (
          <p className="text-muted-foreground text-sm">You haven't joined any batches yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map(batch => (
              <div key={batch._id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-lg">{batch.batchName}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${batch.myRole === 'owner' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                    {batch.myRole}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {batch.college && <p>College: {batch.college}</p>}
                  {batch.branch && <p>Branch: {batch.branch}</p>}
                  {batch.semester && <p>Semester: {batch.semester}</p>}
                </div>
                {(batch.myRole === 'owner' || batch.myRole === 'moderator') && (
                  <div className="mt-4 p-3 bg-secondary/50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Share Code</p>
                      <p className="font-mono font-bold tracking-widest text-foreground">{batch.batchCode}</p>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(batch.batchCode);
                        alert('Code copied to clipboard!');
                      }}
                      className="p-2 hover:bg-secondary rounded-md transition-colors"
                      title="Copy code"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
