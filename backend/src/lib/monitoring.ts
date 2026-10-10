import * as Sentry from "@sentry/node"

// Error alerts through Sentry, which emails the shop about each new problem.
// Only Render has SENTRY_DSN set: on the laptop and in the test suites nothing
// is sent, and errors just go to the console as before.

export function monitoringOn() {
    return Boolean(process.env.SENTRY_DSN);
}

export function startMonitoring() {
    if (!monitoringOn()) return;

    Sentry.init({
        // Pasting into Render can bring a space or quotes along with the key.
        dsn: process.env.SENTRY_DSN!.trim().replace(/^["']|["']$/g, ""),
        environment: process.env.RENDER ? "production" : "development",
        // Errors only: no performance tracing, and no hooks into module
        // loading, which only tracing needs.
        registerEsmLoaderHooks: false,
        // Sentry's own handler would report these a second time: ours below
        // in index.ts already does.
        integrations: (defaults) => defaults.filter((i) => i.name !== "OnUnhandledRejection"),
        // No visitor's IP address, cookies or request body.
        sendDefaultPii: false,
        // A report says which page failed (method and path) and nothing more
        // about the request. Headers carry login tokens, the query string a
        // reset link, and the body a password or a home address.
        beforeSend(event) {
            if (event.request) {
                const { method, url } = event.request;
                event.request = {
                    ...(method && { method }),
                    ...(url && { url: url.split("?")[0]! }),
                };
            }
            delete event.user;
            return event;
        },
        // Log lines from before the error can include customers' emails.
        beforeBreadcrumb(breadcrumb) {
            return breadcrumb.category === "console" ? null : breadcrumb;
        },
    });
    const dsn = Sentry.getClient()?.getDsn();
    if (!dsn) {
        console.error("SENTRY_DSN is set but isn't a valid Sentry DSN, so no alerts will be sent.");
        return;
    }
    // Which project the alerts go to, to check against Sentry's settings. Only
    // the start of the key: enough to tell two keys apart.
    console.log(`Error alerts on: Sentry project ${dsn.projectId} at ${dsn.host}, key ${(dsn.publicKey ?? "").slice(0, 6)}...`);
}

// Something threw that nothing expected: a bug, or a service that is down.
export function reportError(err: unknown, what?: string) {
    if (what) console.error(`${what}:`, err);
    else console.error(err);
    Sentry.captureException(err, what ? { extra: { what } } : undefined);
}

// Not a crash, but the shop has to act: a refund owed, a parcel that wasn't
// booked. `key` makes it one alert per order however many retries fail;
// without one, alerts with the same message are grouped together.
export function reportProblem(message: string, key?: (string | number)[]) {
    console.log(message);
    Sentry.captureMessage(message, {
        level: "error",
        ...(key && { fingerprint: key.map(String) }),
    });
}

// For the admin's "Send a test alert". Waits for Sentry's own answer, so the
// button only says it worked once Sentry has accepted the report. Returns
// what went wrong, or nothing.
export async function sendTestAlert(): Promise<string | undefined> {
    const client = Sentry.getClient();
    if (!client?.getDsn()) {
        return "SENTRY_DSN on the server isn't a valid Sentry key. Copy the DSN from Sentry again.";
    }

    let eventId: string | undefined;
    const answer = new Promise<number | undefined>((resolve) => {
        const timer = setTimeout(() => done(undefined), 10_000);
        const stop = client.on("afterSendEvent", (event, response) => {
            if (event.event_id === eventId) done(response.statusCode);
        });
        function done(status: number | undefined) {
            clearTimeout(timer);
            stop();
            resolve(status);
        }
    });
    eventId = Sentry.captureMessage(`Test alert from the admin, ${new Date().toISOString()}`, {
        level: "error",
        // A new issue every time, so every test sends an email.
        fingerprint: ["test-alert", String(Date.now())],
    });

    // No status: the request never got an answer (network down, or
    // Sentry is asking us to slow down).
    const status = await answer;
    if (status === undefined) return "Sentry didn't answer. Try again in a minute.";
    if (status < 200 || status >= 300) {
        return `Sentry refused the report (status ${status}). Check that SENTRY_DSN is this project's DSN.`;
    }
}
