import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Flag } from '../policy';
import { STAGE_LABEL, type Stage } from '../types';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
          <div className="flex gap-2">{actions}</div>
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-navy-800 text-white hover:bg-navy-700',
  secondary: 'border border-slate-300 bg-white text-ink-900 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-brand-600 hover:bg-brand-50',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    />
  );
}

const STAGE_TONE: Record<Stage, string> = {
  draft: 'bg-slate-100 text-slate-700',
  line_approval: 'bg-amber-100 text-amber-800',
  sourcing: 'bg-brand-100 text-brand-700',
  award_approval: 'bg-amber-100 text-amber-800',
  po_issued: 'bg-indigo-100 text-indigo-800',
  received: 'bg-sky-100 text-sky-800',
  match_exception: 'bg-red-100 text-red-700',
  payment_scheduled: 'bg-teal-100 text-teal-800',
  paid: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-emerald-600 text-white',
  rejected: 'bg-red-600 text-white',
  cancelled: 'bg-slate-400 text-white',
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

export function Pill({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue'; children: ReactNode }) {
  const t = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-brand-100 text-brand-700',
  }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function FlagList({ flags, compact = false }: { flags: Flag[]; compact?: boolean }) {
  if (!flags.length) return compact ? <Pill tone="green">Compliant</Pill> : <p className="text-sm text-emerald-700">No compliance flags.</p>;
  if (compact) {
    const high = flags.filter((f) => f.severity === 'high').length;
    return <Pill tone={high ? 'red' : 'amber'}>{flags.length} flag{flags.length > 1 ? 's' : ''}</Pill>;
  }
  return (
    <ul className="space-y-1.5">
      {flags.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.severity === 'high' ? 'bg-red-600' : f.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
          <span>{f.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'bad' }) {
  const c = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-navy-800';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4 pt-12" onMouseDown={onClose}>
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} rounded-xl bg-white shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-semibold text-navy-800">{title}</h3>
          <button onClick={onClose} className="text-xl leading-none text-ink-500 hover:text-ink-900" aria-label="Close">
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-ink-500">{children}</div>;
}

export function Bar({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="truncate pr-2 text-ink-700">{label}</span>
        <span className="font-medium text-ink-900">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-500" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}
