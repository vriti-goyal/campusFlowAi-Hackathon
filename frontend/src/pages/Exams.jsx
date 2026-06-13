import { useEffect, useState } from 'react';
import { BookOpen, MapPin, Clock, Loader2, BookMarked } from 'lucide-react';
import api from '@/lib/api';

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/exams', { params: { batchId: 'default-batch' } });
        setExams(res.data.data || []);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!exams.length) {
    return (
      <div className="text-center py-16 space-y-3">
        <BookOpen className="mx-auto text-muted-foreground" size={48} />
        <h2 className="text-xl font-bold text-foreground">No Exams Yet</h2>
        <p className="text-muted-foreground text-sm">Upload an exam notice to populate this hub.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Exam Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Upcoming exams sorted by date</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => {
          const daysLeft = Math.max(0, Math.ceil((new Date(exam.date) - new Date()) / (1000 * 60 * 60 * 24)));
          return (
            <div key={exam._id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-foreground">{exam.subject}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  daysLeft <= 3 ? 'bg-red-100 text-red-700' : daysLeft <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                }`}>
                  {daysLeft === 0 ? 'Today!' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{new Date(exam.date).toLocaleDateString()}{exam.time ? ` • ${exam.time}` : ''}</span>
                </div>
                {exam.venue && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{exam.venue}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => alert('Study plan feature coming in Phase 2!')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full justify-center"
              >
                <BookMarked size={14} /> Add Study Plan
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
