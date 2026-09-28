import { useEffect } from "react"
import { useLocation, useNavigationType } from "react-router-dom"

// Following a link to another page starts it at the top, as on a normal
// website. Back and Forward ("POP") are left alone so the browser can put
// the visitor back where they were.
function ScrollToTop() {
    const { pathname } = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        if (navigationType !== "POP") window.scrollTo(0, 0);
    }, [pathname, navigationType]);

    return null;
}

export default ScrollToTop
