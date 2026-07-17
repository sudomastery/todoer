'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import clsx from 'clsx';
import { X } from 'lucide-react';

// ============================================================
// Dialog
// ============================================================

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  children,
  className,
  title,
  hideClose,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <DialogPrimitive.Content
        className={clsx(
          'animate-in fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-border-strong bg-bg shadow-2xl focus:outline-none',
          className,
        )}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-fg-faint hover:bg-bg-hover hover:text-fg">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ============================================================
// Dropdown menu
// ============================================================

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  children,
  className,
  align = 'start',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={4}
        className={clsx(
          'animate-in z-50 min-w-48 rounded-lg border border-border-strong bg-bg p-1 shadow-xl',
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  className,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      className={clsx(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-bg-hover',
        danger ? 'text-p1' : 'text-fg',
        className,
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-border-default" />;
}

// ============================================================
// Popover
// ============================================================

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  children,
  className,
  align = 'start',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={4}
        className={clsx(
          'animate-in z-50 rounded-lg border border-border-strong bg-bg p-1 shadow-xl focus:outline-none',
          className,
        )}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

// ============================================================
// Tooltip
// ============================================================

export function WithTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 rounded-md bg-fg px-2 py-1 text-xs font-medium text-bg"
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ============================================================
// Small building blocks
// ============================================================

export function IconButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  label: string;
  className?: string;
}) {
  return (
    <WithTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={clsx(
          'rounded-md p-1.5 text-fg-faint hover:bg-bg-hover hover:text-fg-secondary',
          className,
        )}
      >
        {children}
      </button>
    </WithTooltip>
  );
}

export function Chip({
  children,
  onClick,
  active,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        active
          ? 'border-brand/40 bg-brand-light text-brand dark:bg-bg-active'
          : 'border-border-strong text-fg-secondary hover:bg-bg-hover',
        className,
      )}
    >
      {children}
    </button>
  );
}
