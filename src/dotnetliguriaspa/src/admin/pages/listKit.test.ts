import { byOrder, planMove } from './listKit';

type Row = { id: string; order?: number | null };
const item = (id: string, order?: number | null): Row => ({ id, order });
const apply = (changes: ReturnType<typeof planMove<Row>>) => Object.fromEntries(changes.map(change => [change.item.id, change.order]));

describe('ordering helpers', () => {
  test('byOrder sorts by order and keeps the API order for ties', () => {
    const sorted = byOrder([item('c', 3), item('b1', 1), item('none'), item('b2', 1)]);
    expect(sorted.map(i => i.id)).toEqual(['none', 'b1', 'b2', 'c']);
  });

  test('a one-step move swaps the two values and rewrites only those two records', () => {
    const list = [item('a', 1), item('b', 2), item('c', 3)];
    expect(apply(planMove(list, 1, 0))).toEqual({ b: 1, a: 2 });
    expect(apply(planMove(list, 1, 2))).toEqual({ c: 2, b: 3 });
  });

  test('gaps in the numbering survive a move', () => {
    const list = [item('a', 10), item('b', 20), item('c', 40)];
    expect(apply(planMove(list, 2, 1))).toEqual({ c: 20, b: 40 });
  });

  test('repeated values are renumbered from the lowest one so that the move takes effect', () => {
    const list = [item('a', 1), item('b', 1), item('c', 2)];
    // c moves above b: a keeps 1, c is already 2, b becomes 3.
    expect(apply(planMove(list, 2, 1))).toEqual({ b: 3 });
    const zeros = [item('x', 0), item('y', 0), item('z', 0)];
    // z takes the first slot (0, its own value), x and y follow.
    expect(apply(planMove(zeros, 2, 0))).toEqual({ x: 1, y: 2 });
  });

  test('a move that changes nothing returns no changes', () => {
    expect(planMove([item('a', 1), item('b', 2)], 0, 0)).toEqual([]);
  });
});
