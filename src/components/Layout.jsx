import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Settings, LogOut, Menu, X, Sparkles, Moon, Sun, Zap, User } from 'lucide-react';

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [magicCommand, setMagicCommand] = useState('');
  const [magicStatus, setMagicStatus] = useState('');
  const [projects, setProjects] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize from localStorage or system preference
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const magicRef = useRef(null);

  // Apply dark class on mount + whenever darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Fetch user's projects so the magic bar knows which project to post to
  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('id, name, currency')
      .then(({ data }) => setProjects(data || []));
  }, [user]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  /**
   * Parse natural-language commands like:
   *   "Coffee 4.50"          → name=Coffee, amount=4.50
   *   "Groceries 120 food"   → name=Groceries, amount=120, category=Food
   *   "Rent 15000 housing"   → name=Rent, amount=15000, category=Housing
   */
  const parseMagicCommand = (cmd) => {
    const categoryKeywords = {
      food: 'Food', grocery: 'Food', groceries: 'Food', restaurant: 'Food',
      transport: 'Transport', uber: 'Transport', taxi: 'Transport', fuel: 'Transport', petrol: 'Transport',
      housing: 'Housing', rent: 'Housing', electricity: 'Utilities', water: 'Utilities', internet: 'Utilities',
      entertainment: 'Entertainment', movie: 'Entertainment', netflix: 'Entertainment',
      health: 'Health', medical: 'Health', medicine: 'Health',
      shopping: 'Shopping', clothes: 'Shopping',
    };

    const amountMatch = cmd.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(',', '.'));
    const withoutAmount = cmd.replace(amountMatch[0], '').trim();
    
    let category = 'General';
    let name = withoutAmount;
    
    const words = withoutAmount.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (categoryKeywords[word]) {
        category = categoryKeywords[word];
        name = withoutAmount.replace(new RegExp(word, 'i'), '').trim();
        break;
      }
    }

    name = name || cmd.replace(amountMatch[0], '').trim() || 'Quick Expense';

    return { name: name.trim(), amount, category };
  };

  const handleMagicCommand = async (e) => {
    e.preventDefault();
    if (!magicCommand.trim()) return;

    const parsed = parseMagicCommand(magicCommand);
    if (!parsed) {
      setMagicStatus('❌ Could not parse. Try: "Coffee 4.50" or "Rent 15000 housing"');
      setTimeout(() => setMagicStatus(''), 3000);
      return;
    }

    // Figure out which project to post to
    let targetProjectId = null;
    const pathMatch = location.pathname.match(/\/project\/([^/]+)/);
    if (pathMatch) {
      targetProjectId = pathMatch[1];
    } else if (projects.length === 1) {
      targetProjectId = projects[0].id;
    } else if (projects.length > 1) {
      setMagicStatus(`📋 Multiple projects found. Navigate to a project first, then try again.`);
      setTimeout(() => setMagicStatus(''), 4000);
      return;
    } else {
      setMagicStatus('❌ No projects found. Create one first!');
      setTimeout(() => setMagicStatus(''), 3000);
      return;
    }

    setMagicStatus('⏳ Adding...');
    try {
      const { error } = await supabase.from('transactions').insert({
        project_id: targetProjectId,
        user_id: user.id,
        name: parsed.name,
        amount: parsed.amount,
        category: parsed.category,
        paid_by: 'Me',
      });
      if (error) throw error;
      setMagicStatus(`✅ Added "${parsed.name}" — ${parsed.amount}`);
      setMagicCommand('');
    } catch (err) {
      setMagicStatus('❌ Failed to add. Please try again.');
    } finally {
      setTimeout(() => setMagicStatus(''), 3000);
    }
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Admin', path: '/admin', icon: Settings },
    { name: 'Settings', path: '/settings', icon: User },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              TrackYourBudget
            </Link>
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.name}
                </Link>
              );
            })}

            {/* Project links in sidebar */}
            {projects.length > 0 && (
              <div className="pt-4">
                <p className="px-3 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Projects</p>
                {projects.map(p => (
                  <Link
                    key={p.id}
                    to={`/project/${p.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      location.pathname === `/project/${p.id}`
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 text-sm text-destructive hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border gap-3">
          <button
            className="p-2 -ml-2 rounded-md lg:hidden text-muted-foreground hover:bg-secondary flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Magic Command Bar */}
          <form onSubmit={handleMagicCommand} className="flex-1 max-w-xl mx-auto relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Zap className="h-4 w-4 text-primary opacity-70 group-focus-within:opacity-100 transition-opacity" />
            </div>
            <input
              ref={magicRef}
              type="text"
              value={magicCommand}
              onChange={(e) => setMagicCommand(e.target.value)}
              placeholder='Quick add: "Coffee 4.50" or "Rent 15000 housing"...'
              className="block w-full pl-10 pr-3 py-2 border border-border rounded-full leading-5 bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-shadow"
            />
            {magicStatus && (
              <div className="absolute top-full mt-2 left-0 right-0 text-center text-xs font-medium text-foreground bg-card border border-border rounded-lg px-3 py-2 shadow-lg z-50">
                {magicStatus}
              </div>
            )}
          </form>

          {/* Dark mode toggle in header for quick access */}
          <button
            onClick={toggleDarkMode}
            className="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

