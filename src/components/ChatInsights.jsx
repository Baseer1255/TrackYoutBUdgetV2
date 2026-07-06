import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';

import { supabase } from '../lib/supabase';

// Local rule-based fallback (used only if Groq API call fails)
function generateLocalInsights(transactions, userQuery = null) {
  if (!transactions || transactions.length === 0) {
    return "You don't have any transactions yet. Add some expenses first so I can analyze your spending!";
  }

  const totalSpent = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const categoryTotals = transactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0];
  const hugeExpenses = transactions.filter(tx => Number(tx.amount) > (totalSpent * 0.3));

  if (userQuery) {
    const q = userQuery.toLowerCase();
    if (q.includes('total') || q.includes('spend') || q.includes('spent'))
      return `You have spent a total of **${totalSpent.toFixed(2)}** across ${transactions.length} transactions.`;
    if (q.includes('highest') || q.includes('most') || q.includes('top'))
      return `Your highest spending category is **${topCategory[0]}**, with **${topCategory[1].toFixed(2)}** spent.`;
    if (q.includes('food') || q.includes('groceries')) {
      const foodTotal = categoryTotals['Food'] || 0;
      return foodTotal > 0
        ? `You've spent **${foodTotal.toFixed(2)}** on Food. Consider meal prepping to lower this! 😉`
        : `You haven't spent anything on Food yet.`;
    }
    if (q.includes('save') || q.includes('tip') || q.includes('advice'))
      return `💡 **Tip:** Limit your spending on **${topCategory[0]}** (currently ${topCategory[1].toFixed(2)}) — that's your biggest expense.`;
  }

  let report = `📊 **Spending Analysis:**\n\n`;
  report += `• **Total Spent:** ${totalSpent.toFixed(2)}\n`;
  report += `• **Top Category:** ${topCategory[0]} (${topCategory[1].toFixed(2)})\n`;
  if (hugeExpenses.length > 0)
    report += `• **Large Expense:** ${hugeExpenses[0].amount} on "${hugeExpenses[0].name}"\n`;
  report += `\n💡 Try setting a weekly limit for ${topCategory[0]} to boost your savings.`;
  return report;
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
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: {
          projectId,
          action: 'analyze',
          transactions,
          userQuery,
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || 'Edge Function error');
      }

      addMsg('ai', data.insight);
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
