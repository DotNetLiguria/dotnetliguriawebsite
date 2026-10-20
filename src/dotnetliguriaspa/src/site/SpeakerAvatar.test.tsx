import React from 'react';
import { fireEvent, render, screen } from '../test-utils';
import SpeakerAvatar from './SpeakerAvatar';

vi.mock('virtual:content-photos', () => ({ default: ['speakers/ada_lovelace.jpg'] }));

test('managed removal never falls back to shipped legacy portraits', () => {
  const view = render(<SpeakerAvatar name="Ada Lovelace" profileImageUrl="/api/media/photos/a.webp" photoFallbackDisabled />);
  const photo = view.container.querySelector('img')!;
  expect(photo).toHaveAttribute('src', expect.stringMatching(/\/api\/media\/photos\/a\.webp$/));
  fireEvent.error(photo);
  expect(view.container.querySelector('img')).not.toBeInTheDocument();
  expect(screen.getByText('AL')).toBeInTheDocument();
  view.rerender(<SpeakerAvatar name="Ada Lovelace" profileImageUrl={null} photoFallbackDisabled />);
  expect(view.container.querySelector('img')).not.toBeInTheDocument();
});

test('resets failed source indices when the selected URL changes', () => {
  const view = render(<SpeakerAvatar name="Ada Lovelace" profileImageUrl="/api/media/photos/old.webp" photoFallbackDisabled />);
  fireEvent.error(view.container.querySelector('img')!);
  expect(view.container.querySelector('img')).not.toBeInTheDocument();
  view.rerender(<SpeakerAvatar name="Ada Lovelace" profileImageUrl="/api/media/photos/new.webp" photoFallbackDisabled />);
  expect(view.container.querySelector('img')).toHaveAttribute('src', expect.stringMatching(/\/api\/media\/photos\/new\.webp$/));
});
