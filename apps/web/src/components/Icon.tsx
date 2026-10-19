import type { SVGProps } from "react";

const PATHS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3",
  pin: "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2",
  heart: "M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z",
  share: "M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M16 7l-4-4-4 4m4-4v13",
  star: "m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3Z",
  ticket: "M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a3 3 0 0 0 0 6v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a3 3 0 0 0 0-6Zm11-3v12",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 9a7 7 0 0 1 14 0m1-9a3 3 0 1 0 0-6m2 15a6 6 0 0 0-3-5.2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z",
  map: "M9 4 3 6.5v13L9 17m0-13 6 2.5M9 4v13m6-10.5L21 4v13l-6 2.5m0-13v13M9 17l6 2.5",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  filter: "M4 5h16M7 12h10m-7 7h4",
  x: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrow: "M19 12H5m6-6-6 6 6 6",
  chevron: "m15 6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chart: "M4 20V10m6 10V4m6 16v-7m5 7H3",
  trend: "m3 17 6-6 4 4 8-8m0 0h-6m6 0v6",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11",
  menu: "M4 7h16M4 12h16M4 17h16",
  send: "m21 3-9.5 18-2.5-7.5L1.5 11 21 3Z",
  bot: "M12 4v3M7 7h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Zm1.5 5.5h.01m7-.01h.01M9.5 16h5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v5m0-8.5v.01",
  flame: "M12 21c3.9 0 6.5-2.6 6.5-6 0-2.6-1.6-4.3-2.8-5.8-.7 1-1.5 1.5-2.2 1.6.3-2.7-.8-5.2-3-7.3-.3 3.3-1.8 4.6-3.2 6.3C6 11.6 5.5 12.9 5.5 15c0 3.4 2.6 6 6.5 6Z",
  navigation: "m3 11 18-8-8 18-2-8-8-2Z",
  edit: "M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Zm9.5-13.5 3 3",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3",
  qr: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v6h-4m0-2v2",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Zm5-5h.01",
  shield: "M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Zm-3 9 2.5 2.5L15.5 10",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  download: "M12 4v12m-5-5 5 5 5-5M5 20h14",
  external: "M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  refresh: "M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4m-4 5a8 8 0 0 0 14.5 3.5M20 20v-4h-4"
} as const;

export type IconName = keyof typeof PATHS;

interface Props extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, size = 20, filled = false, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
