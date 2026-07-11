import React, { useEffect, useRef, useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string | null) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
  '#ff0000', '#ff6600', '#ffcc00', '#33cc33', '#0066ff', '#9933ff',
  '#cc0000', '#cc6600', '#999900', '#006600', '#003399', '#660099',
  '#ff6666', '#ffcc66', '#ffff66', '#66ff66', '#66ccff', '#cc66ff',
];

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const [customColor, setCustomColor] = useState(value || '#000000');
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(value || '#000000')));

  // Follow the hex box when it's typed into, so the square/slider stay in sync.
  useEffect(() => {
    if (/^#[0-9a-f]{6}$/i.test(customColor)) setHsv(rgbToHsv(hexToRgb(customColor)));
  }, [customColor]);

  const hueHex = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  const applyHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    setCustomColor(rgbToHex(hsvToRgb(next)));
  };

  const pickSV = (clientX: number, clientY: number) => {
    const box = svRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    applyHsv({ h: hsv.h, s: x, v: 1 - y });
  };

  // Track the pointer beyond the square's bounds once a drag has started.
  const onSvDown = (e: React.PointerEvent) => {
    e.preventDefault();
    pickSV(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => pickSV(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="color-picker-popup" ref={ref}>
      <div className="color-picker-swatches">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            className={`color-picker-swatch${value === color ? ' active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
      {/* v0.80: an in-app saturation/value square + hue slider REPLACES
          <input type="color">. That input hands off to the OPERATING SYSTEM's
          color panel, which an app cannot position — on a multi-monitor Mac it
          opens wherever the OS last left it, which is why it appeared on a
          different screen. Rendering the picker ourselves keeps it inside the
          dialog, next to the swatch that opened it. */}
      <div
        className="cp-sv"
        ref={svRef}
        style={{ background: hueHex }}
        onPointerDown={onSvDown}
      >
        <div className="cp-sv-white" />
        <div className="cp-sv-black" />
        <div className="cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <input
        className="cp-hue"
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        onChange={(e) => applyHsv({ ...hsv, h: Number(e.target.value) })}
      />
      <div className="color-picker-custom">
        <span className="cp-preview" style={{ background: customColor }} />
        <input
          type="text"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="color-picker-hex"
          placeholder="#000000"
          maxLength={7}
        />
        <button
          className="color-picker-apply"
          onClick={() => onChange(customColor)}
        >
          Apply
        </button>
      </div>
      <button
        className="color-picker-reset"
        onClick={() => onChange(null)}
      >
        Reset to Default
      </button>
    </div>
  );
};

export default ColorPicker;

// ── color math (HSV <-> RGB <-> hex) ──
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + h.slice(1).split('').map((c) => c + c).join('');
  if (!/^#[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const p = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

function rgbToHsv({ r, g, b }: { r: number; g: number; b: number }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / d + 2);
    else h = 60 * ((rr - gg) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb({ h, s, v }: { h: number; s: number; v: number }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  return { r: (rr + m) * 255, g: (gg + m) * 255, b: (bb + m) * 255 };
}
