import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, Plus, Download, Upload, Camera, Loader2, PieChart, BarChart3 
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

import TransactionList from '../components/TransactionList';
import ChatInsights from '../components/ChatInsights';
import AddExpenseModal from '../components/AddExpenseModal';
import SavingsGoals from '../components/SavingsGoals';
import CollaboratorPanel from '../components/CollaboratorPanel';
import SplitSummary from '../components/SplitSummary';
import CurrencyConverter from '../components/CurrencyConverter';
import CategoryBudgets from '../components/CategoryBudgets';
import { exportToPDF } from '../lib/pdf';
import { parseCSV, formatTransactionsForDb } from '../lib/csv';
import { scanReceipt } from '../lib/ocr';
import { useExchangeRates } from '../hooks/useExchangeRates';

export default function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions'); // transactions, insights
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);
  const receiptInputRef = useRef(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [editTx, setEditTx] = useState(null); // transaction being edited
  const [editLoading, setEditLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };
  const { rates, loading: ratesLoading, convert } = useExchangeRates();

  // For charts
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const fetchProjectData = async () => {
    try {
      const [projectRes, txRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('transactions').select('*').eq('project_id', id).order('created_at', { ascending: false })
      ]);

      if (projectRes.error) throw projectRes.error;
      setProject(projectRes.data);
      
      if (txRes.data) {
        setTransactions(txRes.data);
        
        // Aggregate for Category Pie Chart
        const categoryTotals = txRes.data.reduce((acc, tx) => {
          acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
          return acc;
        }, {});
        setCategoryData(Object.entries(categoryTotals).map(([name, value]) => ({ name, value })));

        // Aggregate for Monthly Trend Bar Chart
        const monthlyTotals = txRes.data.reduce((acc, tx) => {
          const month = new Date(tx.created_at).toLocaleString('default', { month: 'short' });
          acc[month] = (acc[month] || 0) + Number(tx.amount);
          return acc;
        }, {});
        setTrendData(Object.entries(monthlyTotals).map(([name, amount]) => ({ name, amount })).reverse());
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchProjectData();
      
      const channel = supabase
        .channel(`transactions_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `project_id=eq.${id}` }, 
          (payload) => {
            console.log('Realtime change received!', payload);
            fetchProjectData();
            if (payload.eventType === 'INSERT') {
              showToast(`💰 New expense: ${payload.new.name || 'Transaction'}`);
            } else if (payload.eventType === 'DELETE') {
              showToast(`🗑️ Transaction deleted`);
            } else if (payload.eventType === 'UPDATE') {
              showToast(`✏️ Transaction updated`);
            }
          }
        )
        .subscribe((status) => {
          setIsLive(status === 'SUBSCRIBED');
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, id]);

  const handleExportPDF = () => {
    if (reportRef.current) {
      exportToPDF(reportRef.current, `${project.name}-report.pdf`);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const rawData = await parseCSV(file);
      const formatted = formatTransactionsForDb(rawData, id, user.id);
      
      const { error } = await supabase.from('transactions').insert(formatted);
      if (error) throw error;
      
      alert('CSV imported successfully!');
      fetchProjectData();
    } catch (error) {
      alert('Error importing CSV: ' + error.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReceiptScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject unsupported formats (AVIF is not reliably processed by Tesseract in the browser)
    if (file.type === 'image/avif') {
      setOcrError('AVIF images are not supported for scanning. Please use PNG or JPEG.');
      return;
    }
    
    setOcrError('');

    try {
      setOcrLoading(true);
      const { merchant, total } = await scanReceipt(file);
      
      if (!total) {
        setOcrError("Couldn't detect a total amount. Please enter manually.");
        return;
      }

      const { error } = await supabase.from('transactions').insert({
        project_id: id,
        user_id: user.id,
        name: merchant || 'Scanned Receipt',
        amount: total,
        category: 'General',
        paid_by: 'Me'
      });

      if (error) throw error;
      alert(`Successfully scanned: ${merchant} for ${project.currency} ${total}`);
      fetchProjectData();
    } catch (error) {
      setOcrError('Error scanning receipt: ' + error.message);
    } finally {
      setOcrLoading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };

  const handleDeleteTransaction = async (txId) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txId);
      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== txId));
      fetchProjectData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editTx) return;
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ name: editTx.name, amount: parseFloat(editTx.amount), category: editTx.category, paid_by: editTx.paid_by })
        .eq('id', editTx.id);
      if (error) throw error;
      setEditTx(null);
      fetchProjectData();
    } catch (err) {
      alert('Failed to save changes.');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) return <div className="p-8 text-center">Project not found.</div>;

  const totalSpent = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const budgetPct = project?.total_budget ? Math.min((totalSpent / project.total_budget) * 100, 100) : null;
  const budgetColor = budgetPct === null ? '' : budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-6 animate-in fade-in duration-500" ref={reportRef}>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-card border border-border shadow-xl rounded-xl px-5 py-3 text-sm font-medium text-foreground flex items-center gap-2" style={{ animation: 'slideIn 0.3s ease-out' }}>
          {toast}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Edit Transaction</h2>
              <button onClick={() => setEditTx(null)} className="rounded-full p-2 hover:bg-secondary text-muted-foreground transition-colors">
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input type="text" value={editTx.name} onChange={e => setEditTx(p => ({ ...p, name: e.target.value }))} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount</label>
                <input type="number" step="0.01" value={editTx.amount} onChange={e => setEditTx(p => ({ ...p, amount: e.target.value }))} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select value={editTx.category} onChange={e => setEditTx(p => ({ ...p, category: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                  {['General','Food','Transport','Housing','Entertainment','Utilities','Health','Shopping'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Paid By</label>
                <input type="text" value={editTx.paid_by || ''} onChange={e => setEditTx(p => ({ ...p, paid_by: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setEditTx(null)} className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" disabled={editLoading} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ocrError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center justify-between">
          <span>{ocrError}</span>
          <button onClick={() => setOcrError('')} className="text-destructive font-bold ml-4">✕</button>
        </div>
      )}

      {/* Local Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {project.name}
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isLive ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              {isLive ? 'Live' : '...'}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total Budget: {project.total_budget ? `${project.currency} ${Number(project.total_budget).toLocaleString()}` : 'Unlimited'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Import Hidden Input */}
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCSVUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium hover:bg-accent transition-colors" title="Import CSV">
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </button>

          {/* Receipt Scanner Hidden Input */}
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={receiptInputRef} onChange={handleReceiptScan} />
          <button onClick={() => receiptInputRef.current?.click()} disabled={ocrLoading} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50" title="Scan Receipt">
            {ocrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            Scan
          </button>

          <button onClick={handleExportPDF} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium hover:bg-accent transition-colors" title="Export PDF">
            <Download className="mr-2 h-4 w-4" /> Export
          </button>
          
          <button onClick={() => setIsExpenseModalOpen(true)} className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
              <h3 className="text-3xl font-bold text-card-foreground mt-2">
                {project.currency} {totalSpent.toLocaleString()}
              </h3>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Remaining</p>
              <h3 className={`text-3xl font-bold mt-2 ${project.total_budget && (project.total_budget - totalSpent) < 0 ? 'text-destructive' : 'text-primary'}`}>
                {project.total_budget 
                  ? `${project.currency} ${(project.total_budget - totalSpent).toLocaleString()}` 
                  : 'N/A'}
              </h3>
            </div>
          </div>

          {/* Budget Progress Bar */}
          {budgetPct !== null && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-muted-foreground">Budget Used</p>
                <p className={`text-sm font-bold ${budgetPct >= 90 ? 'text-red-500' : budgetPct >= 70 ? 'text-yellow-500' : 'text-green-500'}`}>{budgetPct.toFixed(1)}%</p>
              </div>
              <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ${budgetColor}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              {budgetPct >= 90 && <p className="text-xs text-red-500 mt-2 font-medium">⚠️ You're close to your budget limit!</p>}
            </div>
          )}

          {/* Transactions List */}
          <TransactionList
            transactions={transactions}
            onDelete={handleDeleteTransaction}
            onEdit={(tx) => setEditTx({ ...tx })}
          />
        </div>

        {/* Right Column: Charts & AI & Collaborators */}
        <div className="space-y-6">
          
          <CollaboratorPanel projectId={id} />
          
          <SplitSummary projectId={id} transactions={transactions} projectCurrency={project.currency} />

          <CurrencyConverter defaultBase={project.currency} />

          <CategoryBudgets projectId={id} transactions={transactions} projectCurrency={project.currency} />

          {/* Tabs for Sidebar Area */}
          <div className="flex bg-secondary/50 p-1 rounded-lg">
            <button 
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'transactions' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('transactions')}
            >
              Charts
            </button>
            <button 
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'insights' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('insights')}
            >
              AI Insights
            </button>
            <button 
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'goals' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('goals')}
            >
              Goals
            </button>
          </div>

          {activeTab === 'transactions' ? (
            <div className="space-y-6">
              {/* Spend by Category Chart */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  <PieChart className="h-4 w-4 text-primary" />
                  Category Split
                </h3>
                <div className="h-56 w-full">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${project.currency} ${value.toLocaleString()}`, 'Amount']} />
                        <Legend />
                      </RePieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Not enough data</div>
                  )}
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Monthly Trend
                </h3>
                <div className="h-56 w-full text-xs">
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={40} />
                        <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(value) => [`${project.currency} ${value.toLocaleString()}`, 'Spent']} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Not enough data</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'insights' ? (
            <ChatInsights projectId={id} transactions={transactions} />
          ) : (
            <SavingsGoals projectId={id} projectCurrency={project.currency} />
          )}
        </div>
      </div>

      <AddExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        projectId={id}
        onExpenseAdded={fetchProjectData}
      />
    </div>
  );
}
