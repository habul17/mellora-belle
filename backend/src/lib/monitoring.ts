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
        dsn: process.env.SENTRY_DSN,
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

// For the admin's "Send a test alert": true once Sentry has the report.
export async function sendTestAlert() {
    Sentry.captureMessage(`Test alert from the admin, ${new Date().toISOString()}`, {
        level: "error",
        // A new issue every time, so every test sends an email.
        fingerprint: ["test-alert", String(Date.now())],
    });
    return Sentry.flush(5000);
}
