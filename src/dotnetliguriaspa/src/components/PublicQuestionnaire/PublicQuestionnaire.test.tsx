import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { useOidc } from '@axa-fr/react-oidc';
import userEvent from '@testing-library/user-event';
import { mockApi, render, screen } from '../../test-utils';
import PublicQuestionnaire from './PublicQuestionnaire';

test.each(['/q/q-login?from=qr#consenso', '/feedback/event?from=email#domande'])('questionnaire sign-in preserves exact return address %s', async route => {
  mockApi({
    '/PublicQuestionnaire/': {
      availability: 'Open',
      questionnaire: { questionnaireId: 'q-login', title: 'Feedback autenticato', respondentMode: 'Authenticated' },
    },
  });
  render(<Routes>
    <Route path="/q/:questionnaireId" element={<PublicQuestionnaire />} />
    <Route path="/feedback/:workshopId" element={<PublicQuestionnaire />} />
  </Routes>, { route });
  await userEvent.click(await screen.findByRole('button', { name: 'Accedi per compilare' }));
  expect(useOidc().login).toHaveBeenCalledWith(route);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/responses'))).toBe(false);
});
