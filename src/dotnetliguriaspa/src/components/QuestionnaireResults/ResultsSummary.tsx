import React, { FC, useEffect, useId, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { Panel, btn } from '../../admin/ui';
import { Distribution, OptionBars } from './ResultsCharts';
import { fillDistribution } from './responsesModel';
import { formatDateTime } from '../../questionnaire/format';
import { scaleBounds } from '../../questionnaire/rules';
import type { Question, QuestionStatistics } from '../../questionnaire/types';

const TEXT_PAGE = 20;
const number = (value: number) => value.toLocaleString('it-IT');

/** Written answers, newest batch first as the API sends them; a search term narrows them and "Mostra altre" pages them. */
export const TextAnswers: FC<{ answers: QuestionStatistics['textAnswers']; filter: string }> = ({ answers, filter }) => {
  const [limit, setLimit] = useState(TEXT_PAGE);
  const list = useRef<HTMLUListElement>(null);
  const revealFrom = useRef<number | null>(null);
  const needle = filter.trim().toLowerCase();
  const visible = needle ? answers.filter(a => a.text.toLowerCase().includes(needle)) : answers;

  // Paging adds rows below the button: move focus to the first new one so a keyboard user keeps reading from there.
  useEffect(() => {
    if (revealFrom.current === null) return;
    (list.current?.children[revealFrom.current] as HTMLElement | undefined)?.focus();
    revealFrom.current = null;
  }, [limit]);

  if (visible.length === 0) return <p className="text-muted">{needle ? 'Nessuna risposta corrisponde alla ricerca.' : 'Nessuna risposta.'}</p>;
  return (
    <>
      <ul ref={list} className="divide-y divide-line">
        {visible.slice(0, limit).map((a, index) => (
          <li key={`${a.responseId}-${index}`} tabIndex={-1} className="py-2.5 outline-none first:pt-0">
            <p className="whitespace-pre-wrap">{a.text}</p>
            <p className="text-sm text-muted">{formatDateTime(a.submittedAt)}</p>
          </li>
        ))}
      </ul>
      {visible.length > limit && (
        <Button onPress={() => { revealFrom.current = limit; setLimit(l => l + TEXT_PAGE); }} className={`${btn.ghost} mt-2`}>
          Mostra altre ({visible.length - limit})
        </Button>
      )}
    </>
  );
};

export const QuestionResult: FC<{ stats: QuestionStatistics; question?: Question; total: number; filter: string }> = ({ stats, question, total, filter }) => {
  const choice = stats.type === 'SingleChoice' || stats.type === 'MultipleChoice' || stats.type === 'YesNo';
  const bounds = question && (stats.type === 'Rating' || stats.type === 'Scale' || stats.type === 'Matrix') ? scaleBounds(question) : null;
  const title = stats.title || '(senza titolo)';
  const headingId = useId();
  return (
    <Panel className="p-5 sm:p-6" labelledBy={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="min-w-0 flex-1 text-lg font-bold leading-snug">{title}</h3>
        <p className="text-sm text-muted tabular-nums">{stats.answeredCount} / {total} risposte</p>
      </div>
      <div className="mt-4">
        {(stats.type === 'Rating' || stats.type === 'Scale') && (
          <>
            {stats.average != null && <p className="text-2xl font-bold tabular-nums">Media {number(stats.average)}</p>}
            <Distribution data={fillDistribution(stats.distribution, bounds)} label={`Distribuzione delle risposte a: ${title}`} />
          </>
        )}
        {stats.type === 'Number' && (
          <p>{stats.average != null ? `Media ${number(stats.average)} · min ${stats.min} · max ${stats.max}` : 'Nessuna risposta.'}</p>
        )}
        {choice && <OptionBars options={stats.options} answered={stats.answeredCount} />}
        {choice && stats.textAnswers.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h4 className="mb-2 font-bold">{question?.settings.otherLabel ?? 'Altro'}: risposte libere</h4>
            <TextAnswers answers={stats.textAnswers} filter={filter} />
          </div>
        )}
        {stats.type === 'Matrix' && (
          <ul className="divide-y divide-line">
            {stats.rows.map(row => (
              <li key={row.rowId} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h4 className="min-w-0 flex-1 font-bold">{row.label}</h4>
                  <p className="text-sm text-muted tabular-nums">
                    {row.average != null ? `media ${number(row.average)} · ` : ''}{row.answeredCount} risposte
                  </p>
                </div>
                <Distribution data={fillDistribution(row.distribution, bounds)} label={`Distribuzione delle risposte a: ${row.label}`} height={120} />
              </li>
            ))}
          </ul>
        )}
        {['ShortText', 'LongText', 'Email', 'Date'].includes(stats.type) && <TextAnswers answers={stats.textAnswers} filter={filter} />}
      </div>
    </Panel>
  );
};
