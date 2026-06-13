// src/pages/Profile.jsx
import { useAuth } from '@/contexts/AuthContext';
import { UserCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <UserCircle className="text-primary" size={22} />
        <h2 className="text-xl font-bold text-foreground">Profile</h2>
      </div>

      <div className="bg-secondary border border-border rounded-xl p-6 flex items-center gap-5">
        <img
          src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'U')}&size=80`}
          alt="Profile"
          className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/40"
        />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{user?.displayName || '—'}</p>
          <p className="text-sm text-muted-foreground">{user?.email || '—'}</p>
          <p className="text-xs text-muted-foreground/60">UID: {user?.uid || '—'}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Additional profile settings and preferences will appear here.
      </p>
    </div>
  );
}
