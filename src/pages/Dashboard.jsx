import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Wallet, Loader2, Trophy, ArrowRight, Radio } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import NetWorthCard from '../components/NetWorthCard';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*, project_members!inner(role)')
        .eq('project_members.user_id', user.id);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Fetch global recent transactions across all user's projects
      const projectIds = (projectsData || []).map(p => p.id);
      if (projectIds.length > 0) {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('id, name, amount, created_at, projects(name, currency)')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (!txError) {
          setRecentTransactions(txData || []);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Show toast notification
  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    fetchDashboardData();

    // Subscribe to realtime changes on projects table
    const projectsChannel = supabase
      .channel('dashboard_projects')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          console.log('Realtime project change:', payload);
          fetchDashboardData();
          if (payload.eventType === 'INSERT') {
            showToast(`📂 New project created!`);
          }
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    // Subscribe to realtime changes on transactions table
    const txChannel = supabase
      .channel('dashboard_transactions')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          console.log('Realtime transaction change:', payload);
          fetchDashboardData();
          if (payload.eventType === 'INSERT') {
            showToast(`💰 New expense added: ${payload.new.name || 'Transaction'}`);
          } else if (payload.eventType === 'DELETE') {
            showToast(`🗑️ Transaction deleted`);
          } else if (payload.eventType === 'UPDATE') {
            showToast(`✏️ Transaction updated`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(txChannel);
    };
  }, [user, fetchDashboardData, showToast]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right duration-300 bg-card border border-border shadow-xl rounded-xl px-5 py-3 text-sm font-medium text-foreground flex items-center gap-2">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back!</h1>
            {/* Live indicator */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isLive ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              {isLive ? 'Live' : 'Connecting...'}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">Here is an overview of your budgets and spending.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="vibrant-button-primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Projects Area */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Your Budgets</h2>
          
          {loading ? (
            <div className="flex h-40 items-center justify-center vibrant-card">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : projects.length === 0 ? (
            <div className="vibrant-card flex flex-col items-center justify-center border-dashed p-12 text-center bg-card/50">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Planning a trip or a new goal?</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-6">
                Create your first project to begin.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="vibrant-button-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/project/${project.id}`}
                  className="vibrant-card group relative flex flex-col overflow-hidden !p-5 hover:border-primary/50"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-card-foreground leading-tight">{project.name}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-secondary text-secondary-foreground rounded-lg">
                      {project.project_members?.[0]?.role || 'Member'}
                    </span>
                  </div>
                  
                  <div className="mt-auto">
                    <p className="text-sm text-muted-foreground mb-1">Total Budget</p>
                    <p className="text-2xl font-bold numeric-display text-foreground">
                      {project.total_budget ? `${project.currency} ${Number(project.total_budget).toLocaleString()}` : 'No limit'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Area */}
        <div className="space-y-6">
        {/* Net Worth Card */}
          <NetWorthCard />

          {/* Leaderboard/Stats Widget */}
          <div className="vibrant-card">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <Trophy className="w-5 h-5" />
              <h3 className="font-semibold text-foreground">Top Savers</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><span className="font-bold text-muted-foreground">1.</span> You</span>
                <span className="font-medium text-green-600">+12% saved</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><span className="font-bold text-muted-foreground">2.</span> Alice M.</span>
                <span className="font-medium text-green-600">+8% saved</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><span className="font-bold text-muted-foreground">3.</span> Bob S.</span>
                <span className="font-medium text-green-600">+3% saved</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="vibrant-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Activity</h3>
              {isLive && (
                <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="space-y-4">
              {recentTransactions.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">No recent transactions.</p>
              )}
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-medium text-foreground">{tx.name}</p>
                    <p className="text-xs text-muted-foreground">{tx.projects?.name}</p>
                  </div>
                  <span className="font-semibold text-foreground">
                    {tx.projects?.currency} {Number(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
              {recentTransactions.length > 0 && (
                <button className="w-full text-center text-xs font-medium text-primary hover:underline pt-2 flex items-center justify-center gap-1">
                  View all activity <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={fetchDashboardData}
      />
    </div>
  );
}
