// Class lists shared by many pages, kept here so every button and input on the
// site looks the same.

const BUTTON_BASE =
    "inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] " +
    "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS = {
    primary: "bg-ink text-ivory hover:bg-plum",
    secondary: "border border-ink text-ink hover:bg-ink hover:text-ivory",
    light: "bg-ivory text-ink hover:bg-white",
};

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
    return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${extra}`;
}

// 16px text stops iPhones zooming in when a field is tapped.
export const inputClass =
    "block w-full rounded-none border border-stone bg-white px-3.5 py-3 text-base text-ink " +
    "placeholder:text-muted/60 transition-colors focus:border-ink focus:outline-none " +
    "disabled:bg-sand disabled:text-muted";

export const linkClass = "underline decoration-stone underline-offset-4 transition-colors hover:decoration-ink";

// Small uppercase label above headings and in tables.
export const eyebrowClass = "text-[11px] font-medium uppercase tracking-[0.22em] text-muted";

export const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
