import { useEffect, useState } from "react"
import { clearMergeNotice, readMergeNotice } from "../lib/account"
import { Notice } from "./ui"

// Items from before logging in that couldn't go into the account cart. Shown
// once, on whichever of the cart or checkout pages the customer opens next.
export function MergeNotice({ className = "" }: { className?: string }) {
    const [lines] = useState(readMergeNotice);

    useEffect(() => {
        clearMergeNotice();
    }, []);

    if (lines.length === 0) return null;

    return (
        <Notice tone="error" className={className}>
            {lines.length === 1
                ? "An item you added before logging in couldn't go into your cart:"
                : "Some items you added before logging in couldn't go into your cart:"}
            <ul className="mt-1 list-disc pl-5">
                {lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
        </Notice>
    );
}
