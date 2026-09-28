import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { trackPageView } from "../lib/analytics"

// The shop is one page that swaps its content, so the analytics tags never see
// a normal page load after the first. This reports each change of address.
// Rendered after the routes so the new page has set its title first.
function PageViewTracker() {
    const { pathname, search } = useLocation();
    const last = useRef<string | null>(null);

    useEffect(() => {
        const path = pathname + search;
        // React runs effects twice in development; count each page once.
        if (last.current === path) return;
        last.current = path;
        trackPageView();
    }, [pathname, search]);

    return null;
}

export default PageViewTracker
