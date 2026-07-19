// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { applyDesignVars } from './designTokens';

function Harness() {
  const designVars = useEditorStore((s) => s.designVars);
  useEffect(() => { applyDesignVars(designVars); }, [designVars]);
  return null;
}

describe('design var apply flow (store → effect → :root)', () => {
  afterEach(() => {
    act(() => { useEditorStore.getState().resetAllDesign(); });
    document.documentElement.removeAttribute('style');
    document.body.innerHTML = '';
  });

  it('mirrors a store change onto documentElement', () => {
    act(() => { useEditorStore.getState().resetAllDesign(); });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<Harness />); });

    expect(document.documentElement.style.getPropertyValue('--dz-editor-main-pad-top')).toBe('');
    act(() => { useEditorStore.getState().setDesignVar('editorMainPadTop', 48); });
    expect(document.documentElement.style.getPropertyValue('--dz-editor-main-pad-top')).toBe('48px');
    act(() => { useEditorStore.getState().resetDesignVar('editorMainPadTop'); });
    expect(document.documentElement.style.getPropertyValue('--dz-editor-main-pad-top')).toBe('');
    act(() => { root.unmount(); });
  });
});
