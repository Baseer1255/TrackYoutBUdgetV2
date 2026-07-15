import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Settings as SettingsIcon, Save, Loader2, LogOut, Moon, Sun, Landmark, RefreshCw, Unplug } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ full_name: '', email: user?.email || '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Basic theme toggle using document element
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const fetchProfileAndPlaid = async () => {
      try {
        const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single();
          
        if (profileRes.error) throw profileRes.error;
        setProfile({ ...profile, full_name: profileRes.data.full_name || '' });
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchProfileAndPlaid();
    }
  }, [user]);


  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profile.full_name })
        .eq('id', user.id);
        
      if (error) throw error;
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDark(!isDark);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-8">
        <SettingsIcon className="w-6 h-6 text-primary" />
        Account Settings
      </h1>
      
      <div className="space-y-6">
        
        {/* Profile Card */}
        <div className="vibrant-card">
          <div className="mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile Details
            </h2>
          </div>
          
          <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
            {success && <div className="text-sm text-green-500 bg-green-500/10 p-3 rounded-md">{success}</div>}
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
              <input 
                type="email" 
                value={profile.email} 
                disabled 
                className="vibrant-input opacity-70"
              />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
              <input 
                type="text" 
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="e.g., John Doe"
                className="vibrant-input"
              />
            </div>
            
            <div className="pt-2 flex justify-end">
              <button 
                type="submit" 
                disabled={saving}
                className="vibrant-button-primary disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
        
        {/* Preferences Card */}
        <div className="vibrant-card mt-8">
          <div className="mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Preferences
            </h2>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground text-sm">Appearance</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Toggle between light and dark mode.</p>
              </div>
              <button 
                onClick={toggleTheme}
                className="vibrant-button-ghost"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
        

        {/* Danger Zone */}
        <div className="vibrant-card border-destructive/20 mt-8">
          <div className="mb-4">
            <h2 className="font-semibold text-destructive flex items-center gap-2">
              Danger Zone
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground text-sm">Sign Out</h4>
              <p className="text-xs text-muted-foreground mt-0.5">End your current session.</p>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-destructive/10 text-destructive text-sm font-medium px-4 py-2 rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
