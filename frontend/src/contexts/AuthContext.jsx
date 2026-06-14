// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { setAuthToken, setupInterceptors } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // Firebase user object
  const [dbUser, setDbUser] = useState(null);    // MongoDB User document
  const [idToken, setIdToken] = useState(null);  // Raw ID token string
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDbUser = async () => {
    try {
      const res = await api.get('/api/users/me');
      setDbUser(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch DB user:', err.message);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setUser(firebaseUser);
        setIdToken(token);
        setAuthToken(token);
        setupInterceptors(toast);
        await fetchDbUser();
      } else {
        setUser(null);
        setDbUser(null);
        setIdToken(null);
        setAuthToken(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setDbUser(null);
    setIdToken(null);
    setAuthToken(null);
  };

  const refreshDbUser = () => fetchDbUser();

  return (
    <AuthContext.Provider value={{ user, dbUser, idToken, loading, signInWithGoogle, logout, refreshDbUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
