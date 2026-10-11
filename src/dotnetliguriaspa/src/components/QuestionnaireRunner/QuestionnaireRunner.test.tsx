import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import QuestionnaireRunner from './QuestionnaireRunner';
import PublicQuestionnaire from '../PublicQuestionnaire/PublicQuestionnaire';
import { API_BASE_URL } from '../../config/apiConfig';
import { QuestionnaireApiError } from '../../questionnaire/api';
import type { Question, Questionnaire } from '../../questionnaire/types';

const q = (id: string, type: Question['type'], title: string, extra: Partial<Question> = {}): Question =>
  ({ id, type, title, required: false, options: [], rows: [], settings: {}, ...extra });

function sample(extra: Partial<Questionnaire> = {}): Questionnaire {
  return {
    questionnaireId: 'q1', title: 'Feedback evento', status: 'Published', respondentMode: 'Anonymous', onePerEmail: false,
    displayMode: 'SinglePage', version: 3, createdAt: '', updatedAt: '', origin: 'Web', responseCount: 0,
    thankYouText: 'Grazie mille!',
    sections: [
      {
        id: 's1', title: 'Generale', questions: [
          q('overall', 'Rating', 'Voto complessivo', { required: true, settings: { max: 5 } }),
          q('again', 'YesNo', 'Torneresti?'),
          q('why', 'LongText', 'Perché no?', { required: true, visibleIf: { questionId: 'again', operator: 'Equals', value: 'false' } }),
        ],
      },
      {
        id: 's2', title: 'Sessioni', questions: [
          q('tracks', 'Matrix', 'Valuta le sessioni', { settings: { min: 1, max: 5 }, rows: [{ id: 't1', label: 'Keynote' }] }),
        ],
      },
    ],
    ...extra,
  };
}

describe('<QuestionnaireRunner />', () => {
  test('blocks submission until required visible questions are answered and sends a clean payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<QuestionnaireRunner questionnaire={sample()} onSubmit={onSubmit} draftKey="draft" />);

    expect(screen.queryByText('Perché no?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Invia' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('Risposta obbligatoria.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '4 stelle su 5' }));
    await user.click(screen.getByRole('button', { name: 'No' }));
    const why = await screen.findByRole('textbox', { name: /Perché no\?/ });
    await user.type(why, '  troppo lungo ');
    await user.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      respondent: null, consentGiven: false, website: '',
      answers: [
        { questionId: 'overall', number: 4 },
        { questionId: 'again', bool: false },
        { questionId: 'why', text: 'troppo lungo' },
      ],
    });
    expect(await screen.findByText('Grazie mille!')).toBeInTheDocument();
    expect(localStorage.getItem('draft')).toBeNull();
  });

  test('restores the local draft', () => {
    localStorage.setItem('draft', JSON.stringify({ again: { questionId: 'again', bool: false } }));
    render(<QuestionnaireRunner questionnaire={sample()} onSubmit={vi.fn()} draftKey="draft" />);
    expect(screen.getByText('Perché no?')).toBeInTheDocument();
  });

  test('stepper validates each page before moving forward', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRunner questionnaire={sample({ displayMode: 'Stepper' })} onSubmit={vi.fn()} />);

    expect(screen.queryByText('Valuta le sessioni')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(await screen.findByText('Risposta obbligatoria.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '5 stelle su 5' }));
    await user.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(await screen.findByText('Valuta le sessioni')).toBeInTheDocument();
    expect(screen.getByText('Passo 2 di 2')).toBeInTheDocument();
  });

  test('identified mode requires respondent data and consent and maps server conflicts', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new QuestionnaireApiError(409, { code: 'Duplicate', message: 'dup', errors: [] });
    });
    const questionnaire = sample({ respondentMode: 'Identified', onePerEmail: true, consentText: 'Accetto la privacy' });
    questionnaire.sections[0].questions[0].required = false;
    render(<QuestionnaireRunner questionnaire={questionnaire} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Invia' }));
    expect(await screen.findByText('Il nome è obbligatorio.')).toBeInTheDocument();
    expect(screen.getByText("È necessario accettare l'informativa.")).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Mario');
    await user.type(screen.getByRole('textbox', { name: 'Cognome' }), 'Rossi');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'mario@example.com');
    await user.click(screen.getByRole('checkbox', { name: 'Accetto la privacy' }));
    await user.click(screen.getByRole('button', { name: 'Invia' }));

    expect(await screen.findByText(/già ricevuto una risposta/)).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      consentGiven: true, respondent: { name: 'Mario', surname: 'Rossi', email: 'mario@example.com' },
    }));
  });

  test('links the privacy notice beside the consent without changing the checkbox name', () => {
    render(<QuestionnaireRunner questionnaire={sample({ respondentMode: 'Identified', consentText: 'Accetto la privacy' })} onSubmit={vi.fn()} />);
    const link = screen.getByRole('link', { name: /informativa sulla privacy/ });
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAccessibleName('informativa sulla privacy (si apre in una nuova scheda)');
    expect(screen.getByRole('checkbox', { name: 'Accetto la privacy' })).toBeInTheDocument();
  });

  test('anonymous questionnaires show neither consent nor privacy link', () => {
    render(<QuestionnaireRunner questionnaire={sample()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /privacy/ })).not.toBeInTheDocument();
  });

  test('preview mode validates without submitting', async () => {
    const user = userEvent.setup();
    const questionnaire = sample();
    questionnaire.sections[0].questions[0].required = false;
    render(<QuestionnaireRunner questionnaire={questionnaire} />);
    await user.click(screen.getByRole('button', { name: 'Prova invio' }));
    expect(await screen.findByText('Anteprima: risposta valida')).toBeInTheDocument();
  });
});

describe('<PublicQuestionnaire />', () => {
  const renderAt = (route: string) => render(
    <Routes>
      <Route path="/q/:questionnaireId" element={<PublicQuestionnaire />} />
      <Route path="/feedback/:workshopId" element={<PublicQuestionnaire />} />
    </Routes>,
    { route },
  );

  test('resolves the workshop alias and submits to the public endpoint', async () => {
    const user = userEvent.setup();
    const questionnaire = sample();
    questionnaire.sections[0].questions[0].required = false;
    mockApi({
      '/PublicQuestionnaire/q1/responses': { responseId: 'r1' },
      '/PublicQuestionnaire/by-workshop/w1': { questionnaireId: 'q1', title: 'Feedback evento', availability: 'Open', questionnaire },
    });
    renderAt('/feedback/w1');
    expect(await screen.findByRole('heading', { name: 'Feedback evento' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/PublicQuestionnaire/by-workshop/w1`, expect.anything());

    await user.click(screen.getByRole('button', { name: 'Invia' }));
    expect(await screen.findByText('Grazie mille!')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/PublicQuestionnaire/q1/responses`, expect.objectContaining({ method: 'POST' }));
  });

  test('explains closed and missing questionnaires', async () => {
    mockApi({ '/PublicQuestionnaire/q1': { questionnaireId: 'q1', title: 'Vecchio sondaggio', availability: 'Closed' } });
    const { unmount } = renderAt('/q/q1');
    const status = await screen.findByText(/è chiuso/);
    expect(within(status.closest('div')!.parentElement!).queryByRole('button')).not.toBeInTheDocument();
    unmount();

    mockApi({ '/PublicQuestionnaire/by-workshop/w2': () => jsonResponse({ code: 'NotFound', message: 'x', errors: [] }, 404) });
    renderAt('/feedback/w2');
    expect(await screen.findByText('Non ci sono questionari attivi per questo evento.')).toBeInTheDocument();
  });
});
