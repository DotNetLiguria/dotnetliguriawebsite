import React from 'react';
import { Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import userEvent from '@testing-library/user-event';
import { mockApi, render, screen } from '../test-utils';
import HomePage from './home/HomePage';
import EventsPage from './events/EventsPage';
import EventDetailPage from './event/EventDetailPage';
import NotFoundPage from './notfound/NotFoundPage';
import PrivacyPage from './legal/PrivacyPage';
import TermsPage from './legal/TermsPage';
import CookiePolicyPage from './legal/CookiePolicyPage';
import PublicQuestionnaire from '../components/PublicQuestionnaire/PublicQuestionnaire';
import type { Question, Questionnaire } from '../questionnaire/types';

// axe on the rendered DOM (jsdom has no layout, so colour contrast is measured by Lighthouse instead, and the
// desktop and phone navigations both exist here because CSS does not hide one of them).
const OPTIONS: axe.RunOptions = { rules: { 'color-contrast': { enabled: false }, 'landmark-unique': { enabled: false } } };

async function expectNoViolations() {
  const results = await axe.run(document.body, OPTIONS);
  const summary = results.violations.map(v => `${v.id}: ${v.help}\n  ${v.nodes.map(n => n.html).join('\n  ')}`);
  expect(summary).toEqual([]);
}

const ID = '89d23964-f3cd-4ca8-9e65-d15251e0b6a1';
const workshop = {
  workshopId: ID, title: 'AI Generativa', description: 'Una giornata sulla AI generativa.', eventDate: '2099-03-15T00:00:00+01:00',
  image: '/workshops/workshop040/workshop.png', tags: 'AI, MCP', bookingServiceUrl: 'https://booking.example.test/1', attendeeNotes: 'Porta il portatile.',
  blogHtml: '<p>Approfondimento <strong>sicuro</strong></p>',
  location: { name: 'Confindustria', address: 'Via Minzoni 2,19100 La Spezia', coordinates: '44.1042,9.8220' },
  agendaTracks: [{ workshopAgendaTrackId: 'a', name: 'Sala grande', order: 0 }, { workshopAgendaTrackId: 'b', name: 'Sala piccola', order: 1 }],
  talks: [{ workshopTalkId: 't1', title: 'Strumenti utili', abstract: 'Lungo abstract. '.repeat(20), sessionType: 'workshop', speakers: [{ name: 'Ada Lovelace', biography: 'Matematica.' }] }],
  agendaItems: [
    { workshopAgendaItemId: 'i1', itemType: 'talk', talkId: 't1', trackId: 'a', roomName: 'Aula A', startTime: '2099-03-15T10:00:00Z', endTime: '2099-03-15T11:00:00Z' },
    { workshopAgendaItemId: 'i2', itemType: 'break', trackId: 'a', title: 'Pausa caffè', startTime: '2099-03-15T11:00:00Z', endTime: '2099-03-15T11:15:00Z' },
  ],
  materials: [{ workshopFileId: 'm1', title: 'Slide', fileName: 'slide.pdf', fullPath: '/workshops/workshop040/slide.pdf' }],
  photos: [{ workshopFileId: 'p1', title: '', fileName: 'foto.jpg', fullPath: '/workshops/workshop040/foto.jpg' }],
};
const board = [{ boardId: 'b1', name: 'Prima Persona', description: 'Presidente', order: 1, fullBio: 'Bio. '.repeat(60), twitterUrl: 'https://x.example.test/prima' }];
const menu = [{ name: 'Home', url: '/', isActive: true, order: 1 }, { name: 'Eventi passati', url: '/workshops', isActive: true, order: 2 }];

const q = (id: string, type: Question['type'], extra: Partial<Question> = {}): Question =>
  ({ id, type, title: `Domanda ${id}`, required: false, options: [], rows: [], settings: {}, helpText: 'Aiuto.', ...extra });
const questionnaire: Questionnaire = {
  questionnaireId: 'q1', title: 'Feedback evento', description: 'Dicci come è andata.', introText: 'Due minuti.', status: 'Published',
  respondentMode: 'Identified', onePerEmail: true, consentText: 'Accetto la privacy', displayMode: 'SinglePage',
  version: 1, createdAt: '', updatedAt: '', origin: 'Web', responseCount: 0,
  sections: [{
    id: 's1', title: 'Generale', description: 'Prima parte.', questions: [
      q('info', 'InfoText'), q('short', 'ShortText', { required: true, settings: { placeholder: 'Scrivi qui' } }), q('long', 'LongText'),
      q('email', 'Email'), q('num', 'Number', { settings: { min: 0, max: 10 } }), q('date', 'Date'), q('yn', 'YesNo'),
      q('single', 'SingleChoice', { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], settings: { allowOther: true } }),
      q('drop', 'SingleChoice', { options: [{ id: 'a', label: 'A' }], settings: { useDropdown: true } }),
      q('multi', 'MultipleChoice', { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], settings: { maxSelections: 1 } }),
      q('rating', 'Rating', { required: true, settings: { max: 5 } }), q('scale', 'Scale', { settings: { min: 0, max: 10, minLabel: 'Poco', maxLabel: 'Molto' } }),
      q('matrix', 'Matrix', { settings: { min: 1, max: 5 }, rows: [{ id: 'r1', label: 'Keynote', description: 'Apertura' }] }),
    ],
  }],
};

beforeEach(() => {
  document.documentElement.lang = 'it';
});

describe('public pages pass axe', () => {
  test('home with featured event, archive and team', async () => {
    const user = userEvent.setup();
    mockApi({ '/TopMenu': menu, '/Workshop/GetInHomePage/HomePage': workshop, '/Workshop/Get?onlyPublished=true': [workshop], '/Board/Get?onlyActive=true': board });
    render(<HomePage />);
    await screen.findByRole('region', { name: 'AI Generativa' });
    await screen.findByRole('button', { name: 'Leggi di più su Prima Persona' });
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await expectNoViolations();
  });

  test('events archive with the year filter', async () => {
    mockApi({ '/TopMenu': menu, '/Workshop/Get?onlyPublished=true': [workshop, { ...workshop, workshopId: 'w2', eventDate: '2024-05-07T00:00:00+02:00' }] });
    render(<Routes><Route path="/workshops" element={<EventsPage />} /></Routes>, { route: '/workshops' });
    await screen.findByRole('radiogroup', { name: 'Filtra per anno' });
    await expectNoViolations();
  });

  test('event detail with agenda, speakers, materials and photos', async () => {
    mockApi({ '/TopMenu': menu, [`/Workshop/Get/${ID}`]: workshop });
    render(<Routes><Route path="/workshop/:id" element={<EventDetailPage />} /></Routes>, { route: `/workshop/${ID}` });
    await screen.findByRole('region', { name: 'Relatori' });
    await expectNoViolations();
  });

  test('questionnaire with every question type, after a failed submission', async () => {
    const user = userEvent.setup();
    mockApi({ '/TopMenu': menu, '/PublicQuestionnaire/q1': { questionnaireId: 'q1', title: 'Feedback evento', availability: 'Open', questionnaire } });
    render(<Routes><Route path="/q/:questionnaireId" element={<PublicQuestionnaire />} /></Routes>, { route: '/q/q1' });
    await screen.findByRole('heading', { level: 1, name: 'Feedback evento' });
    await user.click(screen.getByRole('radio', { name: 'Altro' }));
    await user.click(screen.getByRole('button', { name: 'Invia' }));
    await screen.findByText('Il nome è obbligatorio.');
    await expectNoViolations();
  });

  test.each([
    ['/privacy', PrivacyPage],
    ['/termini-di-servizio', TermsPage],
    ['/cookie', CookiePolicyPage],
  ])('legal page %s, with the cookie notice', async (route, Page) => {
    mockApi({ '/TopMenu': menu });
    render(<Page />, { route });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('region', { name: 'Informativa sui cookie' })).toBeInTheDocument();
    await expectNoViolations();
  });

  test('not-found page', async () => {
    mockApi({ '/TopMenu': menu });
    render(<NotFoundPage />);
    await screen.findByRole('link', { name: 'Home' });
    await expectNoViolations();
  });
});
