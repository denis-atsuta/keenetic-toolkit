import './ComingSoon.css';

/** Placeholder for sections not yet implemented (Routes, DNS, Settings). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="coming-soon">
      <p className="coming-soon__title">{title}</p>
      <p className="hint">This section is coming soon.</p>
    </div>
  );
}
