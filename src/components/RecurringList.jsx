import React from 'react';
import { format } from 'date-fns';
import { Repeat, Trash2, Edit } from 'lucide-react';

export default function RecurringList({ transactions, onEdit, onDelete }) {
  const recurringTemplates = transactions.filter(t => t.is_recurring);

  if (recurringTemplates.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground shadow-sm">
        <Repeat className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>No active recurring transactions found.</p>
        <p className="text-xs mt-1">Create one by checking "Make this a recurring expense" when adding an expense.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          Active Recurring Templates
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium text-right">Amount</th>
              <th className="px-6 py-3 font-medium">Frequency</th>
              <th className="px-6 py-3 font-medium">Next Occurrence</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recurringTemplates.map((tx) => (
              <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">
                  {tx.name}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                    {tx.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-semibold">
                  {Number(tx.amount).toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  <span className="capitalize">{tx.recurrence_frequency}</span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {tx.next_occurrence ? format(new Date(tx.next_occurrence), 'MMM d, yyyy') : 'N/A'}
                  {tx.recurrence_end_date && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Ends: {format(new Date(tx.recurrence_end_date), 'MMM d, yyyy')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => onEdit(tx)}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(tx.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      title="Cancel Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
