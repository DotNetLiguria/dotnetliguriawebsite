import { accountReturnPath } from './returnPath';

test.each(['/', '/workshop/event', '/q/questionnaire', '/area-personale', '/admin/questionnaires'])('preserves local path, search and fragment %s', pathname => {
  expect(accountReturnPath({ pathname, search: '?source=email&x=%2F', hash: '#consenso' })).toBe(`${pathname}?source=email&x=%2F#consenso`);
});

test.each(['//external.example', '/\\external.example', 'https://external.example', 'relative'])('rejects unsafe login return target %s', pathname => {
  expect(accountReturnPath({ pathname, search: '', hash: '' })).toBe('/');
});
