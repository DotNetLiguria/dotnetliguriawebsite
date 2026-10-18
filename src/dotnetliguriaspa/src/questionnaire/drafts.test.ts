import { clearPrivateBrowserState, discardDraft, loadDraft, saveDraft } from './drafts';

afterEach(() => vi.restoreAllMocks());

test('drafts expire after thirty minutes without using persistent storage', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const answers = { q: { questionId: 'q', text: 'synthetic answer' } };
  saveDraft('draft', answers);
  expect(localStorage.getItem('draft')).toBeNull();
  expect(loadDraft('draft')).toEqual(answers);
  now.mockReturnValue(1_000_000 + 30 * 60 * 1000);
  expect(loadDraft('draft')).toEqual({});
  expect(sessionStorage.getItem('draft')).toBeNull();
});

test('legacy persistent answers are discarded instead of migrated', () => {
  localStorage.setItem('draft', '{"q":{"text":"synthetic"}}');
  expect(loadDraft('draft')).toEqual({});
  expect(localStorage.getItem('draft')).toBeNull();
});

test('logout removes only private application state', () => {
  localStorage.setItem('ACCESS_TOKEN', 'synthetic');
  localStorage.setItem('questionnaire-draft:q', 'synthetic');
  sessionStorage.setItem('questionnaire-draft:q', 'synthetic');
  localStorage.setItem('unrelated', 'keep');
  clearPrivateBrowserState();
  expect(localStorage.getItem('ACCESS_TOKEN')).toBeNull();
  expect(sessionStorage.getItem('questionnaire-draft:q')).toBeNull();
  expect(localStorage.getItem('questionnaire-draft:q')).toBeNull();
  expect(localStorage.getItem('unrelated')).toBe('keep');
  discardDraft('draft');
});

test('startup removes legacy persistence without destroying an anonymous session draft', () => {
  saveDraft('questionnaire-draft:q', { q: { questionId: 'q', text: 'synthetic' } });
  localStorage.setItem('ACCESS_TOKEN', 'synthetic');
  clearPrivateBrowserState(false);
  expect(loadDraft('questionnaire-draft:q').q?.text).toBe('synthetic');
  expect(localStorage.getItem('ACCESS_TOKEN')).toBeNull();
});

test('a different account cannot restore a prior account draft after reloading', () => {
  saveDraft('questionnaire-draft:q', { q: { questionId: 'q', text: 'synthetic' } }, 'issuer|first');
  expect(loadDraft('questionnaire-draft:q', 'issuer|second')).toEqual({});
  expect(sessionStorage.getItem('questionnaire-draft:q')).toBeNull();
});
