import { useState, useEffect, useRef } from 'react';
import { Bot, Send, User as UserIcon, Loader2, Sparkles } from 'lucide-react';
import api from '@/lib/api';

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

    // Optimistic update — show user message with typing indicator
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
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Bot className="text-primary" size={26} />
          <h2 className="text-2xl font-bold text-foreground">AI Assistant</h2>
        </div>
        <button
          onClick={handleDigest}
          disabled={digestLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {digestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Daily Digest
        </button>
      </div>

      {/* Digest card */}
      {digest && (
        <div className="mb-4 shrink-0 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-primary" />
            <span className="text-sm font-semibold text-primary">Morning Digest</span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{digest}</p>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <Bot size={48} className="text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">How can I help you today?</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              I have access to your assignments, exams, placements, and calendar. Ask me anything about your academics!
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  onClick={() => handleAsk(sug)}
                  className="bg-secondary/50 hover:bg-secondary text-secondary-foreground text-sm px-4 py-2 rounded-full transition-colors border border-border"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((chat, i) => (
            <div key={chat._id || i} className="space-y-4">
              {/* User Question */}
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm">
                  <p className="text-sm">{chat.question}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <UserIcon size={16} className="text-muted-foreground" />
                </div>
              </div>

              {/* AI Answer */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-primary" />
                </div>
                <div className="bg-secondary/60 border border-border px-4 py-3 rounded-2xl rounded-tl-sm max-w-[80%] shadow-sm">
                  {chat.answer ? (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {chat.answer}
                      </p>
                      {/* Source badges */}
                      {chat.sources && chat.sources.length > 0 && (
                        <div className="pt-2 border-t border-border/50">
                          <div className="flex flex-wrap gap-1.5">
                            {chat.sources.map((src, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Typing indicator */
                    <div className="flex items-center gap-1.5 h-5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input */}
      <div className="mt-4 shrink-0 bg-background pt-2">
        <form onSubmit={onSubmit} className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
            placeholder="Ask your campus assistant..."
            className="w-full bg-secondary border border-border rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
