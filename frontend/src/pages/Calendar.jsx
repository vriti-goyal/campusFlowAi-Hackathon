import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2, ExternalLink, Calendar as CalendarIcon, Clock, Type, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton, CFEmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Assignment', 'Exam', 'Placement', 'Event', 'Hostel', 'Transport', 'Personal'];

const getCategoryVariant = (cat) => {
  const map = {
    'Assignment': 'default',
    'Exam': 'high',
    'Placement': 'success',
    'Event': 'warning',
    'Hostel': 'medium',
    'Transport': 'default',
    'Personal': 'default'
  };
  return map[cat] || 'default';
};

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', category: 'Personal' });
  
  // Month Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState(null);

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
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <CFSkeleton lines={1} className="w-1/2 h-8" />
          <CFSkeleton card lines={5} className="h-64" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <CFSkeleton lines={1} className="w-1/3 h-8" />
          <CFSkeleton card lines={2} className="h-20" />
          <CFSkeleton card lines={2} className="h-20" />
        </div>
      </div>
    );
  }

  // Group events by date string (YYYY-MM-DD)
  const groupedEvents = events.reduce((acc, event) => {
    const eventDateStr = event.date.split('T')[0]; 
    if (!acc[eventDateStr]) acc[eventDateStr] = [];
    acc[eventDateStr].push(event);
    return acc;
  }, {});

  // For agenda view
  let filteredSortedDates = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));
  
  if (selectedDateFilter) {
    const pad = n => n.toString().padStart(2, '0');
    const filterStr = `${selectedDateFilter.getFullYear()}-${pad(selectedDateFilter.getMonth()+1)}-${pad(selectedDateFilter.getDate())}`;
    // if selected date has events, show only them, otherwise show empty
    filteredSortedDates = groupedEvents[filterStr] ? [filterStr] : [];
  }

  // Month Calendar logic
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // Determine if a calendar day has events
  const hasEventsOnDate = (day) => {
    const pad = n => n.toString().padStart(2, '0');
    const localDateStr = `${year}-${pad(month+1)}-${pad(day)}`;
    return groupedEvents[localDateStr]?.length > 0;
  };

  const isTodayDate = (day) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelectedDate = (day) => {
    if (!selectedDateFilter) return false;
    return selectedDateFilter.getDate() === day && selectedDateFilter.getMonth() === month && selectedDateFilter.getFullYear() === year;
  };

  const handleDayClick = (day) => {
    const selected = new Date(year, month, day);
    // toggle off if already selected
    if (selectedDateFilter && selected.getTime() === selectedDateFilter.getTime()) {
      setSelectedDateFilter(null);
    } else {
      setSelectedDateFilter(selected);
    }
  };

  return (
    <div className="max-w-6xl pb-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-[#6A68DF]" size={28} />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Calendar & Agenda</h2>
        </div>
        
        {selectedDateFilter && (
          <CFButton variant="ghost" size="sm" onClick={() => setSelectedDateFilter(null)} icon={X}>
            Clear Date Filter
          </CFButton>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Month Calendar + Add Event */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
          
          {/* Month Calendar Card */}
          <CFCard className="p-5 ring-1 ring-[#6A68DF]/10 shadow-lg shadow-[#6A68DF]/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)] text-lg">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--border)] text-[var(--text-secondary)] transition-colors"><ChevronLeft size={18}/></button>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--border)] text-[var(--text-secondary)] transition-colors"><ChevronRight size={18}/></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center">
              {blanks.map(b => <div key={`blank-${b}`} className="h-8"></div>)}
              {days.map(day => {
                const today = isTodayDate(day);
                const selected = isSelectedDate(day);
                const hasEvents = hasEventsOnDate(day);
                
                return (
                  <button 
                    key={day} 
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center text-sm relative transition-all duration-200",
                      selected ? "bg-[#6A68DF] text-white shadow-md shadow-[#6A68DF]/30 font-bold" 
                        : today ? "bg-[#6A68DF]/10 text-[#6A68DF] font-bold" 
                        : "text-[var(--text-primary)] hover:bg-[var(--border)]",
                    )}
                  >
                    <span>{day}</span>
                    {hasEvents && !selected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#EFB995]"></span>
                    )}
                    {hasEvents && selected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white/80"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </CFCard>

          {/* Add Event Form */}
          <CFCard className="p-5">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Plus size={20} className="text-[#6A68DF]" /> Add New Event
            </h3>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Type size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <input 
                    required 
                    type="text" 
                    placeholder="E.g., Team Meeting" 
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] transition-all text-[var(--text-primary)]"
                    value={newEvent.title} 
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">Date</label>
                  <div className="relative">
                    <input 
                      required 
                      type="date" 
                      className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] transition-all text-[var(--text-primary)]"
                      value={newEvent.date} 
                      onChange={e => setNewEvent({...newEvent, date: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">Time</label>
                  <div className="relative">
                    <input 
                      type="time" 
                      className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] transition-all text-[var(--text-primary)]"
                      value={newEvent.time} 
                      onChange={e => setNewEvent({...newEvent, time: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block uppercase tracking-wide">Category</label>
                <select 
                  className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] transition-all text-[var(--text-primary)]"
                  value={newEvent.category} 
                  onChange={e => setNewEvent({...newEvent, category: e.target.value})}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <CFButton 
                type="submit" 
                variant="primary" 
                loading={adding} 
                className="w-full py-2.5 mt-2"
                icon={Plus}
              >
                Save Event
              </CFButton>
            </form>
          </CFCard>
          
        </div>

        {/* Right Column: Agenda */}
        <div className="lg:col-span-2 space-y-8">
          {filteredSortedDates.length === 0 ? (
            <CFEmptyState 
              icon={CalendarIcon}
              title={selectedDateFilter ? "No events on this day" : "No upcoming events"}
              description={selectedDateFilter ? "You have a free day! Enjoy your time off." : "Your calendar is completely clear! Add an event to get started."}
            />
          ) : (
            filteredSortedDates.map(date => {
              const dateObj = new Date(date);
              const isToday = new Date().toDateString() === dateObj.toDateString();
              
              return (
                <div key={date} className="relative">
                  <div className="sticky top-16 z-10 bg-[var(--bg)]/95 backdrop-blur-md py-3 border-b border-[var(--border)] mb-4">
                    <h3 className={cn("font-bold text-lg flex items-center gap-3", isToday ? "text-[#6A68DF]" : "text-[var(--text-primary)]")}>
                      {dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      {isToday && (
                        <span className="text-[10px] bg-[#6A68DF] text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                          Today
                        </span>
                      )}
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    {groupedEvents[date].map(event => (
                      <CFCard key={event._id} className="flex items-center justify-between p-4 group hover:ring-1 hover:ring-[#6A68DF]/30 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
                          <span className="text-sm font-semibold w-20 shrink-0 flex items-center gap-1.5 text-[var(--text-primary)]">
                            <Clock size={14} className="text-[#6A68DF]" />
                            {event.time || 'All Day'}
                          </span>
                          
                          <CFBadge variant={getCategoryVariant(event.category)} className="w-fit">
                            {event.category}
                          </CFBadge>
                          
                          {['assignment', 'exam', 'placement'].includes(event.sourceType?.toLowerCase()) && event.sourceId ? (
                            <Link 
                              to={`/${event.sourceType.toLowerCase()}s?highlight=${event.sourceId}`} 
                              className="text-[var(--text-primary)] font-medium hover:text-[#6A68DF] hover:underline flex items-center gap-1.5 transition-colors flex-1"
                            >
                              {event.title}
                              <ExternalLink size={14} className="opacity-70" />
                            </Link>
                          ) : (
                            <span className="text-[var(--text-primary)] font-medium flex-1">{event.title}</span>
                          )}
                        </div>
                        
                        <CFButton 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(event._id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all px-2"
                        >
                          <Trash2 size={16} />
                        </CFButton>
                      </CFCard>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
