import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  LineChart,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CFButton, CFCard, CFBadge } from '@/components/ui';
import dashboardImage from '@/components/images/dashboard.png';
import dashmini from '@/components/images/dashmini.png';
import assignmentImage from '@/components/images/assignment.png';
import examImage from '@/components/images/exam.png';
import assistantImage from '@/components/images/assisstent.png';

const snippets = [
  {
    icon: Sparkles,
    title: 'AI Campus Briefings',
    description: 'Turn noisy notices into concise updates and get clear next actions in seconds.',
  },
  {
    icon: TrendingUp,
    title: 'Placement Intelligence',
    description: 'Track recruiter activity, role trends, and deadlines from one reliable view.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable Workflow',
    description: 'Assignments, exam prep, and planning stay structured, synced, and predictable.',
  },
];

const projectHighlights = [
  {
    title: 'Smart Dashboard',
    description:
      'View notices, deadlines, class tasks, and updates in one crisp operating dashboard.',
    image: dashboardImage,
    alt: 'CampusFlow AI dashboard preview',
  },
  {
    title: 'Assignment Tracker',
    description:
      'Track due dates, submissions, and completion with less context switching and fewer misses.',
    image: assignmentImage,
    alt: 'Assignment management view',
  },
  {
    title: 'Exam Planner',
    description:
      'Plan revision by timeline and topic priority so preparation stays focused and efficient.',
    image: examImage,
    alt: 'Exam planning module preview',
  },
  {
    title: 'AI Assistant',
    description:
      'Ask questions, summarize notices, and convert updates into next steps without leaving flow.',
    image: assistantImage,
    alt: 'AI assistant interface preview',
  },
];

const metrics = [
  { label: 'Student Tasks Managed', value: '150K+' },
  { label: 'Notice Response Time', value: '-42%' },
  { label: 'On-time Submissions', value: '+68%' },
];

const workflows = [
  { icon: CalendarCheck2, title: 'Plan', text: 'Capture classes, notices, and deadlines automatically.' },
  { icon: MessagesSquare, title: 'Understand', text: 'Use AI summaries to get what matters at a glance.' },
  { icon: LineChart, title: 'Execute', text: 'Track outcomes across academics and placement prep.' },
];

const socialProof = [
  'Top student clubs',
  'Placement cells',
  'Training partners',
  'Campus teams',
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f8ff] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#6A68DF]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#EFB995]/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#88c6ff]/20 blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-content-center rounded-2xl bg-[#6A68DF] text-lg font-semibold text-white">C</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6A68DF]">CampusFlow AI</p>
              <h1 className="text-sm font-medium text-[var(--text-secondary)]">Student OS for modern campuses</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <CFButton variant="secondary" className="px-5">Login</CFButton>
            </Link>
            <Link to="/login">
              <CFButton className="px-5 shadow-[0_10px_30px_rgba(106,104,223,0.35)]">Get Started</CFButton>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 pb-16 pt-12 md:px-8 md:pt-16">
        <section className="grid gap-6 rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(106,104,223,0.18)] md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div>
            <CFBadge variant="default" className="mb-5 bg-[#6A68DF]/10 text-[#6A68DF]">Built for high-performance students</CFBadge>
            <h2 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              Run your entire campus life from one intelligent workspace.
            </h2>
            <p className="mt-5 max-w-2xl text-base text-[var(--text-secondary)] md:text-lg">
              CampusFlow AI gives you a product-grade command center for academics, notices, and placements so nothing important slips through.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <CFButton className="gap-2">
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </CFButton>
              </Link>
              {/* <Link to="/login">
                <CFButton variant="secondary">Book Demo</CFButton>
              </Link> */}
            </div>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-[var(--border)] bg-white/85 p-4">
                  <p className="text-xl font-bold md:text-2xl">{metric.value}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <CFCard elevated className="relative overflow-hidden rounded-[28px] border-white/70 p-4 md:p-3">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white p-3">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Today at a glance</p>
                <p className="font-semibold">4 deadlines, 2 notices, 1 interview</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            {/* <div className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[#f7f8ff] p-2 pb-0"> */}
              <img
                src={dashmini}
                alt="CampusFlow AI dashboard"
                className="h-64 w-full rounded-xl object-contain object-top md:h-[320px]"
              />
            {/* </div> */}
            <div className=" grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[#f6f7ff] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Assignment due</p>
                <p className="mt-1 text-sm font-semibold">Machine Learning Lab</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[#f8fbff] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Placement prep</p>
                <p className="mt-1 text-sm font-semibold">Aptitude Round: 7 PM</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[#f8fbff] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Calendar</p>
                <p className="mt-1 text-sm font-semibold">Coming Events~</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[#f8fbff] p-3">
                <p className="text-xs text-[var(--text-secondary)]">Reminders</p>
                <p className="mt-1 text-sm font-semibold">Assigment Due: 5!!</p>
              </div>
            </div>
          </CFCard>
        </section>

        <section className="grid gap-3 rounded-3xl border border-white/70 bg-white/70 px-5 py-4 md:grid-cols-4 md:px-8">
          {socialProof.map((item) => (
            <div key={item} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">
              {item}
            </div>
          ))}
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {snippets.map(({ icon: Icon, title, description }) => (
            <CFCard key={title} elevated className="rounded-[24px] p-6">
              <div className="mb-4 inline-flex rounded-xl bg-[#6A68DF]/10 p-3 text-[#6A68DF]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
            </CFCard>
          ))}
        </section>

        <section className="rounded-[30px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_70px_rgba(106,104,223,0.1)] md:p-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <CFBadge variant="default" className="mb-4 bg-[#6A68DF]/10 text-[#6A68DF]">Product Highlights</CFBadge>
              <h3 className="text-2xl font-bold md:text-4xl">Everything students need in one elegant platform</h3>
              <p className="mt-3 max-w-3xl text-sm text-[var(--text-secondary)] md:text-base">
                Built like a top product: clean design, fast interactions, and tools that remove friction from everyday campus operations.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-secondary)]">
              <Clock3 className="h-4 w-4 text-[#6A68DF]" />
              Average daily save: 1.8 hours/student
            </div>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {projectHighlights.map(({ title, description, image, alt }) => (
              <CFCard key={title} elevated className="overflow-hidden rounded-[22px] p-0">
                <img src={image} alt={alt} className="h-52 w-full object-cover" />
                <div className="p-5">
                  <h4 className="text-lg font-semibold">{title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
                </div>
              </CFCard>
            ))}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {workflows.map(({ icon: Icon, title, text }) => (
            <CFCard key={title} elevated className="rounded-2xl border-white/70 p-6">
              <div className="mb-3 inline-flex rounded-lg bg-[#6A68DF]/10 p-2.5 text-[#6A68DF]">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-lg font-semibold">{title}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{text}</p>
            </CFCard>
          ))}
        </section>

        <section className="rounded-[30px] border border-[#6A68DF]/20 bg-gradient-to-br from-[#f4f3ff] via-[#fdf8f3] to-[#eef6ff] p-8 md:p-12">
          <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end">
            <div>
              <CFBadge variant="default" className="mb-4 bg-white text-[#6A68DF]">Ready to launch</CFBadge>
              <h3 className="text-3xl font-bold leading-tight md:text-5xl">
                Upgrade your campus workflow with a world-class student product.
              </h3>
              <p className="mt-4 max-w-2xl text-[var(--text-secondary)]">
                Join the next generation of students and teams using CampusFlow AI to stay organized, focused, and placement-ready.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/login">
                  <CFButton className="gap-2">
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </CFButton>
                </Link>
                <Link to="/login">
                  <CFButton variant="secondary">Explore Features</CFButton>
                </Link>
              </div>
            </div>
            <CFCard elevated className="rounded-3xl bg-white/90 p-6">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Student Feedback</p>
              <p className="mt-3 text-lg font-semibold">
                "This feels like using a real premium product for campus life. Everything is finally in one place."
              </p>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Vriti Prakash, Final Year BioTech</p>
            </CFCard>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-5 pb-8 md:px-8">
        <div className="flex flex-col items-start justify-between gap-2 border-t border-[var(--border)] pt-5 text-sm text-[var(--text-secondary)] md:flex-row md:items-center">
          <p>CampusFlow AI</p>
          <p>Designed for ambitious students, built for real campus outcomes.</p>
        </div>
      </footer>
    </div>
  );
}
