import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserCircle, Save, Loader2, Pencil, X, Mail, Building2, BookOpen, Hash, Award, Briefcase, Clock, Moon } from 'lucide-react';
import api from '@/lib/api';

// ── Read-only field display ──
function InfoField({ icon: Icon, label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(', ') : value;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0">
      {Icon && <Icon size={16} className="text-primary mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground mt-0.5">{display}</p>
      </div>
    </div>
  );
}

// ── Editable input ──
function EditField({ label, name, type = 'text', value, onChange, placeholder, disabled, step }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        className={`w-full px-3 py-2 rounded-lg border border-border text-sm transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none
          ${disabled ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'}`}
      />
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [editProfile, setEditProfile] = useState(null); // copy for editing
  const [saveMsg, setSaveMsg] = useState(null);

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

  const startEditing = () => {
    setEditProfile(JSON.parse(JSON.stringify(profile))); // deep copy
    setEditing(true);
    setSaveMsg(null);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditProfile(null);
    setSaveMsg(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('routine.')) {
      const field = name.split('.')[1];
      setEditProfile((prev) => ({
        ...prev,
        routine: { ...(prev.routine || {}), [field]: value }
      }));
    } else if (name === 'skills' || name === 'placementInterests' || name === 'subjects') {
      setEditProfile((prev) => ({ ...prev, [name]: value.split(',').map(s => s.trim()) }));
    } else {
      setEditProfile((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await api.patch('/api/users/me', editProfile);
      setProfile(res.data || editProfile);
      setEditing(false);
      setEditProfile(null);
      setSaveMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (error) {
      console.error('Failed to update profile', error);
      setSaveMsg({ type: 'error', text: 'Failed to save profile. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'U')}&background=6366f1&color=fff&bold=true`}
            alt="avatar"
            className="w-14 h-14 rounded-full object-cover border-2 border-primary/30 shadow-md"
          />
          <div>
            <h2 className="text-2xl font-bold text-foreground">{profile?.name || 'Student'}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        {!editing ? (
          <button
            onClick={startEditing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Pencil size={15} /> Update Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={cancelEditing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X size={15} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save Profile
            </button>
          </div>
        )}
      </div>

      {/* ── Success / Error message ── */}
      {saveMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
          saveMsg.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {saveMsg.text}
        </div>
      )}

      {/* ── VIEW MODE ── */}
      {!editing ? (
        <>
          {/* Academic Info */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Academic Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <InfoField icon={Building2} label="College" value={profile?.college} />
              <InfoField icon={BookOpen} label="Branch" value={profile?.branch} />
              <InfoField icon={Hash} label="Semester" value={profile?.semester} />
              <InfoField icon={Hash} label="Section" value={profile?.section} />
              <InfoField icon={Hash} label="Roll Number" value={profile?.rollNumber} />
              <InfoField icon={Award} label="CGPA" value={profile?.cgpa} />
            </div>
          </div>

          {/* Skills & Interests */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Skills & Interests</h3>
            {profile?.skills?.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {profile?.placementInterests?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Placement Interests</p>
                <div className="flex flex-wrap gap-2">
                  {profile.placementInterests.map((s, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {(!profile?.skills?.length && !profile?.placementInterests?.length) && (
              <p className="text-sm text-muted-foreground">No skills or interests added yet. Click "Update Profile" to add them.</p>
            )}
          </div>

          {/* Routine */}
          {(profile?.routine?.wakeUpTime || profile?.routine?.sleepTime) && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Daily Routine</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <InfoField icon={Clock} label="Wake Up Time" value={profile?.routine?.wakeUpTime} />
                <InfoField icon={Moon} label="Sleep Time" value={profile?.routine?.sleepTime} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── EDIT MODE ── */
        <>
          <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm space-y-1">
            <div className="flex items-center gap-2 mb-4">
              <Pencil size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Editing Profile</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditField label="Name" name="name" value={editProfile?.name || ''} onChange={handleChange} />
              <EditField label="Email" name="email" value={editProfile?.email || ''} onChange={handleChange} disabled />
              <EditField label="College" name="college" value={editProfile?.college || ''} onChange={handleChange} />
              <EditField label="Branch" name="branch" value={editProfile?.branch || ''} onChange={handleChange} />
              <EditField label="Semester" name="semester" type="number" value={editProfile?.semester || ''} onChange={handleChange} />
              <EditField label="Section" name="section" value={editProfile?.section || ''} onChange={handleChange} />
              <EditField label="Roll Number" name="rollNumber" value={editProfile?.rollNumber || ''} onChange={handleChange} />
              <EditField label="CGPA" name="cgpa" type="number" step="0.01" value={editProfile?.cgpa || ''} onChange={handleChange} />
              <EditField label="Skills (comma separated)" name="skills" value={editProfile?.skills?.join(', ') || ''} onChange={handleChange} placeholder="React, Node.js, Python" />
              <EditField label="Placement Interests (comma separated)" name="placementInterests" value={editProfile?.placementInterests?.join(', ') || ''} onChange={handleChange} placeholder="SDE, Data Science, Product" />
            </div>
          </div>

          <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Daily Routine</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditField label="Wake Up Time" name="routine.wakeUpTime" type="time" value={editProfile?.routine?.wakeUpTime || ''} onChange={handleChange} />
              <EditField label="Sleep Time" name="routine.sleepTime" type="time" value={editProfile?.routine?.sleepTime || ''} onChange={handleChange} />
            </div>
          </div>

          {/* Save / Cancel at bottom too */}
          <div className="flex justify-end gap-3">
            <button
              onClick={cancelEditing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X size={15} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save Profile
            </button>
          </div>
        </>
      )}
    </div>
  );
}
