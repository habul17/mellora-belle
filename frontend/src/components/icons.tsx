// Line icons drawn to match the thin type. They inherit the text colour.
import type { SVGProps } from "react"

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={22} height={22} {...props}>
            {children}
        </svg>
    );
}

export const BagIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>
);
export const UserIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></Icon>
);
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const ChevronLeft = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="m15 5-7 7 7 7" /></Icon>
);
export const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="m9 5 7 7-7 7" /></Icon>
);
export const TruckIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></Icon>
);
export const ReturnIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Icon>
);
export const LockIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><rect x="5" y="10" width="14" height="10" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
);
export const ChatIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="M4 5h16v11H9l-5 4V5Z" /></Icon>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><path d="m5 12 5 5 9-10" /></Icon>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
    <Icon {...p}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></Icon>
);
