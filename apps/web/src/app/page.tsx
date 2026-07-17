import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-brand">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
          <span className="text-xl font-bold text-fg">Todoer</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-bg-hover"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Start for free
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl font-bold leading-tight tracking-tight">
          Clarity, finally.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-fg-secondary">
          Capture tasks the moment they hit you, organize them into projects,
          and know exactly what to do today. On the web and on Android, always
          in sync.
        </p>
        <Link
          href="/signup"
          className="mt-8 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-hover"
        >
          Get started, it&apos;s free
        </Link>
        <ul className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-fg-faint">
          <li>Natural language dates</li>
          <li>Recurring tasks</li>
          <li>Projects, sections and labels</li>
          <li>Realtime sync</li>
        </ul>
      </section>
    </main>
  );
}
