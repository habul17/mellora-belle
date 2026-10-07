import mark1x from "../assets/logo-mark@1x.png"
import mark2x from "../assets/logo-mark@2x.png"
import mark3x from "../assets/logo-mark@3x.png"
import { business } from "../lib/business"

// The MB monogram from the owner's logo, cut out of its wine background so the
// gold sits on the ivory pages (.local-tests/make-logo-assets.py makes the
// files). It always comes with the name beside it, so screen readers skip it.
export function LogoMark({ className = "" }: { className?: string }) {
    return (
        <img src={mark1x} srcSet={`${mark1x} 1x, ${mark2x} 2x, ${mark3x} 3x`}
            alt="" width={48} height={40} className={`w-auto ${className}`} />
    );
}

// The monogram and the name, as on the logo: the header, the menu, the footer.
export function Logo({ size = "header" }: { size?: "header" | "menu" | "footer" }) {
    const styles = {
        header: { mark: "h-6 sm:h-9", name: "text-[15px] tracking-[0.08em] sm:text-2xl sm:tracking-[0.14em]", gap: "gap-2 sm:gap-3.5" },
        menu: { mark: "h-7", name: "text-lg tracking-[0.12em]", gap: "gap-2.5" },
        footer: { mark: "h-10", name: "text-2xl tracking-[0.14em]", gap: "gap-3.5" },
    }[size];

    return (
        <span className={`flex items-center ${styles.gap}`}>
            <LogoMark className={styles.mark} />
            <span className={`font-serif font-semibold whitespace-nowrap uppercase ${styles.name}`}>{business.name}</span>
        </span>
    );
}
