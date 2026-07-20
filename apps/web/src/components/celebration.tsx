'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { CONFETTI_COLORS, type Milestone } from '@todoer/shared';
import { registerCelebrationHandler } from '@/lib/celebration';

const PIECE_COUNT = 60;

interface Piece {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  round: boolean;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    left: Math.random() * 100,
    size: 8 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.5,
    duration: 2.2 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 200,
    spin: (Math.random() - 0.5) * 720,
    round: Math.random() > 0.5,
  }));
}

/**
 * Confetti and a congratulations card when a daily completion milestone
 * lands. Mounted once in the app shell; the complete task mutation reports
 * through the celebration bridge.
 */
export function Celebration() {
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const pieces = useMemo(() => (milestone ? makePieces() : []), [milestone]);

  useEffect(() => registerCelebrationHandler(setMilestone), []);

  useEffect(() => {
    if (!milestone) return;
    const timer = setTimeout(() => setMilestone(null), 3800);
    return () => clearTimeout(timer);
  }, [milestone]);

  if (!milestone) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/35"
      onClick={() => setMilestone(null)}
      role="status"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? '50%' : 2,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
      <div className="celebration-card flex flex-col items-center rounded-2xl bg-bg px-10 py-8 shadow-2xl">
        <span className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-brand">
          <Trophy className="h-7 w-7 text-white" />
        </span>
        <p className="mb-1.5 text-xl font-extrabold">{milestone.title}</p>
        <p className="text-sm text-fg-secondary">{milestone.message}</p>
      </div>
    </div>
  );
}
