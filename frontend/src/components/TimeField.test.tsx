// @vitest-environment jsdom
/**
 * TimeField (v1.73) — pins the segment auto-advance Derek reported broken in
 * the native control: two digits of hour jump to minutes, two of minutes jump
 * to AM/PM, and the canonical value is 24-hour "HH:MM".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import TimeField from './TimeField';
import { useSettingsStore } from '../stores/settingsStore';

let host: HTMLElement;
let root: Root;
let value = '';
const onChange = vi.fn((v: string) => { value = v; });

function render() {
  act(() => {
    root.render(<TimeField value={value} onChange={onChange} />);
  });
}

const seg = (label: string) =>
  host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;

const typeInto = (input: HTMLInputElement, v: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  value = '';
  onChange.mockClear();
  useSettingsStore.getState().setTimeFormat('12h');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  render();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useSettingsStore.getState().setTimeFormat('12h');
});

describe('TimeField — 12-hour', () => {
  it('typing 11 30 PM auto-advances hour → minutes → AM/PM and yields 23:30', () => {
    const hours = seg('Hours');
    act(() => hours.focus());
    typeInto(hours, '1');
    typeInto(hours, '11');
    expect(document.activeElement).toBe(seg('Minutes'));   // the reported bug

    typeInto(seg('Minutes'), '3');
    typeInto(seg('Minutes'), '30');
    expect(document.activeElement).toBe(seg('AM or PM'));

    act(() => {
      seg('AM or PM').dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    });
    expect(value).toBe('23:30');
  });

  it('a digit that cannot start an hour completes it: 9 → 09 and jumps', () => {
    typeInto(seg('Hours'), '9');
    expect(seg('Hours').value).toBe('09');
    expect(document.activeElement).toBe(seg('Minutes'));
  });

  it('minute 7 completes to 07 and jumps to AM/PM', () => {
    typeInto(seg('Hours'), '11');
    typeInto(seg('Minutes'), '7');
    expect(seg('Minutes').value).toBe('07');
    expect(document.activeElement).toBe(seg('AM or PM'));
  });

  it('rejects hour 13 in 12-hour mode', () => {
    typeInto(seg('Hours'), '1');
    typeInto(seg('Hours'), '13');
    expect(seg('Hours').value).toBe('1');   // second digit refused
  });

  it('12 AM maps to 00', () => {
    typeInto(seg('Hours'), '12');
    typeInto(seg('Minutes'), '05');
    act(() => {
      seg('AM or PM').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    expect(value).toBe('00:05');
  });
});

describe('TimeField — 24-hour', () => {
  it('has no AM/PM segment and 2330 yields 23:30 directly', () => {
    useSettingsStore.getState().setTimeFormat('24h');
    render();
    expect(seg('AM or PM')).toBeNull();
    typeInto(seg('Hours'), '2');
    typeInto(seg('Hours'), '23');
    render();   // controlled value round-trip
    typeInto(seg('Minutes'), '3');
    typeInto(seg('Minutes'), '30');
    expect(value).toBe('23:30');
  });
});
