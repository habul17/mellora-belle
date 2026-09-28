import type { ReactNode } from "react"
import { Container } from "./ui"
import { usePageTitle } from "../lib/usePageTitle"

// The frame for the policy pages: readable line length, and typography
// styles for the plain headings, lists and tables they're written in.
function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
    usePageTitle(title);

    return (
        <main>
            <Container className="max-w-3xl pt-12 sm:pt-16">
                <article className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:font-medium prose-h1:text-4xl sm:prose-h1:text-5xl prose-h2:mt-10 prose-h2:text-2xl prose-a:text-plum prose-a:underline-offset-4 prose-th:text-left prose-th:font-sans prose-th:text-xs prose-th:font-medium prose-th:tracking-wider prose-th:uppercase">
                    {children}
                </article>
            </Container>
        </main>
    );
}

export default PolicyPage
