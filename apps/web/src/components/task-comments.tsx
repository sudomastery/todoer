'use client';

import { useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAddComment, useComments, useDeleteComment } from '@/lib/hooks';

/** Comment list + composer shown while editing an existing task. */
export function TaskComments({ taskId }: { taskId: string }) {
  const { data: comments } = useComments(taskId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [text, setText] = useState('');

  async function submit() {
    const content = text.trim();
    if (!content || addComment.isPending) return;
    await addComment.mutateAsync({ taskId, content });
    setText('');
  }

  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg-secondary">
        <MessageSquare className="h-3.5 w-3.5" />
        Comments{comments && comments.length > 0 ? ` (${comments.length})` : ''}
      </div>

      {(comments ?? []).map((c) => (
        <div key={c.id} className="group mb-2 flex items-start gap-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap break-words">{c.content}</p>
            <p className="mt-0.5 text-[11px] text-fg-faint">
              {new Date(c.created_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            aria-label="Delete comment"
            onClick={() => deleteComment.mutate({ id: c.id, taskId })}
            className="rounded p-1 text-fg-faint opacity-0 hover:bg-bg-hover hover:text-p1 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a comment"
          className="w-full rounded-md border border-border-default bg-bg px-2.5 py-1.5 text-sm outline-none placeholder:text-fg-faint focus:border-fg-faint"
        />
        <button
          type="button"
          aria-label="Add comment"
          disabled={!text.trim() || addComment.isPending}
          onClick={submit}
          className="rounded-md p-2 text-fg-secondary hover:bg-bg-hover hover:text-brand disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
