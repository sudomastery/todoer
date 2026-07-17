'use client';

import { TaskEditor } from '@/components/task-editor';
import { Dialog, DialogContent } from '@/components/ui';

export function QuickAddDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add task" hideClose className="border-none bg-transparent shadow-none">
        <TaskEditor onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
