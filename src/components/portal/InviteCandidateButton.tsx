// /GlobalRX_v2/src/components/portal/InviteCandidateButton.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canInviteCandidates } from '@/lib/auth-utils';
import InviteCandidateDialog from '@/components/portal/InviteCandidateDialog';

/**
 * InviteCandidateButton Component
 *
 * Encapsulates the "Invite Candidate" button and associated dialog.
 * Handles its own permission check internally and returns null if
 * the user doesn't have permission.
 *
 * This component was created to avoid adding code to the dashboard
 * file which is already over the 500-line soft limit per Rule 10.
 */
export default function InviteCandidateButton() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check permission - return null if user can't invite candidates
  if (!user || !canInviteCandidates(user)) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        variant="default"
        className="gap-2"
      >
        <UserPlus className="h-4 w-4" />
        Invite Candidate
      </Button>

      <InviteCandidateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}