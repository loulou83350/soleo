'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplatePickerModal } from '@/components/TemplatePickerModal';

export function NewSessionButton({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="mr-2 h-4 w-4" />
        Nouvelle session
      </Button>

      {open && (
        <TemplatePickerModal
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
