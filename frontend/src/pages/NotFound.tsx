import { ButtonLink, EmptyState } from "../components/ui"
import { usePageTitle } from "../lib/usePageTitle"

function NotFound() {
    usePageTitle("Page not found");

    return (
        <EmptyState title="This page doesn't exist"
            action={<ButtonLink to="/shop">Shop the collection</ButtonLink>}>
            <p>The link may be old or mistyped.</p>
        </EmptyState>
    );
}

export default NotFound
