export function VietnamMap() {
  return (
    <svg
      viewBox="0 0 200 360"
      className="mx-auto h-32 w-auto"
      aria-hidden="true"
      role="img"
    >
      <title>Map of Vietnam</title>
      <path
        d="M100 8 C115 20 125 45 118 70 C112 95 130 110 128 135 C125 165 140 190 135 220 C130 250 145 280 138 310 C132 335 115 350 100 355 C85 350 68 335 62 310 C55 280 70 250 65 220 C60 190 75 165 72 135 C70 110 88 95 82 70 C75 45 85 20 100 8Z"
        className="fill-cilantro/25 stroke-cilantro"
        strokeWidth="2"
      />
      {/* Hà Nội */}
      <circle cx="108" cy="52" r="6" className="fill-chili" />
      <circle cx="108" cy="52" r="10" className="fill-none stroke-chili opacity-50" strokeWidth="1.5" />
      <text x="120" y="56" fontSize="9" className="fill-nuoc" fontFamily="var(--font-vn)">
        Hà Nội
      </text>
      {/* TP.HCM */}
      <circle cx="95" cy="310" r="6" className="fill-chili" />
      <circle cx="95" cy="310" r="10" className="fill-none stroke-chili opacity-50" strokeWidth="1.5" />
      <text x="108" y="314" fontSize="9" className="fill-nuoc" fontFamily="var(--font-vn)">
        TP.HCM
      </text>
      {/* Đà Nẵng */}
      <circle cx="118" cy="175" r="4" className="fill-crust" />
      <text x="128" y="179" fontSize="8" className="fill-muted-foreground" fontFamily="var(--font-vn)">
        Đà Nẵng
      </text>
      {/* Huế */}
      <circle cx="112" cy="155" r="4" className="fill-crust" />
      <text x="122" y="159" fontSize="8" className="fill-muted-foreground" fontFamily="var(--font-vn)">
        Huế
      </text>
    </svg>
  );
}
