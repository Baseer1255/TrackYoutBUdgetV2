import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, X, Link as LinkIcon, Check, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function CreateProjectModal({ isOpen, onClose, onProjectCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const newToken = uuidv4();
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert([{
          name,
          currency,
          total_budget: budget ? Number(budget) : null,
          owner_id: user.id,
          invite_token: newToken
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      
      onProjectCreated();
      // Show success screen instead of closing immediately
      setSuccessData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndClose = async () => {
    if (successData?.invite_token) {
      const inviteUrl = `${window.location.origin}/invite/${successData.invite_token}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form for next time
    setTimeout(() => {
      setName('');
      setBudget('');
      setCurrency('USD');
      setSuccessData(null);
      setCopied(false);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
        </button>
        
        {successData ? (
          <div className="text-center py-6 animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Project Created!</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Invite collaborators right away by sharing this link with them.
            </p>
            
            <div className="bg-secondary/50 p-3 rounded-lg border border-border flex items-center gap-3 mb-8">
              <div className="bg-background p-2 rounded border border-border">
                <LinkIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm font-mono truncate flex-1 text-left text-muted-foreground">
                {`${window.location.origin}/invite/${successData.invite_token}`}
              </div>
            </div>

            <button
              onClick={handleCopyAndClose}
              className="w-full h-11 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Copied!
                </>
              ) : (
                'Copy Link & Close'
              )}
            </button>
            <button
              onClick={handleClose}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-6">Create New Budget Project</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="e.g. Hawaii Trip 2024"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Budget</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Optional limit"
                min="0"
                step="0.01"
              />
            </div>
          </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-10 rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Project'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
