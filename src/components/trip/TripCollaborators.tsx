import { useState } from 'react';
import { UserPlus, Mail, Check, X, Crown, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Collaborator {
  id: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
}

interface TripCollaboratorsProps {
  tripId: string;
  isOwner: boolean;
  collaborators: Collaborator[];
  onRefresh: () => void;
}

const roleIcons = {
  viewer: Eye,
  editor: Edit,
  admin: Crown,
};

const roleColors = {
  viewer: 'bg-blue-500/10 text-blue-500',
  editor: 'bg-green-500/10 text-green-500',
  admin: 'bg-purple-500/10 text-purple-500',
};

export function TripCollaborators({ 
  tripId, 
  isOwner, 
  collaborators, 
  onRefresh 
}: TripCollaboratorsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleInvite = async () => {
    if (!email || !user) return;

    setLoading(true);
    try {
      // Check if already invited
      const { data: existing } = await supabase
        .from('trip_collaborators')
        .select('id')
        .eq('trip_id', tripId)
        .eq('email', email)
        .single();

      if (existing) {
        toast.error('This person is already invited');
        return;
      }

      const { error } = await supabase
        .from('trip_collaborators')
        .insert({
          trip_id: tripId,
          email: email.toLowerCase(),
          role,
          user_id: user.id, // Will be updated when they accept
          invited_by: user.id,
        });

      if (error) throw error;

      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      onRefresh();
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (collaboratorId: string) => {
    try {
      const { error } = await supabase
        .from('trip_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;
      toast.success('Collaborator removed');
      onRefresh();
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast.error('Failed to remove collaborator');
    }
  };

  const handleUpdateRole = async (collaboratorId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('trip_collaborators')
        .update({ role: newRole })
        .eq('id', collaboratorId);

      if (error) throw error;
      toast.success('Role updated');
      onRefresh();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite
          {collaborators.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {collaborators.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trip Collaborators</DialogTitle>
          <DialogDescription>
            Invite friends to view or edit this trip together.
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <div className="flex gap-2">
            <Input
              placeholder="friend@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as 'viewer' | 'editor')}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={loading || !email}>
              <Mail className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-3 mt-4">
          {collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No collaborators yet. Invite someone to plan together!
            </p>
          ) : (
            collaborators.map((collab) => {
              const RoleIcon = roleIcons[collab.role];
              return (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {collab.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{collab.email}</p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${roleColors[collab.role]}`}
                        >
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {collab.role}
                        </Badge>
                        {collab.status === 'pending' && (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <Select
                        value={collab.role}
                        onValueChange={(v) => handleUpdateRole(collab.id, v)}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemove(collab.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component to accept/decline invitations
export function PendingInvitations() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const { user } = useAuth();

  const fetchInvitations = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('trip_collaborators')
      .select(`
        *,
        trips:trip_id (destination, start_date, end_date)
      `)
      .eq('status', 'pending')
      .or(`user_id.eq.${user.id},email.eq.${user.email}`);

    if (data) setInvitations(data);
  };

  const handleRespond = async (invitationId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('trip_collaborators')
        .update({
          status: accept ? 'accepted' : 'declined',
          accepted_at: accept ? new Date().toISOString() : null,
          user_id: user?.id,
        })
        .eq('id', invitationId);

      if (error) throw error;
      toast.success(accept ? 'Invitation accepted!' : 'Invitation declined');
      fetchInvitations();
    } catch (error) {
      console.error('Error responding to invitation:', error);
      toast.error('Failed to respond to invitation');
    }
  };

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-2 p-4 bg-muted rounded-lg">
      <h3 className="font-semibold">Pending Invitations</h3>
      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between p-3 bg-background rounded border">
          <div>
            <p className="font-medium">{inv.trips?.destination}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(inv.trips?.start_date).toLocaleDateString()} - {new Date(inv.trips?.end_date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleRespond(inv.id, true)}>
              <Check className="h-4 w-4 mr-1" /> Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleRespond(inv.id, false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
