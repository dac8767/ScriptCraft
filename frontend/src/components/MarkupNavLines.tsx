/**
 * v5.46, Derek: THE renderer for an annotation's Navigator lines — the
 * Navigator row and the edit window's "In Navigator:" preview both render
 * this, so they cannot drift. Checklist lines carry a real checkbox icon
 * (checked state live) sized like every other Navigator icon; bullets and
 * numbers stay text markers.
 */
import { FaRegSquare, FaRegCheckSquare } from 'react-icons/fa';
import type { MarkupNavLine } from '../utils/markupActions';

export function MarkupNavLineSpans({ lines }: { lines: MarkupNavLine[] }) {
  if (lines.length === 0) return null;
  return (
    <span className="fs-nav-anno-lines">
      {lines.map((l, i) => (
        <span key={i} className="fs-nav-anno-line">
          {l.marker === 'check' && <span className="fs-nav-line-check"><FaRegCheckSquare /></span>}
          {l.marker === 'uncheck' && <span className="fs-nav-line-check"><FaRegSquare /></span>}
          {l.marker === 'bullet' && <span className="fs-nav-line-marker">•</span>}
          {l.marker === 'number' && <span className="fs-nav-line-marker">{l.n}.</span>}
          {l.text}
        </span>
      ))}
    </span>
  );
}
