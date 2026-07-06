import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, ArrowRight, Loader2 } from 'lucide-react';

export default function SplitSummary({ projectId, transactions, projectCurrency = '$' }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('project_members')
          .select(`
            user_id,
            profiles:user_id (id, full_name)
          `)
          .eq('project_id', projectId);

        if (error) throw error;
        setMembers(data || []);
      } catch (err) {
        console.error('Error fetching members for splits:', err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchMembers();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center bg-card rounded-xl border border-border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (members.length <= 1) {
    return null; // No need to split if only 1 member
  }

  // Calculate balances
  // Positive balance means the user is owed money
  // Negative balance means the user owes money
  const balances = {};
  members.forEach(m => {
    balances[m.user_id] = {
      id: m.user_id,
      name: m.profiles?.full_name || 'Unknown',
      balance: 0
    };
  });

  const memberCount = members.length;

  transactions.forEach(tx => {
    if (!tx.amount) return;
    
    // Determine who paid. If paid_by matches a user_id, use that.
    // Otherwise fallback to tx.user_id (the person who created the transaction)
    let payerId = tx.user_id;
    // Check if paid_by is exactly a user's name or UUID
    const matchedMember = members.find(m => 
      m.user_id === tx.paid_by || 
      m.profiles?.full_name?.toLowerCase() === tx.paid_by?.toLowerCase()
    );
    if (matchedMember) {
      payerId = matchedMember.user_id;
    }

    const amount = Number(tx.amount);
    const splitAmount = amount / memberCount;

    // The payer gets credited the full amount, then debited their own share
    if (balances[payerId]) {
      balances[payerId].balance += amount;
    }

    // Everyone gets debited the split share
    members.forEach(m => {
      if (balances[m.user_id]) {
        balances[m.user_id].balance -= splitAmount;
      }
    });
  });

  const currentUserBalance = balances[user.id]?.balance || 0;
  
  // Sort members by balance (highest owed to most owing)
  const sortedBalances = Object.values(balances).sort((a, b) => b.balance - a.balance);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <Users className="w-5 h-5 text-primary" />
          Split Summary
        </h3>
        <span className={`text-sm font-bold ${currentUserBalance > 0.01 ? 'text-green-500' : currentUserBalance < -0.01 ? 'text-red-500' : 'text-muted-foreground'}`}>
          {currentUserBalance > 0.01 ? 'You are owed' : currentUserBalance < -0.01 ? 'You owe' : 'Settled up'}
          {Math.abs(currentUserBalance) > 0.01 && `: ${projectCurrency} ${Math.abs(currentUserBalance).toFixed(2)}`}
        </span>
      </div>

      <div className="space-y-3">
        {sortedBalances.map(b => (
          <div key={b.id} className="flex justify-between items-center text-sm">
            <span className="font-medium text-foreground">
              {b.id === user.id ? 'You' : b.name}
            </span>
            <span className={`font-semibold ${b.balance > 0.01 ? 'text-green-500' : b.balance < -0.01 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {b.balance > 0.01 ? '+' : ''}{b.balance.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-2 italic">
        Assuming all expenses are split equally among the {memberCount} members.
      </p>
    </div>
  );
}
