import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, CheckCircle2 } from 'lucide-react';
import { CFButton, CFCard, CFBadge } from '@/components/ui';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  const features = [
    "AI-powered campus updates",
    "Smart assignment tracking",
    "Personalized placement intel"
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg)] transition-colors duration-200">
      {/* Left Half - Gradient Banner */}
      <div 
        className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center text-white min-h-[300px] md:min-h-screen"
        style={{ background: 'linear-gradient(135deg, #6A68DF 0%, #B78AEF 45%, #EFB995 100%)' }}
      >
        <div className="max-w-md mx-auto md:mx-0">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-10 h-10 text-white" />
            <h1 className="text-4xl font-bold tracking-tight">CampusFlow AI</h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold mb-8 opacity-90 leading-snug">
            One platform.<br/>Every update.<br/>Every deadline.
          </h2>
          
          <ul className="space-y-4">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-lg opacity-90">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right Half - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 bg-[var(--bg)]">
        <CFCard className="w-full max-w-md p-8 md:p-10 border-none shadow-2xl shadow-black/5 dark:shadow-black/20">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#6A68DF]/20 to-[#EFB995]/20 flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-[#6A68DF]" />
            </div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Welcome back</h3>
            <p className="text-[var(--text-secondary)] mb-4">Sign in to your student hub</p>
            <CFBadge variant="default" className="text-xs font-semibold py-1">Powered by AI</CFBadge>
          </div>

          <CFButton
            variant="secondary"
            className="w-full py-3 flex items-center justify-center gap-3 bg-[var(--card)] hover:bg-[var(--bg)]"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.6 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.7 20-21 0-1.4-.1-2.7-.4-4z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.9 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 45c5.2 0 10-1.9 13.6-5l-6.3-5.1C29.4 36.5 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-8H6.1v5.4C9.5 40.9 16.3 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.3 5.1C40.7 36.1 44 30.5 44 24c0-1.4-.1-2.7-.4-4z" />
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </CFButton>
          
          <p className="text-xs text-center text-[var(--text-muted)] mt-8">
            By signing in you agree to our{' '}
            <span className="text-[#6A68DF] cursor-pointer hover:underline">Terms</span> &amp;{' '}
            <span className="text-[#6A68DF] cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </CFCard>
      </div>
    </div>
  );
}
