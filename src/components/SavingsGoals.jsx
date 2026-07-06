import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Target, Plus, TrendingUp, Loader2, DollarSign } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SavingsGoals({ projectId, projectCurrency = '$' }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', target_amount: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Contribution modal state
  const [contributeGoal, setContributeGoal] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error('Error fetching savings goals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [projectId]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoal.name || !newGoal.target_amount) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('savings_goals')
        .insert([{
          project_id: projectId,
          name: newGoal.name,
          target_amount: Number(newGoal.target_amount),
          current_amount: 0
        }]);

      if (error) throw error;
      
      setNewGoal({ name: '', target_amount: '' });
      setShowAddForm(false);
      fetchGoals();
    } catch (err) {
      console.error('Error creating goal:', err);
      alert('Failed to create goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    if (!contributeGoal || !contributionAmount) return;

    try {
      setIsSubmitting(true);
      const newAmount = Number(contributeGoal.current_amount) + Number(contributionAmount);
      
      const { error } = await supabase
        .from('savings_goals')
        .update({ current_amount: newAmount })
        .eq('id', contributeGoal.id);

      if (error) throw error;
      
      // Check if goal reached
      if (newAmount >= Number(contributeGoal.target_amount) && Number(contributeGoal.current_amount) < Number(contributeGoal.target_amount)) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b']
        });
      }

      setContributeGoal(null);
      setContributionAmount('');
      fetchGoals();
    } catch (err) {
      console.error('Error contributing:', err);
      alert('Failed to update goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center bg-card rounded-xl border border-border">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Savings Goals
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showAddForm && (
          <form onSubmit={handleCreateGoal} className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3 mb-4">
            <h4 className="text-sm font-medium mb-2">New Savings Goal</h4>
            <input
              type="text"
              placeholder="Goal Name (e.g., Vacation)"
              value={newGoal.name}
              onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2"
              required
            />
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                placeholder="Target Amount"
                value={newGoal.target_amount}
                onChange={e => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                className="w-full text-sm rounded-md border border-input bg-background pl-9 pr-3 py-2"
                min="1"
                step="0.01"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="text-xs px-3 py-1.5 hover:bg-accent rounded-md">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90">
                {isSubmitting ? 'Saving...' : 'Create Goal'}
              </button>
            </div>
          </form>
        )}

        {goals.length === 0 && !showAddForm ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
            <Target className="w-10 h-10 mb-3 text-muted-foreground" />
            <p className="text-sm">No savings goals yet.</p>
            <p className="text-xs mt-1">Click the + icon to create one!</p>
          </div>
        ) : (
          goals.map(goal => {
            const current = Number(goal.current_amount);
            const target = Number(goal.target_amount);
            const progress = Math.min((current / target) * 100, 100);
            
            return (
              <div key={goal.id} className="p-4 rounded-xl border border-border bg-background shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{goal.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {projectCurrency} {current.toLocaleString()} / {projectCurrency} {target.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setContributeGoal(goal)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-600 px-2 py-1 rounded-md hover:bg-green-500/20 transition-colors"
                  >
                    <TrendingUp className="w-3 h-3" /> Add Funds
                  </button>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>{progress.toFixed(1)}%</span>
                  <span>{projectCurrency} {(target - current > 0 ? target - current : 0).toLocaleString()} left</span>
                </div>

                {contributeGoal?.id === goal.id && (
                  <form onSubmit={handleContribute} className="mt-3 flex gap-2 pt-3 border-t border-border">
                    <input
                      type="number"
                      placeholder="Amount to add"
                      value={contributionAmount}
                      onChange={e => setContributionAmount(e.target.value)}
                      className="flex-1 text-sm rounded-md border border-input bg-card px-2 py-1.5"
                      min="0.01"
                      step="0.01"
                      required
                      autoFocus
                    />
                    <button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md hover:bg-primary/90">
                      Save
                    </button>
                    <button type="button" onClick={() => setContributeGoal(null)} className="text-xs px-2 py-1.5 hover:bg-accent rounded-md text-muted-foreground">
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
