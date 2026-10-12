import React, { FC } from 'react';
import { SwitchInput } from '../../admin/ui';
import { Callout, DateTimeField, FieldText, groupHeading, RadioField } from './designerUi';
import { useDesignerStore } from './designerStore';
import type { Questionnaire } from '../../questionnaire/types';

const pad = (n: number) => String(n).padStart(2, '0');
export function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

export const DEFAULT_CONSENT_TEXT =
  'Acconsento al trattamento dei miei dati personali da parte di DotNetLiguria ai sensi del Regolamento UE 2016/679 (GDPR), al solo fine di gestire questo questionario.';

const QuestionnaireSettings: FC<{ workshopTitle?: string | null; errors: Record<string, string> }> = ({ workshopTitle, errors }) => {
  const q = useDesignerStore(s => s.questionnaire)!;
  const change = useDesignerStore(s => s.change);
  const set = (patch: Partial<Questionnaire>, key?: string) => change(d => { Object.assign(d, patch); }, key ? `settings:${key}` : undefined);
  const locked = q.responseCount > 0;

  return (
    <div className="space-y-4">
      <FieldText label="Titolo" isRequired maxLength={200} value={q.title} error={errors.title} onChange={title => set({ title }, 'title')} />
      <FieldText label="Descrizione" multiline rows={3} value={q.description ?? ''} onChange={description => set({ description: description || null }, 'description')} />
      <FieldText
        label="Messaggio introduttivo"
        multiline
        rows={3}
        value={q.introText ?? ''}
        description="Mostrato in evidenza sopra le domande."
        onChange={introText => set({ introText: introText || null }, 'intro')}
      />
      <FieldText
        label="Messaggio di ringraziamento"
        multiline
        rows={3}
        value={q.thankYouText ?? ''}
        placeholder="La tua risposta è stata registrata."
        onChange={thankYouText => set({ thankYouText: thankYouText || null }, 'thanks')}
      />
      {q.workshopId && (
        <Callout tone="info">
          Collegato {workshopTitle ? `all'evento «${workshopTitle}»` : 'a un evento'}: è raggiungibile anche da /feedback/{q.workshopId}.
        </Callout>
      )}

      <h3 className={groupHeading}>Impaginazione</h3>
      <RadioField
        label="Modalità di compilazione"
        value={q.displayMode}
        onChange={displayMode => set({ displayMode })}
        options={[
          { value: 'SinglePage', label: 'Pagina unica' },
          { value: 'Stepper', label: 'Una sezione per pagina' },
        ]}
      />

      <h3 className={groupHeading}>Rispondenti</h3>
      <RadioField
        label="Modalità rispondenti"
        value={q.respondentMode}
        isDisabled={locked}
        description={locked ? 'Non si può cambiare: il questionario ha già delle risposte.' : undefined}
        onChange={respondentMode => {
          const identified = respondentMode === 'Identified';
          set({ respondentMode, onePerEmail: identified && q.onePerEmail, consentText: identified ? q.consentText || DEFAULT_CONSENT_TEXT : q.consentText });
        }}
        options={[
          { value: 'Anonymous', label: 'Anonimi' },
          { value: 'Identified', label: 'Identificati', description: 'Nome, cognome ed email.' },
        ]}
      />
      {q.respondentMode === 'Identified' && (
        <>
          <SwitchInput isSelected={q.onePerEmail} onChange={onePerEmail => set({ onePerEmail })}>Una sola risposta per indirizzo email</SwitchInput>
          <FieldText
            label="Testo dell'informativa privacy (consenso obbligatorio)"
            multiline
            rows={4}
            value={q.consentText ?? ''}
            description="Se vuoto, non viene richiesto il consenso."
            onChange={consentText => set({ consentText: consentText || null }, 'consent')}
          />
        </>
      )}

      <h3 className={groupHeading}>Periodo di apertura</h3>
      <DateTimeField label="Apre il" value={toLocalInput(q.opensAt)} onChange={value => set({ opensAt: fromLocalInput(value) })} />
      <DateTimeField
        label="Chiude il"
        value={toLocalInput(q.closesAt)}
        error={errors.closesAt}
        description={errors.closesAt ? undefined : 'Facoltativo: dopo questa data le risposte non sono più accettate.'}
        onChange={value => set({ closesAt: fromLocalInput(value) })}
      />
    </div>
  );
};

export default QuestionnaireSettings;
