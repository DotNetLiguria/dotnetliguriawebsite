import { describe, expect, it } from 'vitest';
import { canPerform, hasAllPermissions, hasAnyPermission, hasPermission, PERMISSIONS } from './permissions';

describe('exact server permission helpers', () => {
  it('keeps IDs unique and case sensitive, with no implicit manage-to-read or domain grants', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    const source = { permissions: ['events.manage', 'Questionnaires.read', '*'] };
    expect(hasPermission(source, 'events.manage')).toBe(true);
    expect(hasPermission(source, 'events.read')).toBe(false);
    expect(hasPermission(source, 'questionnaires.read')).toBe(false);
    expect(hasAnyPermission(source, ['events.read', 'events.manage'])).toBe(true);
    expect(hasAllPermissions(source, ['events.read', 'events.manage'])).toBe(false);
  });

  it('requires an operation grant even when the historical modifier is present', () => {
    expect(canPerform({ permissions: ['events.past.manage'] }, 'events.delete', { isPast: true })).toBe(false);
    expect(canPerform({ permissions: ['events.delete'] }, 'events.delete', { isPast: true })).toBe(false);
    expect(canPerform({ permissions: ['events.delete', 'events.past.manage'] }, 'events.delete', { isPast: true })).toBe(true);
  });

  it('never infers current events from a browser clock and honors server denied actions', () => {
    const source = { permissions: ['events.manage', 'events.past.manage'] };
    expect(canPerform({ permissions: ['events.manage'] }, 'events.manage', {})).toBe(false);
    expect(canPerform(source, 'events.manage', { authorization: { isPast: false, allowedActions: [] } })).toBe(false);
    expect(canPerform(source, 'events.manage', { authorization: { isPast: true, allowedActions: ['events.manage'] } })).toBe(true);
  });

  it('requires publication permission before routine edits to published public content', () => {
    const resource = { published: true, authorization: { isPast: false, allowedActions: ['events.manage'] } };
    expect(canPerform({ permissions: ['events.manage'] }, 'events.manage', resource)).toBe(false);
    expect(canPerform({ permissions: ['events.manage', 'events.publish'] }, 'events.manage', resource)).toBe(true);
  });
});
