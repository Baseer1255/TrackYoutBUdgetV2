import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Folder, ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, projects: 0 });
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      try {
        // 1. Check if user is admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || profile?.role !== 'admin') {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        // 2. Fetch admin data
        const [usersRes, projectsRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact' }),
          supabase.from('projects').select('*', { count: 'exact', head: true })
        ]);

        if (usersRes.data) {
          setAllUsers(usersRes.data);
          setStats({
            users: usersRes.count || 0,
            projects: projectsRes.count || 0
          });
        }
      } catch (err) {
        console.error('Admin check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkAdminAndFetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2 max-w-md mb-6">
          You do not have the required permissions to view the admin dashboard.
        </p>
        <button onClick={() => navigate('/')} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center px-4 gap-4">
          <Link to="/" className="rounded-full p-2 hover:bg-accent hover:text-accent-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 py-8">
        
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              <h3 className="text-3xl font-bold text-card-foreground">{stats.users}</h3>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Folder className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
              <h3 className="text-3xl font-bold text-card-foreground">{stats.projects}</h3>
            </div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border p-4 bg-muted/20">
            <h3 className="font-semibold text-lg">User Management</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b border-border">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Full Name</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{u.id.substring(0, 8)}...</td>
                    <td className="px-6 py-4 font-medium">{u.full_name || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
