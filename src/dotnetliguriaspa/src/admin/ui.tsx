import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, FieldError, Input, Label, Switch, Text, TextArea, TextField } from 'react-aria-components';
import { AdminIcon, AdminIconName } from './icons';

// Admin primitives in the public site's language (src/site): navy text, site-green primary action,
// cyan for links and focus, pills for actions, hairline panels on a cool page tint.
export const focusRing = 'outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-cyan-700';
export const linkFocus = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700';

const base = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';
export const btn = {
  primary: `${base} bg-site-green px-5 text-navy data-[hovered]:bg-[#66b024] data-[pressed]:bg-[#5c9f20] hover:bg-[#66b024] ${focusRing} ${linkFocus}`,
  secondary: `${base} border-2 border-navy px-5 text-navy data-[hovered]:bg-navy data-[hovered]:text-white hover:bg-navy hover:text-white ${focusRing} ${linkFocus}`,
  ghost: `${base} px-3 text-cyan-700 data-[hovered]:bg-cyan-50 hover:bg-cyan-50 ${focusRing} ${linkFocus}`,
  danger: `${base} bg-[#b42318] px-5 text-white data-[hovered]:bg-[#912018] hover:bg-[#912018] ${focusRing} ${linkFocus}`,
  icon: `inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors data-[hovered]:bg-cyan-50 data-[hovered]:text-navy hover:bg-cyan-50 hover:text-navy ${focusRing} ${linkFocus}`,
} as const;

export const tone = {
  done: 'bg-[#eef3f7] text-muted',
  planned: 'bg-cyan-50 text-cyan-700',
  ok: 'bg-basil-50 text-basil-700',
  warn: 'bg-[#fff4e5] text-[#8a4b00]',
  danger: 'bg-[#fdecea] text-[#b42318]',
} as const;

export function Badge({ kind, children }: { kind: keyof typeof tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold ${tone[kind]}`}>{children}</span>;
}

export function Panel({ children, className = '', labelledBy }: { children: React.ReactNode; className?: string; labelledBy?: string }) {
  return <section aria-labelledby={labelledBy} className={`rounded-2xl border border-line bg-white ${className}`}>{children}</section>;
}

export function PageHeader({ title, description, actions, back }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div>
      {back && (
        <Link to={back.to} className={`mb-2 inline-flex min-h-11 items-center gap-2 rounded-full font-semibold text-cyan-700 hover:underline ${linkFocus}`}>
          <AdminIcon name="back" />{back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-balance">{title}</h1>
          {description && <p className="mt-1 max-w-[65ch] text-lg text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon: AdminIconName; title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><AdminIcon name={icon} className="size-7" /></span>
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      {children && <div className="mt-1.5 max-w-[52ch] text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

/** A failed load says so and offers a retry: never shown as an empty list. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#fdecea] p-4 text-[#912018]">
      <AdminIcon name="todo" />
      <p className="min-w-0 flex-1">{message}</p>
      <Button onPress={onRetry} className={`${btn.secondary} border-[#912018] text-[#912018] data-[hovered]:bg-[#912018]`}>Riprova</Button>
    </div>
  );
}

const inputCls = 'w-full min-h-11 rounded-xl border border-line bg-white px-3.5 text-base text-navy placeholder:text-[#6b8399] transition-colors hover:border-cyan-200 outline-none focus:border-cyan-700 focus:ring-3 focus:ring-cyan-700/25 data-[invalid]:border-[#b42318]';

export function TextInput({ label, description, ...props }: React.ComponentProps<typeof TextField> & { label: string; description?: string; placeholder?: string; type?: string }) {
  const { placeholder, type, ...field } = props;
  return (
    <TextField {...field} className="block">
      <Label className="text-sm font-semibold text-navy">{label}{field.isRequired && <span className="text-[#b42318]" aria-hidden="true"> *</span>}</Label>
      <Input placeholder={placeholder} type={type} className={`mt-1.5 ${inputCls}`} />
      {description && <Text slot="description" className="mt-1.5 block text-sm text-muted">{description}</Text>}
      <FieldError className="mt-1.5 block text-sm font-semibold text-[#b42318]" />
    </TextField>
  );
}

export function TextAreaInput({ label, description, rows = 4, ...props }: React.ComponentProps<typeof TextField> & { label: string; description?: string; rows?: number; placeholder?: string }) {
  const { placeholder, ...field } = props;
  return (
    <TextField {...field} className="block">
      <Label className="text-sm font-semibold text-navy">{label}</Label>
      <TextArea rows={rows} placeholder={placeholder} className={`mt-1.5 py-2.5 leading-relaxed ${inputCls}`} />
      {description && <Text slot="description" className="mt-1.5 block text-sm text-muted">{description}</Text>}
      <FieldError className="mt-1.5 block text-sm font-semibold text-[#b42318]" />
    </TextField>
  );
}

export function SwitchInput({ children, ...props }: React.ComponentProps<typeof Switch> & { children: React.ReactNode }) {
  return (
    <Switch {...props} className={`group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl ${focusRing}`}>
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-[#c3d3df] transition-colors group-data-[selected]:bg-basil-700">
        <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform group-data-[selected]:translate-x-5" />
      </span>
      <span className="font-semibold">{children}</span>
    </Switch>
  );
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

/** Round portrait with initials when the photo is missing or fails to load. */
export function Avatar({ name, src, className = 'size-11 text-sm' }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = src && failed !== src;
  return (
    <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-cyan-50 font-bold text-cyan-700 ${className}`} aria-hidden="true">
      {showPhoto ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} className="size-full object-cover object-[50%_30%]" /> : initialsOf(name)}
    </span>
  );
}
