import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function Invite() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return; // Wait until auth state is resolved

    const processInvite = async () => {
      try {
        // 1. Look up the project by invite token (using RPC to bypass RLS)
        const { data: projects, error: projectError } = await supabase
          .rpc('get_project_by_token', { token });

        if (projectError || !projects || projects.length === 0) {
          throw new Error('Invalid or expired invite link.');
        }

        const project = projects[0];

        // 2. If user is not logged in, save the destination and redirect to login
        if (!user) {
          localStorage.setItem('redirectAfterLogin', `/invite/${token}`);
          navigate('/login');
          return;
        }

        // 3. User is logged in. Join the project using RPC
        const { data: projectId, error: joinError } = await supabase
          .rpc('join_project_by_token', { token });

        if (joinError || !projectId) {
          console.error(joinError);
          throw new Error('Failed to join the project.');
        }

        // 4. Redirect to the project page
        localStorage.removeItem('redirectAfterLogin'); // clear any saved redirects
        navigate(`/project/${projectId}`);

      } catch (err) {
        setError(err.message);
      }
    };

    processInvite();
  }, [authLoading, user, token, navigate]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="bg-card p-8 rounded-xl shadow-lg border border-border max-w-md w-full text-center">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Invite Failed</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground animate-pulse">Processing your invite...</p>
      </div>
    </div>
  );
}
