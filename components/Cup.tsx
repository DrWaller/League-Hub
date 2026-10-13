// A small trophy cup, drawn in the current text colour. Used for titles and championships.
export default function Cup({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h10V8a5 5 0 0 1-10 0V3.5Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M7 5.5H4.2V7a3.3 3.3 0 0 0 3.3 3.3M17 5.5h2.8V7a3.3 3.3 0 0 1-3.3 3.3" />
      <path d="M12 13v3.5M9 20.5h6M10.2 16.5h3.6v4h-3.6z" />
    </svg>
  );
}
