import { useState, useEffect, useRef } from 'react';
import { Bot, Send, User as UserIcon, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const SUGGESTIONS = [
  "What is due tomorrow?",
  "What should I focus on today?",
  "Am I eligible for any placement?"
];

export default function AssistantPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/ai/history');
        setHistory(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, asking]);

  const handleAsk = async (qText) => {
    if (!qText.trim()) return;
    
    const newChat = { question: qText, answer: null }; // optimistic
    setHistory(prev => [...prev, newChat]);
    setQuestion('');
    setAsking(true);

    try {
      const res = await api.post('/api/ai/ask', { question: qText });
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = res.data;
        return updated;
      });
    } catch (err) {
      console.error(err);
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1].answer = "[Error] Failed to connect to AI Assistant.";
        return updated;
      });
    } finally {
      setAsking(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleAsk(question);
  };

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <Bot className="text-primary" size={26} />
        <h2 className="text-2xl font-bold text-foreground">AI Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <Bot size={48} className="text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">How can I help you today?</h3>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map(sug => (
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
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed space-y-3">
                      {chat.answer}
                      {chat.sources && chat.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Sources:</p>
                          <div className="flex flex-wrap gap-1">
                            {chat.sources.map((src, idx) => (
                              <span key={idx} className="bg-background text-xs px-2 py-1 rounded-md border border-border/50 text-muted-foreground">
                                {src}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 h-5">
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

      <div className="mt-4 shrink-0 bg-background pt-2">
        <form onSubmit={onSubmit} className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={asking}
            placeholder="Ask your campus assistant..."
            className="w-full bg-secondary border border-border rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
