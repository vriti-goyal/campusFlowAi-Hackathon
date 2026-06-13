import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';

const CATEGORIES = ['Assignment', 'Exam', 'Placement', 'Event', 'Hostel', 'Transport', 'Personal'];

const getCategoryColor = (cat) => {
  const map = {
    'Assignment': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Exam': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Placement': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Event': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Hostel': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Transport': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    'Personal': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  };
  return map[cat] || map['Personal'];
};

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', category: 'Personal' });

  const fetchEvents = async () => {
    try {
      const res = await api.get('/api/calendar/events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/api/calendar/events', newEvent);
      setNewEvent({ title: '', date: '', time: '', category: 'Personal' });
      fetchEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to add event');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('Delete this event?')) return;
    try {
      await api.delete(`/api/calendar/events/${id}`);
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      <div className="flex items-center gap-3">
        <CalendarDays className="text-primary" size={26} />
        <h2 className="text-2xl font-bold text-foreground">Agenda</h2>
      </div>

      {/* Add Event Form */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus size={16}/> Add Event</h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3">
          <input required type="text" placeholder="Event Title" className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
          <input required type="date" className="px-3 py-2 bg-background border border-border rounded-md text-sm" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
          <input type="time" className="px-3 py-2 bg-background border border-border rounded-md text-sm" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
          <select className="px-3 py-2 bg-background border border-border rounded-md text-sm" value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button disabled={adding} type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center justify-center disabled:opacity-50 min-w-[80px]">
            {adding ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
          </button>
        </form>
      </div>

      {/* Agenda List */}
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">No upcoming events.</p>
        ) : (
          sortedDates.map(date => {
            const dateObj = new Date(date);
            const isToday = new Date().toDateString() === dateObj.toDateString();
            
            return (
              <div key={date} className="relative">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b border-border mb-3">
                  <h3 className={`font-semibold text-lg flex items-center gap-2 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    {isToday && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Today</span>}
                  </h3>
                </div>
                
                <div className="space-y-2">
                  {groupedEvents[date].map(event => (
                    <div key={event._id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow group">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
                        <span className="text-sm font-medium w-14 text-muted-foreground">{event.time || 'All Day'}</span>
                        <div className={`px-2 py-1 rounded text-xs font-semibold ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </div>
                        {['assignment', 'exam', 'placement'].includes(event.sourceType?.toLowerCase()) && event.sourceId ? (
                          <Link 
                            to={`/${event.sourceType.toLowerCase()}s?highlight=${event.sourceId}`} 
                            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {event.title}
                            <ExternalLink size={12} className="opacity-70" />
                          </Link>
                        ) : (
                          <span className="text-sm font-medium">{event.title}</span>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(event._id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
