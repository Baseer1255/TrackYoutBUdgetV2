import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, Plus, Trash2, Loader2, Landmark } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function NetWorthCard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'asset', balance: '', currency: 'USD' });
  const [saving, setSaving] = useState(false);

  const [snapshots, setSnapshots] = useState([]);
  const [plaidMapping, setPlaidMapping] = useState({});

  const fetchAccounts = async () => {
    const [accountsRes, snapshotsRes, plaidRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('plaid_accounts').select('account_id, plaid_items(institution_name)')
    ]);
    
    setAccounts(accountsRes.data || []);
    
    if (plaidRes.data) {
      const mapping = {};
      plaidRes.data.forEach(p => {
        if (p.account_id) {
          mapping[p.account_id] = p.plaid_items?.institution_name || 'Bank';
        }
      });
      setPlaidMapping(mapping);
    }
    
    if (snapshotsRes.data) {
      setSnapshots(snapshotsRes.data.map(s => ({
        ...s,
        dateFormatted: new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAccounts();
  }, [user]);

  const totalAssets = accounts
    .filter(a => a.type === 'asset')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const totalLiabilities = accounts
    .filter(a => a.type === 'liability')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const netWorth = totalAssets - totalLiabilities;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.balance) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('accounts').insert({
        user_id: user.id,
        name: form.name,
        type: form.type,
        balance: parseFloat(form.balance),
        currency: form.currency,
      });
      if (error) throw error;

      const newAssets = form.type === 'asset' ? totalAssets + parseFloat(form.balance) : totalAssets;
      const newLiabilities = form.type === 'liability' ? totalLiabilities + parseFloat(form.balance) : totalLiabilities;
      const newNetWorth = newAssets - newLiabilities;

      await supabase.from('net_worth_snapshots').insert({
        user_id: user.id,
        total_assets: newAssets,
        total_liabilities: newLiabilities,
        net_worth: newNetWorth
      });

      setForm({ name: '', type: 'asset', balance: '', currency: 'USD' });
      setShowForm(false);
      fetchAccounts();
    } catch (err) {
      alert('Failed to add account: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const accountToDelete = accounts.find(a => a.id === id);
    if (!accountToDelete) return;

    await supabase.from('accounts').delete().eq('id', id);

    const newAssets = accountToDelete.type === 'asset' ? totalAssets - Number(accountToDelete.balance) : totalAssets;
    const newLiabilities = accountToDelete.type === 'liability' ? totalLiabilities - Number(accountToDelete.balance) : totalLiabilities;
    const newNetWorth = newAssets - newLiabilities;

    await supabase.from('net_worth_snapshots').insert({
      user_id: user.id,
      total_assets: newAssets,
      total_liabilities: newLiabilities,
      net_worth: newNetWorth
    });

    fetchAccounts();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-primary">
          <Landmark className="w-5 h-5" />
          <h3 className="font-semibold text-foreground">Net Worth</h3>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
          title="Add account"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Row */}
      <div className={`text-2xl font-bold mb-1 ${netWorth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {netWorth >= 0 ? '+' : '-'}${Math.abs(netWorth).toLocaleString()}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground mb-4">
        <span className="text-green-500 font-medium">▲ Assets ${totalAssets.toLocaleString()}</span>
        <span className="text-red-500 font-medium">▼ Debts ${totalLiabilities.toLocaleString()}</span>
      </div>

      {/* Net Worth Trend Chart */}
      {snapshots.length > 0 && (
        <div className="h-24 w-full mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={snapshots}>
              <XAxis dataKey="dateFormatted" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`$${value}`, 'Net Worth']}
                labelStyle={{ color: '#64748b' }}
              />
              <Line 
                type="monotone" 
                dataKey="net_worth" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add Account Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="space-y-2 mb-4 p-3 bg-secondary/40 rounded-lg">
          <input
            type="text"
            placeholder="Account name (e.g., Savings)"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            required
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Balance"
              value={form.balance}
              onChange={e => setForm(p => ({ ...p, balance: e.target.value }))}
              required
              className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add Account'}
          </button>
        </form>
      )}

      {/* Account List */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No accounts yet. Add assets or liabilities.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between text-sm group">
              <div className="flex items-center gap-2">
                {acc.type === 'asset'
                  ? <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  : <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />
                }
                <span className="text-foreground truncate max-w-[120px]">{acc.name}</span>
                {plaidMapping[acc.id] && (
                  <span title={`Synced with ${plaidMapping[acc.id]}`} className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Landmark className="w-3 h-3" />
                    Synced
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${acc.type === 'asset' ? 'text-green-500' : 'text-red-500'}`}>
                  {acc.type === 'liability' ? '-' : '+'}${Number(acc.balance).toLocaleString()}
                </span>
                <button
                  onClick={() => handleDelete(acc.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
