import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, Plus, Download, Upload, Camera, Loader2, PieChart, BarChart3, ScanLine 
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

import TransactionList from '../components/TransactionList';
import ChatInsights from '../components/ChatInsights';
import AddExpenseModal from '../components/AddExpenseModal';
import CSVImportModal from '../components/CSVImportModal';
import StatementToCSVModal from '../components/StatementToCSVModal';
import SavingsGoals from '../components/SavingsGoals';
import CollaboratorPanel from '../components/CollaboratorPanel';
import SplitSummary from '../components/SplitSummary';
import CurrencyConverter from '../components/CurrencyConverter';
import CategoryBudgets from '../components/CategoryBudgets';
import RecurringList from '../components/RecurringList';
import { exportToPDF } from '../lib/pdf';
import { scanReceipt } from '../lib/ocr';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions'); // transactions, insights
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  
  const reportRef = useRef(null);
  const receiptInputRef = useRef(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [editTx, setEditTx] = useState(null); // transaction being edited
  const [editLoading, setEditLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };
  const { rates, loading: ratesLoading, convert } = useExchangeRates();
  const { notify } = usePushNotifications();

  // For charts
  const [categoryData, setCategoryData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const fetchProjectData = async () => {
    try {
      const [projectRes, txRes, memberRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('transactions').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('project_members').select('role').eq('project_id', id).eq('user_id', user.id).single()
      ]);

      if (projectRes.error) throw projectRes.error;
      setProject(projectRes.data);
      if (memberRes.data?.role === 'owner') setIsOwner(true);
      
      if (txRes.data) {
        setTransactions(txRes.data);
        
        // Aggregate for Category Pie Chart
        const categoryTotals = txRes.data.reduce((acc, tx) => {
          acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
          return acc;
        }, {});
        setCategoryData(Object.entries(categoryTotals).map(([name, value]) => ({ name, value })));

        // Aggregate for Monthly Trend Bar Chart — sorted chronologically
        const MONTH_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthlyTotals = txRes.data.reduce((acc, tx) => {
          const month = new Date(tx.created_at).toLocaleString('default', { month: 'short' });
          acc[month] = (acc[month] || 0) + Number(tx.amount);
          return acc;
        }, {});
        setTrendData(
          Object.entries(monthlyTotals)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => MONTH_ORDER.indexOf(a.name) - MONTH_ORDER.indexOf(b.name))
        );
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

  const handleExportPDF = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    showToast('📄 Generating PDF...');
    try {
      await exportToPDF(reportRef.current, `${project.name}-report.pdf`);
      showToast('✅ PDF exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('❌ PDF export failed. Please try again.');
    } finally {
      setExporting(false);
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

  const handleDeleteProject = async () => {
    if (!confirm('Are you absolutely sure you want to delete this entire project? This action cannot be undone and will delete all associated transactions and budgets.')) return;
    
    try {
      // Supabase ON DELETE CASCADE is usually set, but if not we can delete dependencies explicitly or rely on it.
      // We will attempt to delete the project directly. If it fails due to FK constraints without CASCADE, 
      // we'd delete children first. Most Supabase setups include CASCADE. Let's delete children explicitly to be safe.
      await supabase.from('transactions').delete().eq('project_id', id);
      await supabase.from('category_budgets').delete().eq('project_id', id);
      await supabase.from('project_members').delete().eq('project_id', id);
      
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      
      navigate('/');
    } catch (error) {
      alert('Error deleting project: ' + error.message);
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
                <input type="text" value={editTx.name} onChange={e => setEditTx(p => ({ ...p, name: e.target.value }))} required className="vibrant-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount</label>
                <input type="number" step="0.01" value={editTx.amount} onChange={e => setEditTx(p => ({ ...p, amount: e.target.value }))} required className="vibrant-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select value={editTx.category} onChange={e => setEditTx(p => ({ ...p, category: e.target.value }))} className="vibrant-input">
                  {['General','Food','Transport','Housing','Entertainment','Utilities','Health','Shopping'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Paid By</label>
                <input type="text" value={editTx.paid_by || ''} onChange={e => setEditTx(p => ({ ...p, paid_by: e.target.value }))} className="vibrant-input" />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setEditTx(null)} className="vibrant-button-ghost">Cancel</button>
                <button type="submit" disabled={editLoading} className="vibrant-button-primary disabled:opacity-50">
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
          <button onClick={() => setIsConvertModalOpen(true)} className="vibrant-button-ghost" title="Convert bank statement image to CSV">
            <ScanLine className="mr-2 h-4 w-4" /> Convert to CSV
          </button>

          <button onClick={() => setIsCSVModalOpen(true)} className="vibrant-button-ghost" title="Import Bank Statement">
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </button>

          {/* Receipt Scanner Hidden Input */}
          <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/bmp, image/tiff" className="hidden" ref={receiptInputRef} onChange={handleReceiptScan} />
          <button onClick={() => receiptInputRef.current?.click()} disabled={ocrLoading} className="vibrant-button-ghost disabled:opacity-50" title="Scan Receipt — Accepts PNG, JPEG, WebP, BMP, TIFF">
            {ocrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            Scan
          </button>

          <button onClick={handleExportPDF} disabled={exporting} className="vibrant-button-ghost disabled:opacity-50" title="Export PDF">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export
          </button>
          
          <button onClick={() => setIsExpenseModalOpen(true)} className="vibrant-button-primary">
            <Plus className="mr-2 h-4 w-4" /> Expense
          </button>

          {isOwner && (
            <button 
              onClick={handleDeleteProject} 
              className="inline-flex h-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground px-4 py-2 text-sm font-medium shadow-sm transition-all ml-2" 
              title="Delete Project"
            >
              Delete Project
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="vibrant-card !p-5">
              <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
              <h3 className="text-3xl font-bold text-card-foreground mt-2 numeric-display">
                {project.currency} {totalSpent.toLocaleString()}
              </h3>
            </div>
            <div className="vibrant-card !p-5">
              <p className="text-sm font-medium text-muted-foreground">Remaining</p>
              <h3 className={`text-3xl font-bold mt-2 numeric-display ${project.total_budget && (project.total_budget - totalSpent) < 0 ? 'text-destructive' : 'text-primary'}`}>
                {project.total_budget 
                  ? `${project.currency} ${(project.total_budget - totalSpent).toLocaleString()}` 
                  : 'N/A'}
              </h3>
            </div>
          </div>

          {/* Budget Progress Bar */}
          {budgetPct !== null && (
            <div className="vibrant-card !p-5">
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
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'recurring' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('recurring')}
            >
              Recurring
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
              <div className="vibrant-card">
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
              <div className="vibrant-card" id="monthly-trend-chart">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Monthly Trend
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," 
                          + "Month,Amount\n" 
                          + trendData.map(row => `${row.name},${row.amount}`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `${project.name}-monthly-trend.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="text-xs px-2 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded"
                      title="Export CSV"
                    >
                      CSV
                    </button>
                    <button 
                      onClick={() => {
                        const chartEl = document.getElementById('monthly-trend-chart');
                        if (chartEl) exportToPDF(chartEl, `${project.name}-monthly-trend.pdf`);
                      }}
                      className="text-xs px-2 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded"
                      title="Export PDF"
                    >
                      PDF
                    </button>
                  </div>
                </div>
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
          ) : activeTab === 'recurring' ? (
            <RecurringList 
              transactions={transactions} 
              onEdit={(tx) => setEditTx({ ...tx })} 
              onDelete={handleDeleteTransaction} 
            />
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
        onBudgetAlert={(category, message) => {
          showToast(`⚠️ Budget alert: ${category} is near its limit!`);
          // Also send a browser push notification
          if (notify) notify('Budget Alert 🚨', `${category} is approaching its spending limit!`);
        }}
      />

      <CSVImportModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        projectId={id}
        onImportComplete={() => {
          fetchProjectData();
          showToast('✅ Bank statement imported successfully!');
        }}
      />

      <StatementToCSVModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
      />
    </div>
  );
}
