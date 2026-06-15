import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, User, BookOpen, Briefcase, Heart,
  ChevronRight, ChevronLeft, Check, Loader2, Tag, X
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Academic', icon: BookOpen },
  { id: 3, label: 'Placement', icon: Briefcase },
  { id: 4, label: 'Interests', icon: Heart },
];

const BRANCHES = [
  'Computer Science', 'Information Technology', 'Electronics & Communication',
  'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering',
  'Chemical Engineering', 'Biotechnology', 'Other',
];

function TagInput({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState('');

  const addTag = (raw) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
  };

  const removeTag = (t) => onChange(value.filter((v) => v !== t));

  return (
    <div className="min-h-[44px] flex flex-wrap gap-2 px-3 py-2 bg-[var(--card)] border border-black/10 dark:border-white/10 rounded-xl focus-within:border-[#6A68DF] transition-colors">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-[#6A68DF]/15 text-[#6A68DF] text-xs px-2 py-1 rounded-full">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-[var(--text-primary)]">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => input && addTag(input)}
        placeholder={value.length === 0 ? placeholder : 'Add more...'}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
      />
    </div>
  );
}

const inputClass =
  'w-full px-4 py-3 bg-[var(--card)] border border-black/10 dark:border-white/10 rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#6A68DF] transition-colors';
const labelClass = 'block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5';
const errorClass = 'text-xs text-red-500 mt-1';

export default function ProfileSetupPage({ onComplete }) {
  const navigate = useNavigate();
  const { refreshDbUser } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    college: '',
    branch: '',
    currentYear: '',
    semester: '',
    section: '',
    rollNumber: '',
    cgpa: '',
    backlogs: '0',
    tnpEmail: '',
    skills: [],
    interests: [],
  });

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.name.trim()) e.name = 'Full name is required';
      if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone number is required';
      else if (!/^\d{10}$/.test(form.phoneNumber.replace(/\s/g, '')))
        e.phoneNumber = 'Enter a valid 10-digit phone number';
    }
    if (step === 2) {
      if (!form.college.trim()) e.college = 'College is required';
      if (!form.branch) e.branch = 'Branch is required';
      if (!form.currentYear) e.currentYear = 'Current year is required';
    }
    if (step === 3) {
      if (form.cgpa !== '') {
        const cgpa = parseFloat(form.cgpa);
        if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) e.cgpa = 'CGPA must be between 0.0 and 10.0';
      } else {
        e.cgpa = 'CGPA is required';
      }
      const backlogs = parseInt(form.backlogs, 10);
      if (isNaN(backlogs) || backlogs < 0) e.backlogs = 'Backlogs must be 0 or more';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) setStep((s) => s + 1);
  };

  const prev = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const currentYear = parseInt(form.currentYear, 10);
      const graduationYear = new Date().getFullYear() + (4 - currentYear);

      const payload = {
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim(),
        college: form.college.trim(),
        branch: form.branch,
        currentYear,
        graduationYear,
        semester: form.semester ? parseInt(form.semester, 10) : currentYear * 2,
        section: form.section.trim(),
        rollNumber: form.rollNumber.trim(),
        cgpa: parseFloat(form.cgpa),
        backlogs: parseInt(form.backlogs, 10),
        tnpEmail: form.tnpEmail.trim(),
        skills: form.skills,
        interests: form.interests,
      };

      await api.patch('/api/users/me/complete-profile', payload);
      await refreshDbUser();
      if (onComplete) onComplete();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.';
      setErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] relative overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#6A68DF]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#EFB995]/20 blur-[120px]" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#6A68DF]/20 to-[#EFB995]/20 flex items-center justify-center mb-4">
            <Zap className="text-[#6A68DF]" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Set Up Your Profile</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Complete your profile to unlock all features</p>
        </div>

        <div className="flex items-center justify-between mb-6 px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`relative flex flex-col items-center gap-1 ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    done
                      ? 'bg-[#6A68DF] text-white'
                      : active
                        ? 'bg-[#6A68DF]/15 border-2 border-[#6A68DF] text-[#6A68DF]'
                        : 'bg-[var(--card)] border border-black/10 dark:border-white/10 text-[var(--text-muted)]'
                  }`}>
                    {done ? <Check size={16} /> : <Icon size={15} />}
                  </div>
                  <span className={`text-[10px] font-medium ${
                    active
                      ? 'text-[#6A68DF]'
                      : done
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-muted)]'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 rounded-full transition-all duration-500 mb-5 ${
                    step > s.id ? 'bg-[#6A68DF]' : 'bg-black/10 dark:bg-white/10'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-[var(--card)] backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl p-7 shadow-2xl shadow-black/5 dark:shadow-black/20">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Personal Information</h2>
              <div>
                <label className={labelClass}>Full Name *</label>
                <input
                  id="setup-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Arjun Sharma"
                  className={inputClass}
                />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>
              <div>
                <label className={labelClass}>Phone Number *</label>
                <input
                  id="setup-phone"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => set('phoneNumber', e.target.value)}
                  placeholder="10-digit mobile number"
                  className={inputClass}
                />
                {errors.phoneNumber && <p className={errorClass}>{errors.phoneNumber}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Academic Details</h2>
              <div>
                <label className={labelClass}>College *</label>
                <input
                  id="setup-college"
                  type="text"
                  value={form.college}
                  onChange={(e) => set('college', e.target.value)}
                  placeholder="e.g. IIT Delhi"
                  className={inputClass}
                />
                {errors.college && <p className={errorClass}>{errors.college}</p>}
              </div>
              <div>
                <label className={labelClass}>Branch *</label>
                <select
                  id="setup-branch"
                  value={form.branch}
                  onChange={(e) => set('branch', e.target.value)}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="">Select your branch</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                {errors.branch && <p className={errorClass}>{errors.branch}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Current Year *</label>
                  <select
                    id="setup-year"
                    value={form.currentYear}
                    onChange={(e) => set('currentYear', e.target.value)}
                    className={`${inputClass} appearance-none cursor-pointer`}
                  >
                    <option value="">Year</option>
                    {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                  {errors.currentYear && <p className={errorClass}>{errors.currentYear}</p>}
                </div>
                <div>
                  <label className={labelClass}>Semester</label>
                  <select
                    id="setup-semester"
                    value={form.semester}
                    onChange={(e) => set('semester', e.target.value)}
                    className={`${inputClass} appearance-none cursor-pointer`}
                  >
                    <option value="">Semester</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Section</label>
                  <input
                    id="setup-section"
                    type="text"
                    value={form.section}
                    onChange={(e) => set('section', e.target.value)}
                    placeholder="e.g. A"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Roll Number</label>
                  <input
                    id="setup-roll"
                    type="text"
                    value={form.rollNumber}
                    onChange={(e) => set('rollNumber', e.target.value)}
                    placeholder="e.g. 2021CS001"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Placement Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>CGPA *</label>
                  <input
                    id="setup-cgpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={form.cgpa}
                    onChange={(e) => set('cgpa', e.target.value)}
                    placeholder="e.g. 8.5"
                    className={inputClass}
                  />
                  {errors.cgpa && <p className={errorClass}>{errors.cgpa}</p>}
                </div>
                <div>
                  <label className={labelClass}>Active Backlogs *</label>
                  <input
                    id="setup-backlogs"
                    type="number"
                    min="0"
                    value={form.backlogs}
                    onChange={(e) => set('backlogs', e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                  {errors.backlogs && <p className={errorClass}>{errors.backlogs}</p>}
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  TNP Email ID <span className="text-[var(--text-muted)] font-normal normal-case">(optional)</span>
                </label>
                <input
                  id="setup-tnp-email"
                  type="email"
                  value={form.tnpEmail}
                  onChange={(e) => set('tnpEmail', e.target.value)}
                  placeholder="training@college.edu"
                  className={inputClass}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1.5">Your college TNP cell email for placement notices</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Skills &amp; Interests</h2>
              <div>
                <label className={labelClass}>
                  <Tag size={12} className="inline mr-1" />Skills
                </label>
                <TagInput
                  value={form.skills}
                  onChange={(v) => set('skills', v)}
                  placeholder="Type a skill and press Enter..."
                />
                <p className="text-xs text-[var(--text-muted)] mt-1.5">e.g. Python, React, Machine Learning</p>
              </div>
              <div>
                <label className={labelClass}>
                  <Heart size={12} className="inline mr-1" />Interests
                </label>
                <TagInput
                  value={form.interests}
                  onChange={(v) => set('interests', v)}
                  placeholder="Type an interest and press Enter..."
                />
                <p className="text-xs text-[var(--text-muted)] mt-1.5">e.g. Web Development, Open Source, DSA</p>
              </div>
              {errors.submit && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400">
                  {errors.submit}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                type="button"
                onClick={prev}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-[var(--text-secondary)] text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <button
              type="button"
              onClick={step < STEPS.length ? next : handleSubmit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #6A68DF 0%, #B78AEF 45%, #EFB995 100%)' }}
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : step < STEPS.length ? (
                <>Continue <ChevronRight size={16} /></>
              ) : (
                <><Check size={16} /> Complete Setup</>
              )}
            </button>
          </div>

          {step === 1 && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-4">
              You can always update these later from your Profile page
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
