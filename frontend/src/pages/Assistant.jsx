import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User as UserIcon, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { CFButton, CFCard, CFBadge, CFSkeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  "What is due tomorrow?",
  "What should I focus on today?",
  "Am I eligible for any placement?",
  "Summarize my upcoming exams",
];

export default function AssistantPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const endOfMessagesRef = useRef(null);

  // Load chat history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/ai/history');
        setHistory(res.data || []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, asking]);

  const handleAsk = async (qText) => {
    if (!qText.trim()) return;

    // Optimistic update
    const optimistic = { question: qText, answer: null, sources: [] };
    setHistory((prev) => [...prev, optimistic]);
    setQuestion('');
    setAsking(true);

    try {
      const res = await api.post('/api/ai/ask', { question: qText });
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = res.data;
        return updated;
      });
    } catch (err) {
      console.error('AI ask error:', err);
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          answer: 'Sorry, I couldn\'t process that request. Please try again.',
          sources: [],
        };
        return updated;
      });
    } finally {
      setAsking(false);
    }
  };

  const handleDigest = async () => {
    setDigestLoading(true);
    try {
      const res = await api.post('/api/ai/daily-digest');
      setDigest(res.data.digestText);
    } catch (err) {
      console.error('Digest error:', err);
      setDigest('Unable to generate digest at this time.');
    } finally {
      setDigestLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleAsk(question);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto space-y-6">
        <CFSkeleton lines={1} className="w-48 h-8" />
        <div className="flex-1 space-y-6">
          <div className="flex justify-end"><CFSkeleton className="w-1/2 h-16 rounded-2xl rounded-tr-sm" /></div>
          <div className="flex justify-start"><CFSkeleton className="w-2/3 h-24 rounded-2xl rounded-tl-sm" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-4xl mx-auto pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6A68DF] to-[#EFB995] flex items-center justify-center shadow-md">
            <Bot className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">AI Assistant</h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium">Your personal campus guide</p>
          </div>
        </div>
        
        <CFButton
          onClick={handleDigest}
          disabled={digestLoading}
          loading={digestLoading}
          variant="secondary"
          size="sm"
          icon={Sparkles}
        >
          Daily Digest
        </CFButton>
      </div>

      {/* Digest card */}
      {digest && (
        <CFCard gradient className="mb-6 shrink-0 relative overflow-hidden group">
          <button 
            onClick={() => setDigest(null)}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-white animate-pulse" />
            <span className="font-bold text-white tracking-wide">Morning Digest</span>
          </div>
          <p className="text-sm text-white/90 whitespace-pre-line leading-relaxed font-medium">
            {digest}
          </p>
        </CFCard>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 scroll-smooth hide-scrollbar rounded-2xl">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#6A68DF]/10 flex items-center justify-center">
              <Bot size={40} className="text-[#6A68DF]" />
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">How can I help you today?</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                I have access to your assignments, exams, placements, and calendar. Ask me anything about your academics!
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4">
              {SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  onClick={() => handleAsk(sug)}
                  className="flex items-start text-left gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[#6A68DF]/50 hover:bg-[#6A68DF]/5 transition-all text-sm text-[var(--text-primary)] font-medium group"
                >
                  <MessageSquare size={16} className="text-[var(--text-muted)] group-hover:text-[#6A68DF] shrink-0 mt-0.5" />
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((chat, i) => (
            <div key={chat._id || i} className="space-y-6">
              {/* User Question */}
              <div className="flex items-start gap-3 justify-end group">
                <div className="bg-[#6A68DF] text-white px-5 py-3.5 rounded-3xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] shadow-sm">
                  <p className="text-sm font-medium leading-relaxed">{chat.question}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center shrink-0 shadow-inner">
                  <UserIcon size={14} className="text-gray-600 dark:text-gray-300" />
                </div>
              </div>

              {/* AI Answer */}
              <div className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6A68DF] to-[#EFB995] flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot size={14} className="text-white" />
                </div>
                
                <div className="bg-[var(--card)] border border-[var(--border)] px-5 py-4 rounded-3xl rounded-tl-sm max-w-[90%] sm:max-w-[80%] shadow-sm">
                  {chat.answer ? (
                    <div className="space-y-3 text-sm text-[var(--text-primary)] leading-relaxed">
                      <div className="whitespace-pre-wrap">{chat.answer}</div>
                      
                      {/* Source badges */}
                      {chat.sources && chat.sources.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-[var(--border)]">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] mb-2">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {chat.sources.map((src, idx) => (
                              <CFBadge key={idx} variant="default" className="text-[10px] gap-1 px-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6A68DF]" />
                                {src}
                              </CFBadge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Typing indicator */
                    <div className="flex items-center gap-1.5 h-6 px-2">
                      <span className="w-2 h-2 rounded-full bg-[#6A68DF] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#6A68DF] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[#6A68DF] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endOfMessagesRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="mt-4 shrink-0 bg-[var(--bg)] pt-4 border-t border-[var(--border)]">
        <form onSubmit={onSubmit} className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
            placeholder="Message CampusFlow AI..."
            className="w-full bg-[var(--card)] border border-[var(--border)] text-[var(--text-primary)] rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6A68DF]/30 focus:border-[#6A68DF] shadow-sm transition-all disabled:opacity-60 placeholder:text-[var(--text-muted)]"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="absolute right-2 w-10 h-10 flex items-center justify-center bg-[#6A68DF] text-white rounded-full hover:bg-[#5856D6] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md"
          >
            {asking ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
          </button>
        </form>
        <p className="text-[10px] text-center text-[var(--text-muted)] mt-2 font-medium">
          CampusFlow AI can make mistakes. Verify important deadlines.
        </p>
      </div>
    </div>
  );
}
