import React from 'react';
import type { QuestionType } from '../../questionnaire/types';

// One outline glyph per question type, on the admin icon grid (24px, 1.75 stroke).
const GLYPHS: Record<QuestionType, React.ReactNode> = {
  ShortText: <><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 12h5" /></>,
  LongText: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h10M7 17h5" /></>,
  Email: <><circle cx="12" cy="12" r="3.5" /><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" /></>,
  SingleChoice: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" /></>,
  MultipleChoice: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>,
  YesNo: <><rect x="2.5" y="7" width="19" height="10" rx="5" /><circle cx="16.5" cy="12" r="2.6" fill="currentColor" stroke="none" /></>,
  Rating: <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />,
  Scale: <><path d="M3 12h18" /><path d="M5 8v8M12 9.5v5M19 8v8" /></>,
  Matrix: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" /></>,
  Number: <path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16" />,
  Date: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  InfoText: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" /></>,
};

export const QuestionTypeIcon = ({ type, className = 'size-5' }: { type: QuestionType; className?: string }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {GLYPHS[type]}
  </svg>
);
