import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Loader2, Pencil, X, Building2, BookOpen, Hash, Award, Clock, Moon, CheckCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton } from '@/components/ui';

// ── Read-only field display ──
function InfoField({ icon: Icon, label, value }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(', ') : value;
  return (
    <div className="flex items-start gap-4 py-4 border-b border-[var(--border)] last:border-b-0">
      {Icon && <div className="w-8 h-8 rounded-full bg-[#6A68DF]/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[#6A68DF]" />
      </div>}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-medium text-[var(--text-primary)]">{display}</p>
      </div>
    </div>
  );
}

// ── Editable input ──
function EditField({ label, name, type = 'text', value, onChange, placeholder, disabled, step }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        className={`w-full px-4 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-sm transition-all focus:border-[#6A68DF] focus:ring-2 focus:ring-[#6A68DF]/20 outline-none
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'text-[var(--text-primary)]'}`}
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
  const [editProfile, setEditProfile] = useState(null);
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
    setEditProfile(JSON.parse(JSON.stringify(profile)));
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
      <div className="space-y-6 max-w-4xl pb-10">
        <div className="flex items-center gap-6 mb-8">
          <CFSkeleton className="w-24 h-24 rounded-full" />
          <div className="space-y-2 flex-1">
            <CFSkeleton lines={1} className="w-1/3 h-8" />
            <CFSkeleton lines={1} className="w-1/4 h-4" />
          </div>
        </div>
        <CFSkeleton card lines={6} className="h-64" />
        <CFSkeleton card lines={4} className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <img
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'U')}&background=6A68DF&color=fff&bold=true`}
              alt="avatar"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white dark:border-[var(--card)] shadow-lg ring-2 ring-[#6A68DF]/30"
            />
            {profile?.profileComplete && (
              <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-[var(--card)] flex items-center justify-center shadow-sm" title="Profile Complete">
                <CheckCircle size={14} className="text-white" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight">{profile?.name || 'Student'}</h2>
            <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">{profile?.email}</p>
          </div>
        </div>

        {!editing ? (
          <CFButton
            onClick={startEditing}
            variant="secondary"
            icon={Pencil}
          >
            Update Profile
          </CFButton>
        ) : (
          <div className="flex gap-3">
            <CFButton
              onClick={cancelEditing}
              variant="ghost"
              icon={X}
            >
              Cancel
            </CFButton>
            <CFButton
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="primary"
              icon={Save}
            >
              Save Profile
            </CFButton>
          </div>
        )}
      </div>

      {/* ── Success / Error message ── */}
      {saveMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          saveMsg.type === 'success'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {saveMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {saveMsg.text}
        </div>
      )}

      {/* ── VIEW MODE ── */}
      {!editing ? (
        <div className="space-y-6">
          {/* Academic Info */}
          <CFCard className="p-6 sm:p-8">
            <h3 className="text-sm font-bold text-[#6A68DF] uppercase tracking-wider mb-6 flex items-center gap-2">
              <BookOpen size={18} /> Academic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
              <InfoField icon={Building2} label="College" value={profile?.college} />
              <InfoField icon={BookOpen} label="Branch" value={profile?.branch} />
              <InfoField icon={Hash} label="Semester" value={profile?.semester} />
              <InfoField icon={Hash} label="Section" value={profile?.section} />
              <InfoField icon={Hash} label="Roll Number" value={profile?.rollNumber} />
              <InfoField icon={Award} label="CGPA" value={profile?.cgpa} />
            </div>
          </CFCard>

          {/* Skills & Interests */}
          <CFCard className="p-6 sm:p-8">
            <h3 className="text-sm font-bold text-[#6A68DF] uppercase tracking-wider mb-6 flex items-center gap-2">
              <Award size={18} /> Skills & Interests
            </h3>
            
            <div className="space-y-6">
              {profile?.skills?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Technical Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((s, i) => (
                      <CFBadge key={i} variant="default" className="text-xs px-3 py-1.5">{s}</CFBadge>
                    ))}
                  </div>
                </div>
              )}
              
              {profile?.placementInterests?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Placement Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.placementInterests.map((s, i) => (
                      <CFBadge key={i} variant="medium" className="text-xs px-3 py-1.5 bg-[#EFB995]/20 text-[#D98755] dark:text-[#EFB995] border border-[#EFB995]/30">{s}</CFBadge>
                    ))}
                  </div>
                </div>
              )}
              
              {(!profile?.skills?.length && !profile?.placementInterests?.length) && (
                <div className="bg-[var(--bg)] border border-[var(--border)] border-dashed rounded-xl p-6 text-center">
                  <p className="text-sm text-[var(--text-muted)] font-medium">No skills or interests added yet. Click "Update Profile" to add them.</p>
                </div>
              )}
            </div>
          </CFCard>

          {/* Routine */}
          {(profile?.routine?.wakeUpTime || profile?.routine?.sleepTime) && (
            <CFCard className="p-6 sm:p-8">
              <h3 className="text-sm font-bold text-[#6A68DF] uppercase tracking-wider mb-6 flex items-center gap-2">
                <Clock size={18} /> Daily Routine
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
                <InfoField icon={Clock} label="Wake Up Time" value={profile?.routine?.wakeUpTime} />
                <InfoField icon={Moon} label="Sleep Time" value={profile?.routine?.sleepTime} />
              </div>
            </CFCard>
          )}
        </div>
      ) : (
        /* ── EDIT MODE ── */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CFCard className="p-6 sm:p-8 border-[#6A68DF]/30 ring-1 ring-[#6A68DF]/10 shadow-lg shadow-[#6A68DF]/5">
            <div className="flex items-center gap-2 mb-8 pb-4 border-b border-[var(--border)]">
              <div className="w-8 h-8 rounded-full bg-[#6A68DF] flex items-center justify-center">
                <Pencil size={16} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Edit Profile</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditField label="Full Name" name="name" value={editProfile?.name || ''} onChange={handleChange} />
              <EditField label="Email Address" name="email" value={editProfile?.email || ''} onChange={handleChange} disabled />
              
              <div className="md:col-span-2 pt-4">
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4">Academic Details</h4>
              </div>
              
              <EditField label="College" name="college" value={editProfile?.college || ''} onChange={handleChange} />
              <EditField label="Branch" name="branch" value={editProfile?.branch || ''} onChange={handleChange} />
              <EditField label="Semester" name="semester" type="number" value={editProfile?.semester || ''} onChange={handleChange} />
              <EditField label="Section" name="section" value={editProfile?.section || ''} onChange={handleChange} />
              <EditField label="Roll Number" name="rollNumber" value={editProfile?.rollNumber || ''} onChange={handleChange} />
              <EditField label="CGPA" name="cgpa" type="number" step="0.01" value={editProfile?.cgpa || ''} onChange={handleChange} />
              
              <div className="md:col-span-2 pt-4">
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4">Skills & Interests</h4>
              </div>
              
              <div className="md:col-span-2">
                <EditField label="Skills (comma separated)" name="skills" value={editProfile?.skills?.join(', ') || ''} onChange={handleChange} placeholder="e.g., React, Node.js, Python" />
              </div>
              <div className="md:col-span-2">
                <EditField label="Placement Interests (comma separated)" name="placementInterests" value={editProfile?.placementInterests?.join(', ') || ''} onChange={handleChange} placeholder="e.g., SDE, Data Science, Product Management" />
              </div>
            </div>
          </CFCard>

          <CFCard className="p-6 sm:p-8 border-[#6A68DF]/30 ring-1 ring-[#6A68DF]/10 shadow-lg shadow-[#6A68DF]/5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-6">Daily Routine</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditField label="Wake Up Time" name="routine.wakeUpTime" type="time" value={editProfile?.routine?.wakeUpTime || ''} onChange={handleChange} />
              <EditField label="Sleep Time" name="routine.sleepTime" type="time" value={editProfile?.routine?.sleepTime || ''} onChange={handleChange} />
            </div>
          </CFCard>

          {/* Save / Cancel at bottom too */}
          <div className="flex justify-end gap-3 sticky bottom-4 bg-[var(--bg)]/90 backdrop-blur-md p-4 rounded-2xl border border-[var(--border)] shadow-lg z-10">
            <CFButton
              onClick={cancelEditing}
              variant="ghost"
              icon={X}
            >
              Cancel
            </CFButton>
            <CFButton
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="primary"
              icon={Save}
            >
              Save Profile
            </CFButton>
          </div>
        </div>
      )}
    </div>
  );
}
