const paths = {
  user: "M20 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  eyeOff:
    "m3 3 18 18 M10 5h2c6 0 10 7 10 7a20 20 0 0 1-4 4 M6 6a20 20 0 0 0-4 6s4 7 10 7c2 0 4-1 5-2 M10 10a3 3 0 0 0 4 4",
  logout: "M9 3H4v18h5 M9 12h12 M16 7l5 5-5 5",
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  water: "M12 3s-7 7-7 12a7 7 0 0 0 14 0c0-5-7-12-7-12Z M8 15a4 4 0 0 0 4 4",
  stations:
    "M12 21v-7 M8 21h8 M12 7v3 M9 11a4 4 0 0 1 6 0 M6 8a8 8 0 0 1 12 0 M3 5a12 12 0 0 1 18 0",
  image:
    "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M3 16l6-6 7 7 M14 14l3-3 4 4 M15 7h.01",
  notes: "M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4 M3 7h4 M3 12h4 M3 17h4",
  analysis: "M4 19V5 M4 19h17 M8 15l4-6 4 3 5-8",
  assistant:
    "M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 0 1-1-5 9 9 0 0 1 18 0Z M8 11h.01 M12 11h.01 M16 11h.01",
  report: "M14 2H5v20h14V7l-5-5Z M14 2v6h5 M8 12h8 M8 16h8",
  data: "M4 6c0-2 16-2 16 0s-16 2-16 0Z M4 6v6c0 3 16 3 16 0V6 M4 12v6c0 3 16 3 16 0v-6",
  refresh: "M20 7a9 9 0 1 0 1 8 M20 3v5h-5",
  guide:
    "M12 5C9 2 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-7-2-10 1Z M12 5v15",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  calendar: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M6 18 18 6",
  info: "M12 11v6 M12 7h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
