import React, { FC } from 'react';
import { Meter } from 'react-aria-components';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { OptionCount, ValueCount } from '../../questionnaire/types';

// Charts in the site's palette (navy and cyan on white, muted axes). Every chart is decorative (aria-hidden) and has
// the same numbers as text next to it: a table for screen readers, value labels on the bars, never colour alone.

const NAVY = 'var(--color-navy)';
const CYAN = 'var(--color-cyan-700)';
const MUTED = 'var(--color-muted)';
const LINE = 'var(--color-line)';

const percentOf = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

const tooltipStyle = { borderRadius: 12, border: '1px solid var(--color-line)', boxShadow: '0 8px 24px -12px rgb(8 61 115 / 0.35)', fontSize: 14 };

/** The numbers behind a chart, readable by assistive technology. */
function DataTable({ caption, head, rows }: { caption: string; head: [string, string, string]; rows: [string, number, string][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map(([label, count, share]) => <tr key={label}><th scope="row">{label}</th><td>{count}</td><td>{share}</td></tr>)}</tbody>
    </table>
  );
}

/** Bars of how many people chose each value of a scale. */
export const Distribution: FC<{ data: ValueCount[]; label: string; height?: number }> = ({ data, label, height = 180 }) => {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <figure>
      <div aria-hidden="true" style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -16 }} accessibilityLayer={false}>
            <CartesianGrid stroke={LINE} vertical={false} />
            <XAxis dataKey="value" tickLine={false} axisLine={{ stroke: LINE }} tick={{ fill: MUTED, fontSize: 13 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 13 }} />
            <Tooltip cursor={{ fill: 'var(--color-cyan-50)' }} contentStyle={tooltipStyle} formatter={v => [v, 'Risposte']} labelFormatter={l => `Valore ${l}`} />
            <Bar dataKey="count" fill={NAVY} radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
              <LabelList dataKey="count" position="top" fill={NAVY} fontSize={13} fontWeight={700} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption={label}
        head={['Valore', 'Risposte', 'Quota']}
        rows={data.map(d => [String(d.value), d.count, `${percentOf(d.count, total)}%`])}
      />
    </figure>
  );
};

const formatDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const formatLongDay = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('it-IT', { dateStyle: 'long' });

export const ResponsesPerDay: FC<{ data: { date: string; count: number }[] }> = ({ data }) => (
  <figure>
    <div aria-hidden="true" className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -16 }} accessibilityLayer={false}>
          <CartesianGrid stroke={LINE} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDay} tickLine={false} axisLine={{ stroke: LINE }} tick={{ fill: MUTED, fontSize: 13 }} minTickGap={16} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 13 }} />
          <Tooltip cursor={{ fill: 'var(--color-cyan-50)' }} contentStyle={tooltipStyle} formatter={v => [v, 'Risposte']} labelFormatter={l => formatLongDay(String(l))} />
          <Bar dataKey="count" fill={CYAN} radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            {data.length <= 14 && <LabelList dataKey="count" position="top" fill={CYAN} fontSize={13} fontWeight={700} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <DataTable
      caption="Risposte per giorno"
      head={['Giorno', 'Risposte', 'Quota']}
      rows={data.map(d => [formatLongDay(d.date), d.count, `${percentOf(d.count, data.reduce((sum, x) => sum + x.count, 0))}%`])}
    />
  </figure>
);

/** One bar per option, each with its count and share written out. */
export const OptionBars: FC<{ options: OptionCount[]; answered: number }> = ({ options, answered }) => (
  <ul className="space-y-3">
    {options.map(o => {
      const percent = percentOf(o.count, answered);
      return (
        <li key={o.optionId}>
          <div className="flex items-baseline justify-between gap-4">
            <span>{o.label}</span>
            <span className="shrink-0 text-muted tabular-nums">{o.count} ({percent}%)</span>
          </div>
          <Meter value={percent} aria-label={`${o.label}: ${percent}%`} className="mt-1">
            {({ percentage }) => (
              <div className="h-2.5 overflow-hidden rounded-full bg-cyan-50">
                <div className="h-full rounded-full bg-navy" style={{ width: `${percentage}%` }} />
              </div>
            )}
          </Meter>
        </li>
      );
    })}
  </ul>
);
