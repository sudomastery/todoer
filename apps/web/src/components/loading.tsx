import clsx from 'clsx';

/**
 * Placeholder rows shaped like real task cards, so the layout does not jump
 * when the data lands. Uses the same rounded card styling as TaskItem.
 */
export function TaskListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('animate-pulse', className)} aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="mb-2 flex items-start gap-2.5 rounded-xl border border-border-default bg-bg-card px-3 py-3 shadow-sm"
        >
          <div className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full bg-bg-hover" />
          <div className="min-w-0 flex-1">
            <div
              className="h-3.5 rounded bg-bg-hover"
              style={{ width: `${[68, 52, 78, 44, 61][i % 5]}%` }}
            />
            <div className="mt-2 flex gap-2">
              <div className="h-2.5 w-16 rounded bg-bg-hover" />
              <div className="h-2.5 w-10 rounded bg-bg-hover" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Simple list-shaped placeholder for sidebar-style lists such as labels. */
export function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 border-b border-border-default py-3">
          <div className="h-4 w-4 rounded bg-bg-hover" />
          <div className="h-3 rounded bg-bg-hover" style={{ width: `${[40, 28, 34][i % 3]}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Brand-colored spinner for buttons and inline waits. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-brand border-r-transparent',
        className ?? 'h-4 w-4',
      )}
    />
  );
}
