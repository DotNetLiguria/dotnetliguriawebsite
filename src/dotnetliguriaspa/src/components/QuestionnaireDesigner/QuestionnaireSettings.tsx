import React, { FC } from 'react';
import {
  Alert, Divider, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Stack, Switch, TextField, Typography,
} from '@mui/material';
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
    <Stack spacing={2}>
      <TextField size="small" label="Titolo" required value={q.title} error={!!errors.title} helperText={errors.title}
        onChange={e => set({ title: e.target.value }, 'title')} slotProps={{ htmlInput: { maxLength: 200 } }} />
      <TextField size="small" label="Descrizione" multiline minRows={2} value={q.description ?? ''}
        onChange={e => set({ description: e.target.value || null }, 'description')} />
      <TextField size="small" label="Messaggio introduttivo" multiline minRows={2} value={q.introText ?? ''}
        helperText="Mostrato in evidenza sopra le domande." onChange={e => set({ introText: e.target.value || null }, 'intro')} />
      <TextField size="small" label="Messaggio di ringraziamento" multiline minRows={2} value={q.thankYouText ?? ''}
        placeholder="La tua risposta è stata registrata." onChange={e => set({ thankYouText: e.target.value || null }, 'thanks')} />
      {q.workshopId && (
        <Alert severity="info" sx={{ py: 0 }}>
          Collegato {workshopTitle ? `all'evento «${workshopTitle}»` : 'a un evento'}: è raggiungibile anche da /feedback/{q.workshopId}.
        </Alert>
      )}

      <Divider textAlign="left"><Typography variant="caption">Impaginazione</Typography></Divider>
      <FormControl>
        <FormLabel id="display-mode">Modalità di compilazione</FormLabel>
        <RadioGroup row aria-labelledby="display-mode" value={q.displayMode} onChange={e => set({ displayMode: e.target.value as Questionnaire['displayMode'] })}>
          <FormControlLabel value="SinglePage" control={<Radio />} label="Pagina unica" />
          <FormControlLabel value="Stepper" control={<Radio />} label="Una sezione per pagina" />
        </RadioGroup>
      </FormControl>

      <Divider textAlign="left"><Typography variant="caption">Rispondenti</Typography></Divider>
      <FormControl disabled={locked}>
        <RadioGroup aria-label="Modalità rispondenti" value={q.respondentMode}
          onChange={e => {
            const identified = e.target.value === 'Identified';
            set({ respondentMode: identified ? 'Identified' : 'Anonymous', onePerEmail: identified && q.onePerEmail, consentText: identified ? q.consentText || DEFAULT_CONSENT_TEXT : q.consentText });
          }}>
          <FormControlLabel value="Anonymous" control={<Radio />} label="Anonimi" />
          <FormControlLabel value="Identified" control={<Radio />} label="Identificati (nome, cognome, email)" />
        </RadioGroup>
      </FormControl>
      {q.respondentMode === 'Identified' && (
        <>
          <FormControlLabel label="Una sola risposta per indirizzo email"
            control={<Switch checked={q.onePerEmail} onChange={e => set({ onePerEmail: e.target.checked })} />} />
          <TextField size="small" label="Testo dell'informativa privacy (consenso obbligatorio)" multiline minRows={3}
            value={q.consentText ?? ''} onChange={e => set({ consentText: e.target.value || null }, 'consent')}
            helperText="Se vuoto, non viene richiesto il consenso." />
        </>
      )}

      <Divider textAlign="left"><Typography variant="caption">Periodo di apertura</Typography></Divider>
      <TextField size="small" type="datetime-local" label="Apre il" value={toLocalInput(q.opensAt)}
        onChange={e => set({ opensAt: fromLocalInput(e.target.value) })} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField size="small" type="datetime-local" label="Chiude il" value={toLocalInput(q.closesAt)} error={!!errors.closesAt}
        helperText={errors.closesAt ?? 'Facoltativo: dopo questa data le risposte non sono più accettate.'}
        onChange={e => set({ closesAt: fromLocalInput(e.target.value) })} slotProps={{ inputLabel: { shrink: true } }} />
    </Stack>
  );
};

export default QuestionnaireSettings;
