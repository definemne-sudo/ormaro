import type { SVGProps } from "react";

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </Base>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Base>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base strokeWidth="2.2" {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
  </Base>
);
export const UserIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5" />
  </Base>
);
export const HeartIcon = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <Base fill={filled ? "currentColor" : "none"} {...p}>
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
  </Base>
);
export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base strokeWidth="1.6" {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M4 16l4.5-4.5 4 4 2.5-2.5 5 5" />
    <circle cx="9" cy="9.5" r="1.2" />
  </Base>
);
export const BackIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base strokeWidth="2" {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);
export const CameraIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.2" />
  </Base>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Base strokeWidth="2" {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);
