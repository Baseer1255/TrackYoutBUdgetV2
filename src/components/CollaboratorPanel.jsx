import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Loader2, Shield, User } from 'lucide-react';

export default function CollaboratorPanel({ projectId }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // Fetch current members
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select(`
          role,
          user_id,
          profiles:user_id (id, full_name)
        `)
        .eq('project_id', projectId);

      if (memberError) throw memberError;
      setMembers(memberData || []);

      // Fetch all profiles (for the invite dropdown)
      // In a real production app, you'd want a search API instead of loading all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name');
        
      if (usersError) throw usersError;
      setAllUsers(usersData || []);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setError('');

    try {
      setInviteLoading(true);
      
      // Check if already a member
      if (members.some(m => m.user_id === selectedUserId)) {
        throw new Error('User is already a member of this project');
      }

      const { error: insertError } = await supabase
        .from('project_members')
        .insert([{
          project_id: projectId,
          user_id: selectedUserId,
          role: 'member'
        }]);

      if (insertError) throw insertError;

      setIsInviting(false);
      setSelectedUserId('');
      fetchMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (userIdToRemove) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .match({ project_id: projectId, user_id: userIdToRemove });

      if (error) throw error;
      fetchMembers();
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove member');
    }
  };

  // Find current user's role to determine if they can invite/remove
  const currentUserRole = members.find(m => m.user_id === user.id)?.role;
  const isOwner = currentUserRole === 'owner';

  // Filter out users who are already members for the dropdown
  const availableUsers = allUsers.filter(u => !members.some(m => m.user_id === u.id));

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center bg-card rounded-xl border border-border">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <Users className="w-5 h-5 text-primary" />
          Collaborators
        </h3>
        {isOwner && (
          <button
            onClick={() => setIsInviting(!isInviting)}
            className="flex items-center gap-1 text-xs font-medium bg-primary text-primary-foreground px-2 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
          {error}
        </div>
      )}

      {isInviting && isOwner && (
        <form onSubmit={handleInvite} className="bg-secondary/30 p-3 rounded-lg border border-border flex gap-2 items-center">
          <select 
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 text-sm bg-background border border-input rounded-md px-2 py-1.5 focus:ring-1 focus:ring-primary"
            required
          >
            <option value="">Select a user...</option>
            {availableUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name || 'Unknown User'}
              </option>
            ))}
          </select>
          <button 
            type="submit" 
            disabled={inviteLoading || !selectedUserId}
            className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
          >
            {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.user_id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground border border-border">
                {member.role === 'owner' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.profiles?.full_name || 'Unknown User'}
                  {member.user_id === user.id && <span className="text-muted-foreground ml-1">(You)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  {member.role}
                </p>
              </div>
            </div>
            
            {isOwner && member.user_id !== user.id && (
              <button 
                onClick={() => handleRemove(member.user_id)}
                className="text-xs text-destructive hover:underline opacity-60 hover:opacity-100"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
