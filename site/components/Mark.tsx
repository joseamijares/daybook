// The Daybook mark: a gilt frame with the day rising inside it.
export function Mark({ size = 20, tone = 'bone' }: { size?: number; tone?: 'bone' | 'ink' }) {
  return (
    <svg width={(size * 3) / 4} height={size} viewBox="0 0 75 100" aria-hidden="true" className={`mark mark--${tone}`}>
      <path className="mark__frame" fillRule="evenodd" d="M0 0h75v100h-75zM5 5v90h65v-90z" />
      <path className="mark__sun" d="M12.5 95a25 25 0 0 1 50 0z" />
    </svg>
  );
}
