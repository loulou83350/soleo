'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  inviteTeamMember,
  removeTeamMember,
  updateMemberRole,
  cancelInvitation,
} from '@/app/(login)/actions';
import { UserPlus, Trash2, Shield, Clock, User } from 'lucide-react';
import type { TeamMemberWithUser, PendingInvitation } from '@/lib/db/queries';

// ─── Role badge ────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isOwner = role === 'owner';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isOwner
          ? 'bg-foreground/10 text-foreground'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {isOwner && <Shield className="h-3 w-3" />}
      {isOwner ? 'Admin' : 'Membre'}
    </span>
  );
}

// ─── Invite form ───────────────────────────────────────────────────────────
function InviteMemberForm({
  onInvited,
}: {
  onInvited: (inv: PendingInvitation) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'owner'>('member');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.append('email', email);
    fd.append('role', role);

    startTransition(async () => {
      const result = await inviteTeamMember({}, fd);
      if ('error' in result && result.error) {
        setError(result.error);
      } else {
        toast.success(`Invitation envoyée à ${email}`);
        setEmail('');
        setRole('member');
        // Optimistic: add to pending list with a temporary id
        onInvited({
          id: Date.now(),
          email,
          role,
          invitedAt: new Date(),
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Label htmlFor="invite-email" className="sr-only">
            Adresse email
          </Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@entreprise.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
          />
        </div>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as 'member' | 'owner')}
          disabled={isPending}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Membre</SelectItem>
            <SelectItem value="owner">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isPending} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" />
          {isPending ? 'Envoi…' : 'Inviter'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

// ─── Remove member dialog ──────────────────────────────────────────────────
function RemoveMemberDialog({
  member,
  onClose,
  onRemoved,
}: {
  member: TeamMemberWithUser;
  onClose: () => void;
  onRemoved: (memberId: number) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const fd = new FormData();
    fd.append('memberId', String(member.id));
    startTransition(async () => {
      const result = await removeTeamMember({}, fd);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${member.user.name ?? member.user.email} a été retiré(e)`);
        onRemoved(member.id);
        onClose();
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirer ce membre ?</DialogTitle>
          <DialogDescription>
            <strong>{member.user.name ?? member.user.email}</strong> perdra
            immédiatement accès à l'espace de travail. Cette action est
            irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Suppression…' : 'Retirer le membre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role change dialog ────────────────────────────────────────────────────
function RoleChangeDialog({
  member,
  onClose,
  onUpdated,
}: {
  member: TeamMemberWithUser;
  onClose: () => void;
  onUpdated: (memberId: number, newRole: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<'member' | 'owner'>(
    member.role as 'member' | 'owner'
  );

  function handleSave() {
    const fd = new FormData();
    fd.append('memberId', String(member.id));
    fd.append('role', role);
    startTransition(async () => {
      const result = await updateMemberRole({}, fd);
      if ('error' in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success('Rôle mis à jour');
        onUpdated(member.id, role);
        onClose();
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le rôle</DialogTitle>
          <DialogDescription>
            Changer le rôle de{' '}
            <strong>{member.user.name ?? member.user.email}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label htmlFor="role-select" className="mb-2 block text-sm">
            Nouveau rôle
          </Label>
          <Select
            value={role}
            onValueChange={(v) => setRole(v as 'member' | 'owner')}
          >
            <SelectTrigger id="role-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Membre</SelectItem>
              <SelectItem value="owner">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isPending || role === member.role}>
            {isPending ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export function MembersClient({
  currentUserId,
  initialMembers,
  initialInvitations,
}: {
  currentUserId: number;
  initialMembers: TeamMemberWithUser[];
  initialInvitations: PendingInvitation[];
}) {
  const [members, setMembers] =
    useState<TeamMemberWithUser[]>(initialMembers);
  const [invitations, setInvitations] =
    useState<PendingInvitation[]>(initialInvitations);
  const [removingMember, setRemovingMember] =
    useState<TeamMemberWithUser | null>(null);
  const [editingMember, setEditingMember] =
    useState<TeamMemberWithUser | null>(null);

  function handleMemberRemoved(memberId: number) {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  function handleRoleUpdated(memberId: number, newRole: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
  }

  function handleInvited(inv: PendingInvitation) {
    setInvitations((prev) => [inv, ...prev]);
  }

  async function handleCancelInvitation(invId: number) {
    const fd = new FormData();
    fd.append('invitationId', String(invId));
    const result = await cancelInvitation({}, fd);
    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Invitation annulée');
      setInvitations((prev) => prev.filter((i) => i.id !== invId));
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Membres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les membres de votre espace de travail et leurs permissions.
        </p>
      </div>

      {/* Invite section */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Inviter un membre
        </h2>
        <InviteMemberForm onInvited={handleInvited} />
      </section>

      {/* Active members */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Membres actifs{' '}
          <span className="text-muted-foreground font-normal">
            ({members.length})
          </span>
        </h2>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aucun membre dans cet espace.
          </p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-4 py-3 gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.user.name ?? member.user.email}
                    </p>
                    {member.user.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {member.user.email}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Membre depuis{' '}
                      {new Date(member.joinedAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RoleBadge role={member.role} />
                  {member.user.id !== currentUserId && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingMember(member)}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemovingMember(member)}
                        aria-label={`Retirer ${member.user.name ?? member.user.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            Invitations en attente{' '}
            <span className="text-muted-foreground font-normal">
              ({invitations.length})
            </span>
          </h2>
          <div className="border border-border rounded-lg divide-y divide-border">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-3 gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invitée le{' '}
                      {new Date(inv.invitedAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RoleBadge role={inv.role} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancelInvitation(inv.id)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dialogs */}
      {removingMember && (
        <RemoveMemberDialog
          member={removingMember}
          onClose={() => setRemovingMember(null)}
          onRemoved={handleMemberRemoved}
        />
      )}
      {editingMember && (
        <RoleChangeDialog
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onUpdated={handleRoleUpdated}
        />
      )}
    </div>
  );
}
