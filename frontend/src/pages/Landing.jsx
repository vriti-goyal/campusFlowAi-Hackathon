import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { CFButton, CFCard, CFBadge } from '@/components/ui';

const snippets = [
  {
    icon: Sparkles,
    title: 'AI campus briefings',
    description: 'Get a crisp summary of notices, events, and deadlines in one place.',
  },
  {
    icon: TrendingUp,
    title: 'Placement intelligence',
    description: 'Track hiring signals, role trends, and recruiter activity with clarity.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable student workflow',
    description: 'From assignments to exam prep, every update stays organized and actionable.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ffffff_0%,_#eef2ff_45%,_#f6f7ff_100%)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-white/40 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A68DF]">CampusFlow AI</p>
            <h1 className="text-lg font-semibold">Student Productivity Platform</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <CFButton variant="secondary" className="px-5">Login</CFButton>
            </Link>
            <Link to="/login">
              <CFButton className="px-5">Sign up</CFButton>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-14 pt-12 md:px-8">
        <section className="rounded-[28px] border border-white/50 bg-white/80 p-8 shadow-[0_18px_60px_rgba(106,104,223,0.12)] md:p-12">
          <CFBadge variant="default" className="mb-5 bg-[#6A68DF]/10 text-[#6A68DF]">Built for modern campuses</CFBadge>
          <h2 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
            One clear workspace for notices, academics, and placements.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[var(--text-secondary)] md:text-lg">
            CampusFlow AI helps students focus on outcomes by turning scattered updates into smart, timely actions.
          </p>
          <div className="mt-7">
            <Link to="/login">
              <CFButton className="gap-2">
                Get started
                <ArrowRight className="h-4 w-4" />
              </CFButton>
            </Link>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {snippets.map(({ icon: Icon, title, description }) => (
            <CFCard key={title} elevated className="rounded-[22px] p-6">
              <div className="mb-4 inline-flex rounded-xl bg-[#6A68DF]/10 p-3 text-[#6A68DF]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
            </CFCard>
          ))}
        </section>
      </main>
    </div>
  );
}
