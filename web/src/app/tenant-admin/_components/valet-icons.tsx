import React from "react";

const Icon = ({ d, size = 17, color = "currentColor", sw = 2, children }: {
  d?: string[];
  size?: number;
  color?: string;
  sw?: number;
  children?: React.ReactNode;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d
      ? d.map((path, i) => <path key={i} d={path} />)
      : children}
  </svg>
);

export const BuildingIcon = ({ size, color, sw = 2 }: { size?: number; color?: string; sw?: number }) => (
  <Icon size={size} color={color} sw={sw} d={[
    'M3 21h18',
    'M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16',
    'M15 9h4v12',
    'M8 8h1M8 12h1M11 8h1M11 12h1',
  ]} />
);

export const UsersIcon = ({ size, color, sw = 2 }: { size?: number; color?: string; sw?: number }) => (
  <Icon size={size} color={color} sw={sw} d={[
    'M9 11.2a3.2 3.2 0 1 0 0-6.4a3.2 3.2 0 0 0 0 6.4Z',
    'M3 19a6 6 0 0 1 12 0',
    'M16 5.5a3.2 3.2 0 0 1 0 5',
    'M17.5 13.5A6 6 0 0 1 21 19',
  ]} />
);

export const TagIcon = ({ size, color, sw = 2 }: { size?: number; color?: string; sw?: number }) => (
  <Icon size={size} color={color} sw={sw} d={[
    'M20.6 13.4 11 3H4v7l9.6 10.4a2 2 0 0 0 2.9 0l4.1-4.1a2 2 0 0 0 0-2.9Z',
    'M8 7h.01',
  ]} />
);

export const ChevronRight = ({ size = 16, color = "#9AA6BC" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const CarIcon = ({ size = 17, color = "#F4531F" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
    <rect x="3" y="11" width="18" height="6" rx="2" />
    <circle cx="7.5" cy="17.5" r="1.6" />
    <circle cx="16.5" cy="17.5" r="1.6" />
  </svg>
);

export const ClockIcon = ({ size = 17, color = "#0C9D61" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const AlertIcon = ({ size = 16, color = "#B97B17" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export const TrashIcon = ({ size = 16, color = "#C0392B" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const LoadingIcon = ({ size = 22, color = "#F4531F" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.4"
    strokeLinecap="round"
    className="spin"
  >
    <path d="M21 12a9 9 0 1 1-6.2-8.56" />
  </svg>
);
