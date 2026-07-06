import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';

// Groq API called via Vite proxy using env var to avoid CORS and secret leaks
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

async function askGroq(transactions, userQuery = null) {
  const txSummary = transactions.slice(0, 30).map(tx =>
    `- ${tx.name} | ${tx.category} | amount: ${tx.amount}`
  ).join('\n');

  const userPrompt = userQuery
    ? `User question: "${userQuery}"\n\nTransactions:\n${txSummary}`
    : `Analyze these transactions. Give key insights, top spending categories, anomalies, and 2-3 saving tips:\n\n${txSummary}`;

  // Using Vite proxy in dev (/groq-api → https://api.groq.com)
  const res = await fetch('/groq-api/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',

      messages: [
        { role: 'system', content: 'You are a friendly personal finance advisor. Be concise and practical. Max 150 words.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return text;
}

export default function ChatInsights({ projectId, transactions }) {
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: "Hi! I'm your AI budget assistant powered by Groq (llama3). Click 'Generate Insights' or ask me anything about your spending." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const addMsg = (role, text) =>
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, text }]);

  const run = async (userQuery = null) => {
    setLastError('');
    setLoading(true);
    try {
      const result = await askGroq(transactions, userQuery);
      addMsg('ai', result);
    } catch (err) {
      const msg = err.message || 'Unknown error';
      setLastError(msg);
      console.error('Groq error:', msg);
      addMsg('ai', `⚠️ AI error: ${msg}\n\nPlease check the console for details.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    addMsg('user', q);
    await run(q);
  };

  return (
    <div className="flex flex-col h-[500px] bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Budget Assistant
          <span className="text-[10px] font-normal text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Groq · llama3</span>
        </h3>
        <button
          onClick={() => run()}
          disabled={loading || transactions.length === 0}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : 'Generate Insights'}
        </button>
      </div>

      {/* Error banner */}
      {lastError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono break-all">{lastError}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-secondary-foreground rounded-tl-none'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-background">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your spending..."
            disabled={loading}
            className="w-full pl-4 pr-12 py-2.5 bg-secondary/50 border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
