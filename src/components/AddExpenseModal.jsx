import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/** Calculate the next occurrence date based on frequency from today */
function getNextOccurrence(from, freq) {
  const d = new Date(from);
  if (freq === 'daily')   d.setDate(d.getDate() + 1);
  if (freq === 'weekly')  d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  if (freq === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0]; // returns YYYY-MM-DD
}

export default function AddExpenseModal({ isOpen, onClose, projectId, onExpenseAdded, onBudgetAlert }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [paidBy, setPaidBy] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !amount) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('transactions').insert({
        project_id: projectId,
        user_id: user.id,
        name,
        amount: parseFloat(amount),
        category,
        paid_by: paidBy || 'Me',
        is_recurring: isRecurring,
        recurrence_frequency: isRecurring ? frequency : null,
        next_occurrence: isRecurring ? getNextOccurrence(today, frequency) : null,
        recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
      });

      if (error) throw error;

      // Trigger budget-alerts Edge Function for instant feedback
      try {
        const { data: alertData } = await supabase.functions.invoke('budget-alerts', {
          body: { projectId, amount: parseFloat(amount), category },
        });
        if (alertData?.alertTriggered && onBudgetAlert) {
          onBudgetAlert(category, alertData.message);
        }
      } catch (alertErr) {
        // Budget alert is non-critical; don't block the user
        console.warn('Budget alert check failed:', alertErr.message);
      }

      onExpenseAdded();
      onClose();
      // Reset form
      setName('');
      setAmount('');
      setCategory('General');
      setPaidBy('');
      setIsRecurring(false);
      setRecurrenceEndDate('');
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Add Expense</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary text-muted-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Expense Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Grocery Shopping"
              className="vibrant-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="vibrant-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="vibrant-input"
            >
              <option value="General">General</option>
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Housing">Housing</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Utilities">Utilities</option>
              <option value="Health">Health</option>
              <option value="Shopping">Shopping</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Paid By (Optional)</label>
            <input
              type="text"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              placeholder="e.g., Alice"
              className="vibrant-input"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="recurring" className="text-sm text-foreground">Make this a recurring expense</label>
          </div>

          {isRecurring && (
            <div className="space-y-3 pl-6 border-l-2 border-primary/20">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="vibrant-input"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Next occurrence: <span className="font-medium text-foreground">{getNextOccurrence(new Date().toISOString().split('T')[0], frequency)}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="vibrant-input"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to repeat indefinitely.</p>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="vibrant-button-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="vibrant-button-primary disabled:opacity-50"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
