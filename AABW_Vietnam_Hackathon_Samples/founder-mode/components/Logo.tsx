export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 2L4.5 13.5H11L10 22L19.5 9.5H13L13 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
