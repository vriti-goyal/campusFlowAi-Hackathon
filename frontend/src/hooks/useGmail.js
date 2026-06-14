import { useState, useEffect } from 'react';
import api from '@/lib/api';

export function useGmail() {
  const [status, setStatus] = useState({
    connected: false,
    email: null,
    lastSync: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/gmail/status');
      setStatus(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const connect = async () => {
    try {
      const res = await api.get('/api/gmail/auth-url');
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const sync = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/api/gmail/sync');
      await fetchStatus(); // refresh last sync time
      return res.data; // { processed, added, skipped, errors }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setSyncing(false);
    }
  };

  return {
    ...status,
    loading,
    syncing,
    error,
    connect,
    sync,
    fetchStatus
  };
}
