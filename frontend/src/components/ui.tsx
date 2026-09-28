import { useEffect, useState } from "react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Link } from "react-router-dom"
import { buttonClass, containerClass, eyebrowClass } from "../lib/styles"
import type { ButtonVariant } from "../lib/styles"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
    return <button {...props} className={buttonClass(variant, className)} />;
}

export function ButtonLink({ to, variant = "primary", className = "", children }:
    { to: string; variant?: ButtonVariant; className?: string; children: ReactNode }) {
    return <Link to={to} className={buttonClass(variant, className)}>{children}</Link>;
}

// A label, the field itself, and an optional hint under it.
export function Field({ label, hint, children, className = "" }:
    { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <label className={`block ${className}`}>
            <span className="mb-1.5 block text-sm text-ink">{label}</span>
            {children}
            {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
        </label>
    );
}

const NOTICE_TONES = {
    info: "border-stone bg-sand text-ink",
    success: "border-olive/30 bg-olive-soft text-olive",
    error: "border-rust/30 bg-rust-soft text-rust",
};

export function Notice({ tone = "info", children, className = "" }:
    { tone?: keyof typeof NOTICE_TONES; children: ReactNode; className?: string }) {
    return (
        <div role={tone === "error" ? "alert" : "status"}
            className={`border px-4 py-3 text-sm leading-relaxed ${NOTICE_TONES[tone]} ${className}`}>
            {children}
        </div>
    );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`${containerClass} ${className}`}>{children}</div>;
}

// The heading block at the top of most pages.
export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
    return (
        <header className="mb-8 sm:mb-10">
            {eyebrow && <p className={`${eyebrowClass} mb-3`}>{eyebrow}</p>}
            <h1 className="text-4xl leading-tight sm:text-5xl">{title}</h1>
            {children && <div className="mt-3 max-w-2xl text-muted">{children}</div>}
        </header>
    );
}

export function Skeleton({ className = "" }: { className?: string }) {
    return <div aria-hidden="true" className={`animate-pulse bg-stone/60 ${className}`} />;
}

export function Spinner({ className = "" }: { className?: string }) {
    return (
        <span aria-hidden="true"
            className={`inline-block size-5 animate-spin rounded-full border-2 border-stone border-t-ink ${className}`} />
    );
}

// The free server sleeps when nobody has visited for a while, and the first
// request can take up to a minute. Say so, rather than look broken.
export function SlowHint({ after = 4000 }: { after?: number }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShow(true), after);
        return () => clearTimeout(timer);
    }, [after]);

    if (!show) return null;
    return (
        <p className="mt-6 text-center text-sm text-muted">
            Still loading. The shop can take up to a minute to wake up the first time, thanks for waiting.
        </p>
    );
}

// Loading for pages whose shape isn't worth a skeleton (orders, account).
export function PageLoading() {
    return (
        <Container className="py-24 text-center">
            <Spinner />
            <p className="sr-only">Loading</p>
            <SlowHint />
        </Container>
    );
}

// A calm, centred message: empty cart, no orders, not found, errors.
export function EmptyState({ title, icon, children, action }:
    { title: string; icon?: ReactNode; children?: ReactNode; action?: ReactNode }) {
    return (
        <Container className="flex flex-col items-center py-20 text-center sm:py-28">
            {icon && <div className="mb-5 text-muted">{icon}</div>}
            <h1 className="text-3xl sm:text-4xl">{title}</h1>
            {children && <div className="mt-3 max-w-md text-muted">{children}</div>}
            {action && <div className="mt-8">{action}</div>}
        </Container>
    );
}

export function ErrorState({ message }: { message: string }) {
    return (
        <EmptyState title="Something went wrong"
            action={<Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>}>
            <p>{message}</p>
        </EmptyState>
    );
}
