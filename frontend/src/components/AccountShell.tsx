import type { ReactNode } from "react"
import { Container } from "./ui"

// The narrow, centred frame shared by the log in and password reset pages.
function AccountShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
    return (
        <main>
            <Container className="max-w-md py-14 sm:py-20">
                <h1 className="text-center text-4xl sm:text-5xl">{title}</h1>
                {intro && <div className="mt-3 text-center text-muted">{intro}</div>}
                <div className="mt-10 space-y-5">{children}</div>
            </Container>
        </main>
    );
}

export default AccountShell
