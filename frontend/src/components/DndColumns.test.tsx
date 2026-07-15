// @vitest-environment jsdom
/**
 * DndColumns (v1.76) — pins the Outlook-style customize model: drop on a row
 * reports that row's flat position, drop on a column's empty space appends,
 * locked rows (File) can't be dragged, and Hidden sections render their
 * category labels.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { DndColumns, type DndColumnSpec } from './CustomizePanelsDialog';

let host: HTMLElement;
let root: Root;
const onDrop = vi.fn();

const COLUMNS: DndColumnSpec[] = [
  {
    id: 'shown', title: 'Shown',
    sections: [{
      rows: [
        { key: 'File', locked: true, content: <span>File</span> },
        { key: 'Edit', content: <span>Edit</span> },
        { key: 'View', content: <span>View</span> },
      ],
    }],
  },
  {
    id: 'hidden', title: 'Hidden', isHidden: true,
    sections: [
      { label: 'Menus', rows: [{ key: 'Help', content: <span>Help</span> }] },
    ],
  },
];

function fire(el: Element, type: string) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', {
    value: { setData: () => {}, getData: () => '', effectAllowed: '', dropEffect: '' },
  });
  act(() => { el.dispatchEvent(ev); });
}

const rowByText = (text: string) =>
  Array.from(host.querySelectorAll('.fs-dnd-row'))
    .find((r) => r.textContent?.includes(text))!;

beforeEach(() => {
  onDrop.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<DndColumns columns={COLUMNS} onDrop={onDrop} />); });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('DndColumns', () => {
  it('drop on a row reports that row\'s flat position', () => {
    fire(rowByText('Edit'), 'dragstart');
    fire(rowByText('View'), 'dragover');
    fire(rowByText('View'), 'drop');
    expect(onDrop).toHaveBeenCalledWith(
      { col: 'shown', key: 'Edit' },
      { col: 'shown', idx: 2 },
    );
  });

  it('drop on a column\'s body appends (idx = row count)', () => {
    fire(rowByText('Edit'), 'dragstart');
    const hiddenBody = host.querySelectorAll('.fs-dnd-col-body')[1];
    fire(hiddenBody, 'dragover');
    fire(hiddenBody, 'drop');
    expect(onDrop).toHaveBeenCalledWith(
      { col: 'shown', key: 'Edit' },
      { col: 'hidden', idx: 1 },
    );
  });

  it('locked rows are not draggable', () => {
    expect(rowByText('File').getAttribute('draggable')).toBe('false');
    expect(rowByText('Edit').getAttribute('draggable')).toBe('true');
  });

  it('Hidden renders its category label', () => {
    expect(host.querySelector('.fs-dnd-cat')?.textContent).toBe('Menus');
  });
});
