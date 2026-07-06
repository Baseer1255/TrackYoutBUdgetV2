import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Local rule-based fallback (used only if Edge Function fails)
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
    if (q.includes('total') || q.includes('spend') || q.includes('spent')) {
      return `You have spent a total of **${totalSpent.toFixed(2)}** across ${transactions.length} transactions.`;
    }
    if (q.includes('highest') || q.includes('most') || q.includes('top')) {
      return `Your highest spending category is **${topCategory[0]}**, where you've spent **${topCategory[1].toFixed(2)}** so far.`;
    }
    if (q.includes('food') || q.includes('groceries')) {
      const foodTotal = categoryTotals['Food'] || 0;
      return foodTotal > 0
        ? `You've spent **${foodTotal.toFixed(2)}** on Food. Consider meal prepping to lower this! 😉`
        : `You haven't spent anything categorized as Food yet.`;
    }
    if (q.includes('save') || q.includes('tip') || q.includes('advice')) {
      return `💡 **Quick Tip:** Try to limit your spending on **${topCategory[0]}**, since that's your biggest expense right now (${topCategory[1].toFixed(2)}).`;
    }
    return `Based on your ${transactions.length} transactions, your top expense is **${topCategory[0]}**. Ask me about a specific category for more detail!`;
  }

  let report = `📊 **Spending Analysis:**\n\n`;
  report += `• **Total Spent:** ${totalSpent.toFixed(2)}\n`;
  report += `• **Top Category:** ${topCategory[0]} (${topCategory[1].toFixed(2)})\n`;
  if (hugeExpenses.length > 0) {
    report += `• **Large Expense:** You spent ${hugeExpenses[0].amount} on "${hugeExpenses[0].name}" — a significant portion of your total.\n`;
  }
  report += `\n💡 **Tip:** Try setting a weekly limit for ${topCategory[0]} to boost your savings.`;
  return report;
}

export default function ChatInsights({ projectId, transactions }) {
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: "Hello! I'm your AI budget assistant powered by Groq. Click 'Generate Insights' or ask me a question about your spending." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addAiMessage = (text) =>
    setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text }]);

  const addUserMessage = (text) =>
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text }]);

  // Call the Groq-powered Edge Function, with local fallback on error
  const callAI = async (userQuery = null) => {
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

      setUsingFallback(false);
      return data.insight;
    } catch (err) {
      console.warn('AI Edge Function failed, using local fallback:', err.message);
      setUsingFallback(true);
      return generateLocalInsights(transactions, userQuery);
    }
  };

  const generateInsights = async () => {
    if (loading || transactions.length === 0) return;
    setLoading(true);
    const insight = await callAI();
    addAiMessage(insight);
    setLoading(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    addUserMessage(userMsg);

    setLoading(true);
    const answer = await callAI(userMsg);
    addAiMessage(answer);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[500px] bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Budget Assistant
          {usingFallback && (
            <span className="flex items-center gap-1 text-xs text-yellow-500 font-normal">
              <WifiOff className="w-3 h-3" /> (local mode)
            </span>
          )}
        </h3>
        <button
          onClick={generateInsights}
          disabled={loading || transactions.length === 0}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : 'Generate Insights'}
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-secondary-foreground rounded-tl-none whitespace-pre-wrap'}`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border bg-background">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask 'What did I spend the most on?'..."
            disabled={loading}
            className="w-full pl-4 pr-12 py-2.5 bg-secondary/50 border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
