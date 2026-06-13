import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserCircle, Save, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/api/users/me');
        setProfile(res.data);
      } catch (error) {
        console.error('Failed to load profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('routine.')) {
      const field = name.split('.')[1];
      setProfile((prev) => ({
        ...prev,
        routine: { ...(prev.routine || {}), [field]: value }
      }));
    } else if (name === 'skills' || name === 'placementInterests' || name === 'subjects') {
      setProfile((prev) => ({ ...prev, [name]: value.split(',').map(s => s.trim()) }));
    } else {
      setProfile((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/api/users/me', profile);
      alert('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile', error);
      alert('Error updating profile');
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex items-center gap-3">
        <UserCircle className="text-primary" size={26} />
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
      </div>

      <div className="bg-secondary/40 border border-border rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Name</label>
            <input
              type="text"
              name="name"
              value={profile?.name || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-md text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">College</label>
            <input
              type="text"
              name="college"
              value={profile?.college || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Branch</label>
            <input
              type="text"
              name="branch"
              value={profile?.branch || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Semester</label>
            <input
              type="number"
              name="semester"
              value={profile?.semester || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Section</label>
            <input
              type="text"
              name="section"
              value={profile?.section || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Roll Number</label>
            <input
              type="text"
              name="rollNumber"
              value={profile?.rollNumber || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">CGPA</label>
            <input
              type="number"
              step="0.01"
              name="cgpa"
              value={profile?.cgpa || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Skills (comma separated)</label>
            <input
              type="text"
              name="skills"
              value={profile?.skills?.join(', ') || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Placement Interests (comma separated)</label>
            <input
              type="text"
              name="placementInterests"
              value={profile?.placementInterests?.join(', ') || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-secondary/40 border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Routine</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Wake Up Time</label>
            <input
              type="time"
              name="routine.wakeUpTime"
              value={profile?.routine?.wakeUpTime || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sleep Time</label>
            <input
              type="time"
              name="routine.sleepTime"
              value={profile?.routine?.sleepTime || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Save Profile
        </button>
      </div>
    </div>
  );
}
