import { describe, it, expect } from 'vitest';
import { chevronTowards } from './uiIcons';

/*
 * v1.32 — the double chevron's direction rules, pinned.
 *
 * Pop-out sends the window AWAY from its panel; pop-in sends it back TOWARD
 * the panel. Getting one of these backwards is invisible in code review and
 * instantly obvious (and wrong) on screen.
 */
describe('chevronTowards', () => {
  it('pop-out points away from the panel', () => {
    expect(chevronTowards('popout', 'left')).toBe('right');
    expect(chevronTowards('popout', 'right')).toBe('left');
  });

  it('pop-in points back toward the panel', () => {
    expect(chevronTowards('popin', 'left')).toBe('left');
    expect(chevronTowards('popin', 'right')).toBe('right');
  });
});
