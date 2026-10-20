import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { render, screen, within } from '../../test-utils';
import { AdminToastRegion } from '../toasts';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture } from './eventFixtures';

export const renderAt = (hash: string) => render(
  <>
    <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route: `/admin/workshop/w1${hash}` },
);

export const loaded = () => screen.findByRole('heading', { level: 1, name: 'Modifica evento - Test Workshop' });
export const registration = () => screen.getByRole('region', { name: 'Iscrizione e dettagli dei partecipanti' });
export const schedule = () => screen.getByRole('region', { name: 'Orari della track' });
export const createForm = () => screen.getByRole('group', { name: 'Crea un talk' });
export const poolList = () => screen.getByRole('list', { name: 'Talk nel pool' });
export const rowOf = (title: string) => screen.getByRole('heading', { level: 4, name: title }).closest('li') as HTMLElement;
export const valuesOf = (inputs: HTMLElement[]) => inputs.map(input => (input as HTMLInputElement).value);
export const starts = () => valuesOf(within(schedule()).getAllByLabelText('Ora di inizio'));
export const ends = () => valuesOf(within(schedule()).getAllByLabelText('Ora di fine'));
export const twoTalks = () => eventFixture({
  agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main stage', order: 0 }],
  talks: [
    { workshopTalkId: 'talk-1', title: 'First talk', sessionType: 'talk', speakers: [{ workshopSpeakerId: 'speaker-1', name: 'Ada Lovelace' }] },
    { workshopTalkId: 'talk-2', title: 'Second talk', sessionType: 'talk', speakers: [] },
  ],
});
export const ready = () => eventFixture({
  eventbriteTicketCapacity: 25,
  agendaTracks: [{ workshopAgendaTrackId: 'track-1', name: 'Main', order: 0 }],
  agendaItems: [{ workshopAgendaItemId: 'item-1', itemType: 'service', trackId: 'track-1', startTime: '2024-03-15T09:00:00Z', endTime: '2024-03-15T10:00:00Z' }],
});
