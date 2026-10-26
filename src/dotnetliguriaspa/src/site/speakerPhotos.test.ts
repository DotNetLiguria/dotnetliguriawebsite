import { profilePhotoUrl } from './speakerPhotos';

describe('profilePhotoUrl', () => {
  test('uses the URL selected by the API', () => {
    expect(profilePhotoUrl('/Contents/speakers/ada-portrait.jpg')).toMatch(/\/Contents\/speakers\/ada-portrait\.jpg$/);
    expect(profilePhotoUrl('/api/media/photos/photo.webp')).toMatch(/\/api\/media\/photos\/photo\.webp$/);
  });

  test('does not request an unselected or obsolete photo', () => {
    expect(profilePhotoUrl(null)).toBeNull();
    expect(profilePhotoUrl('/Uploads/speakers/old.jpg')).toBeNull();
  });

  test('preserves explicit remote photos and resolves relative persisted paths', () => {
    expect(profilePhotoUrl('https://images.example.test/portrait.webp')).toBe('https://images.example.test/portrait.webp');
    expect(profilePhotoUrl('profile/person.jpg')).toMatch(/\/Contents\/profile\/person\.jpg$/);
  });
});
