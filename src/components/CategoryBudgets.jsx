import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart, Plus, Loader2, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['General', 'Food', 'Transport', 'Housing', 'Entertainment', 'Utilities'];

export default function CategoryBudgets({ projectId, transactions, projectCurrency = '$' }) {
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newLimit, setNewLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      
      const budgetMap = {};
      data.forEach(b => {
        budgetMap[b.category] = Number(b.budget_limit);
      });
      setBudgets(budgetMap);
    } catch (err) {
      console.error('Error fetching category budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [projectId]);

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!newCategory || !newLimit) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('category_budgets')
        .upsert([{
          project_id: projectId,
          category: newCategory,
          budget_limit: Number(newLimit)
        }]);

      if (error) throw error;
      
      setShowAddForm(false);
      setNewLimit('');
      fetchBudgets();
    } catch (err) {
      console.error('Error saving category budget:', err);
      alert('Failed to save budget limit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveBudget = async (categoryToRemove) => {
    try {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .match({ project_id: projectId, category: categoryToRemove });

      if (error) throw error;
      fetchBudgets();
    } catch (err) {
      console.error('Error removing budget:', err);
    }
  };

  // Calculate actual spend per category
  const categorySpend = {};
  transactions.forEach(tx => {
    if (tx.amount) {
      categorySpend[tx.category] = (categorySpend[tx.category] || 0) + Number(tx.amount);
    }
  });

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center bg-card rounded-xl border border-border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Get categories that have a budget set
  const activeCategories = Object.keys(budgets);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <PieChart className="w-5 h-5 text-primary" />
          Category Limits
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {showAddForm && (
          <form onSubmit={handleSaveBudget} className="p-3 rounded-lg bg-secondary/30 border border-border flex flex-col gap-3">
            <div className="flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 text-sm rounded-md border border-input bg-background px-2 py-1.5 focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                placeholder="Limit"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-24 text-sm rounded-md border border-input bg-background px-2 py-1.5 focus:ring-1 focus:ring-primary"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="text-xs px-3 py-1.5 hover:bg-accent rounded-md">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90">
                {isSubmitting ? 'Saving...' : 'Set Limit'}
              </button>
            </div>
          </form>
        )}

        {activeCategories.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No category limits set.
          </p>
        )}

        <div className="space-y-4">
          {activeCategories.map(cat => {
            const limit = budgets[cat];
            const spent = categorySpend[cat] || 0;
            const percentage = Math.min((spent / limit) * 100, 100);
            const isOver = spent > limit;
            const isWarning = percentage >= 85 && !isOver;

            let barColor = 'bg-primary';
            if (isOver) barColor = 'bg-red-500';
            else if (isWarning) barColor = 'bg-yellow-500';

            return (
              <div key={cat} className="space-y-1.5 group">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    {cat}
                    {isOver && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {projectCurrency} {spent.toLocaleString()} / {limit.toLocaleString()}
                    </span>
                    <button 
                      onClick={() => handleRemoveBudget(cat)}
                      className="text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {isOver && (
                  <p className="text-xs text-red-500 font-medium">Over budget by {projectCurrency} {(spent - limit).toLocaleString()}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
