// src/pages/Login.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap } from 'lucide-react';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Card */}
        <div className="bg-secondary/60 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl shadow-primary/10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
              <GraduationCap className="text-primary" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">CampusFlow <span className="text-primary">AI</span></h1>
            <p className="text-sm text-muted-foreground mt-1">Your student operations hub</p>
          </div>

          {/* Sign-in button */}
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="
              w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
              bg-white text-gray-700 font-medium text-sm
              hover:bg-gray-100 active:scale-95
              transition-all duration-150 shadow-md
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.6 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.7 20-21 0-1.4-.1-2.7-.4-4z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.9 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 45c5.2 0 10-1.9 13.6-5l-6.3-5.1C29.4 36.5 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-8H6.1v5.4C9.5 40.9 16.3 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.3 5.1C40.7 36.1 44 30.5 44 24c0-1.4-.1-2.7-.4-4z" />
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="text-xs text-center text-muted-foreground mt-6">
            By signing in you agree to our{' '}
            <span className="text-primary cursor-pointer hover:underline">Terms</span> &amp;{' '}
            <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
