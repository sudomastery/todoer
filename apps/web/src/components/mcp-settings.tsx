'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui';

const REPO = 'https://github.com/sudomastery/todoer';

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions); user can select the text manually
    }
  }

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-secondary">{label}</span>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-fg-secondary hover:bg-bg-hover hover:text-fg"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border-default bg-bg-sidebar p-2.5 text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export function McpSettingsDialog({
  open,
  onOpenChange,
  login,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  login?: string | null;
}) {
  const [showSetup, setShowSetup] = useState(false);
  const who = login || 'your_username_or_email';

  const clone = `git clone ${REPO}\ncd todoer\nnpm install`;

  const claudeCode = [
    'claude mcp add todoer \\',
    `  --env TODOER_LOGIN=${who} \\`,
    '  --env TODOER_PASSWORD=your_password \\',
    '  -- npx tsx "$PWD/packages/mcp/src/index.ts"',
  ].join('\n');

  const desktop = JSON.stringify(
    {
      mcpServers: {
        todoer: {
          command: 'npx',
          args: ['tsx', '/absolute/path/to/todoer/packages/mcp/src/index.ts'],
          env: { TODOER_LOGIN: who, TODOER_PASSWORD: 'your_password' },
        },
      },
    },
    null,
    2,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="AI assistant" className="max-w-lg p-5">
        <h2 className="mb-1 text-base font-semibold">Connect an AI assistant</h2>
        <p className="mb-4 text-sm leading-relaxed text-fg-secondary">
          You can let an AI assistant manage your tasks by talking to it. Ask it to
          &quot;add buy milk tomorrow&quot; or &quot;what is due today?&quot; and it updates Todoer
          for you. The assistant signs in as you and only ever sees your own tasks.
        </p>

        <div className="mb-4 rounded-lg border border-border-default bg-bg-sidebar p-3">
          <p className="mb-2 text-xs font-semibold text-fg-secondary">What it can do</p>
          <ul className="space-y-1 text-sm text-fg-secondary">
            <li>Add, edit, complete, and delete tasks</li>
            <li>Organize projects, sections, and labels</li>
            <li>Leave comments and summarize what you finished</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => setShowSetup((v) => !v)}
          aria-expanded={showSetup}
          className="flex w-full items-center justify-between rounded-md border border-border-default px-3 py-2 text-sm font-medium hover:bg-bg-hover"
        >
          Learn how to set it up
          {showSetup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showSetup && (
          <div className="mt-4">
            <p className="mb-3 text-xs leading-relaxed text-fg-faint">
              Setup is a one-off and needs a terminal. Todoer ships an MCP server that any
              MCP-capable assistant (Claude Code, Claude Desktop, and others) can connect to.
            </p>
            <CodeBlock label="1. Get the server (once)" code={clone} />
            <CodeBlock label="2a. Claude Code (run inside the todoer folder)" code={claudeCode} />
            <CodeBlock label="2b. Or Claude Desktop: claude_desktop_config.json" code={desktop} />
            <p className="text-xs text-fg-faint">
              Task text supports the same quick add syntax as this app. Your password stays in
              your local MCP configuration and is only sent to Todoer&apos;s own backend.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
