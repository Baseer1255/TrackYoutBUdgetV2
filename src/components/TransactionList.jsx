import React, { useState } from 'react';
import { Search, Filter, Repeat, Trash2, Edit, Landmark, Wallet, CarFront, Home, Ticket, Zap, Coffee, ShoppingBag, HeartPulse } from 'lucide-react';
import { format } from 'date-fns';

const getCategoryStyles = (category) => {
  const norm = (category || '').toLowerCase();
  if (norm.includes('food') || norm.includes('dining')) return { bg: 'bg-[#FB7185]', text: 'text-white', icon: Coffee };
  if (norm.includes('transport') || norm.includes('ride')) return { bg: 'bg-[#14B8A6]', text: 'text-white', icon: CarFront };
  if (norm.includes('house') || norm.includes('home')) return { bg: 'bg-[#7C3AED]', text: 'text-white', icon: Home };
  if (norm.includes('entertain') || norm.includes('movie')) return { bg: 'bg-[#FACC15]', text: 'text-black', icon: Ticket };
  if (norm.includes('utilit')) return { bg: 'bg-[#60A5FA]', text: 'text-white', icon: Zap };
  if (norm.includes('shop')) return { bg: 'bg-[#F472B6]', text: 'text-white', icon: ShoppingBag };
  if (norm.includes('health') || norm.includes('medical')) return { bg: 'bg-[#34D399]', text: 'text-white', icon: HeartPulse };
  return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Wallet };
};

export default function TransactionList({ transactions, onDelete, onEdit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = [...new Set(transactions.map(t => t.category))];

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter ? t.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="vibrant-card mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-xl font-bold text-foreground">Recent Transactions</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {filteredTransactions.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground">Your ledger is a blank canvas.</p>
            <p className="text-sm text-muted-foreground mt-1">Let's start tracking!</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Paid By</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.map((tx) => {
                const { icon: CategoryIcon } = getCategoryStyles(tx.category);
                return (
                  <tr key={tx.id} className="group hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryStyles(tx.category).bg} ${getCategoryStyles(tx.category).text} shadow-sm shrink-0`}>
                        <CategoryIcon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-foreground text-base">{tx.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {tx.source === 'plaid' && (
                            <span title="Imported from Bank" className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 bg-[#14B8A6]/20 text-[#14B8A6]">
                              <Landmark className="w-3 h-3" />
                              Plaid
                            </span>
                          )}
                          {tx.is_recurring && (
                            <span title="Recurring Template" className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 bg-primary/20 text-primary">
                              <Repeat className="w-3 h-3" />
                              {tx.recurrence_frequency}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium bg-secondary/50 text-secondary-foreground border border-border">
                        {tx.category || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {tx.paid_by || 'Me'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold numeric-display text-foreground text-right">
                      ${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(tx)}
                          className="p-1.5 text-muted-foreground hover:text-primary bg-secondary hover:bg-primary/10 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(tx.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive bg-secondary hover:bg-destructive/10 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
