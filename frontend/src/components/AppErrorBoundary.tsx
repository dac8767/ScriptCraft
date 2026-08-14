/**
 * AppErrorBoundary (v4.62, stability audit) — the LAST line of defense.
 *
 * Before this, a throw during any component render unmounted the whole React
 * tree: a white screen with no message and no way back except killing the
 * app. The boundary catches the render error, keeps the crash on screen in
 * readable form, and offers a reload — the 2s-debounced autosave means a
 * reload loses at most a couple of seconds of typing.
 */
import React from 'react';

interface State { error: Error | null }

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ScriptCraft crashed during render:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999, background: '#1a1a2e',
        color: '#e8e8e8', font: '14px/1.6 system-ui, sans-serif', padding: 40,
        overflow: 'auto',
      }}>
        <h1 style={{ color: 'var(--fd-danger)', fontSize: 20, marginBottom: 12 }}>
          ScriptCraft hit an error
        </h1>
        <p style={{ marginBottom: 16, maxWidth: 560 }}>
          Your script is safe — it autosaves as you type. Reload to pick up
          where you left off. If this keeps happening, the details below say
          where it broke.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 18px', fontSize: 14, cursor: 'pointer', marginBottom: 24,
          }}
        >Reload ScriptCraft</button>
        <pre style={{
          whiteSpace: 'pre-wrap', color: 'var(--fd-danger)', fontFamily: 'monospace',
          fontSize: 12, opacity: 0.8,
        }}>{this.state.error.stack || String(this.state.error)}</pre>
      </div>
    );
  }
}
