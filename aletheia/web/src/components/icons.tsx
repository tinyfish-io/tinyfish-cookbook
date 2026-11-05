import type { ReactNode } from "react";

function Icon({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function ArrowLeft({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M13 8H3M7 4 3 8l4 4" />
    </Icon>
  );
}

export function Cross({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
  );
}

export function Check({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Icon>
  );
}

export function Chevron({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Icon>
  );
}

export function Warning({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8 3.5v5.5M8 12v.2" />
    </Icon>
  );
}

export function Bin({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
    </Icon>
  );
}
