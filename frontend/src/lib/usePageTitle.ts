import { useEffect } from "react"

const SITE_NAME = "Mellora Belle";
const DEFAULT_TITLE = "Mellora Belle | Designer kurthis and co-ord sets";

// Sets the browser tab title (and what Google shows) for the current page.
export function usePageTitle(title?: string | null) {
    useEffect(() => {
        document.title = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    }, [title]);
}
