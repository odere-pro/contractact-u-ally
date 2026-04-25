interface LogoProps {
  readonly size?: number;
}

export function Logo({ size = 32 }: LogoProps) {
  // Inline document-check mark SVG. Stroke uses currentColor so it inherits
  // text color from any parent context (header, footer, splash).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 4h10l5 5v17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M19 4v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M11 18l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
