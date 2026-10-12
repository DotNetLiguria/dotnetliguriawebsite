import React, { FC } from 'react';
import { Button } from 'react-aria-components';
import { AdminIcon } from '../../admin/icons';
import { btn, focusRing } from '../../admin/ui';
import { ModalHeader, RecordModal } from '../../admin/pages/listUi';
import { Callout } from './designerUi';
import { allQuestions } from '../../questionnaire/rules';
import type { Questionnaire, QuestionnaireValidationError } from '../../questionnaire/types';

export interface PublishDialogProps {
  open: boolean;
  questionnaire: Questionnaire;
  errors: QuestionnaireValidationError[];
  busy: boolean;
  /** Failure of the last publish attempt, shown where the person is looking. */
  error?: string | null;
  onClose: () => void;
  onPublish: () => void;
  onGoTo: (questionId: string | null) => void;
}

const PublishDialog: FC<PublishDialogProps> = ({ open, questionnaire, errors, busy, error, onClose, onPublish, onGoTo }) => {
  const questions = allQuestions(questionnaire);
  const describe = (e: QuestionnaireValidationError) => {
    if (!e.questionId) return 'Impostazioni del questionario';
    const index = questions.findIndex(q => q.id === e.questionId);
    return index >= 0 ? `Domanda ${index + 1}: ${questions[index].title || '(senza titolo)'}` : 'Domanda';
  };
  const answerable = questions.filter(q => q.type !== 'InfoText').length;

  return (
    <RecordModal isOpen={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }} label="Pubblica il questionario">
      <ModalHeader title="Pubblica il questionario" />
      <div className="space-y-4 p-5 sm:p-6">
        {errors.length === 0 ? (
          <>
            <Callout tone="ok" role="status" icon={<AdminIcon name="check" />}>
              <p className="font-bold">Tutto pronto: {answerable} {answerable === 1 ? 'domanda verificata' : 'domande verificate'}.</p>
            </Callout>
            <p className="leading-relaxed text-muted">
              Dopo la pubblicazione il questionario è raggiungibile dal link pubblico
              {questionnaire.opensAt ? ' a partire dalla data di apertura' : ''}. Con la prima risposta la struttura si blocca:
              potrai ancora correggere i testi, ma non aggiungere o rimuovere domande.
            </p>
          </>
        ) : (
          <>
            <Callout tone="warn" role="status" icon={<AdminIcon name="todo" />}>
              <p className="font-bold">Correggi {errors.length === 1 ? 'questo punto' : 'questi punti'} prima di pubblicare ({errors.length}).</p>
              <p className="text-sm">Scegli una voce per andare dove correggerla.</p>
            </Callout>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {errors.map((e, i) => (
                <li key={`${e.questionId}-${e.field}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onGoTo(e.questionId ?? null)}
                    className={`flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-cyan-50/60 ${focusRing}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{e.message}</span>
                      <span className="block text-sm text-muted">{describe(e)}</span>
                    </span>
                    <AdminIcon name="arrow" className="size-4 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <Callout tone="danger" role="alert">{error}</Callout>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button slot="close" className={btn.ghost}>Annulla</Button>
          <Button isDisabled={errors.length > 0 || busy} onPress={onPublish} className={btn.primary}>{busy ? 'Pubblicazione…' : 'Pubblica'}</Button>
        </div>
      </div>
    </RecordModal>
  );
};

export default PublishDialog;
