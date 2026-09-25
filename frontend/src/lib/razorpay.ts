// Razorpay's payment window is a script served by Razorpay, not an npm package.
// It is loaded only when a customer actually pays, and only once per page.
let loading: Promise<boolean> | null = null;

export function loadRazorpay(): Promise<boolean> {
    if ((window as any).Razorpay) return Promise.resolve(true);

    if (!loading) {
        loading = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => {
                // Forget the failure so the next click gets a fresh attempt,
                // rather than failing forever after one bad network moment.
                loading = null;
                script.remove();
                resolve(false);
            };
            document.body.appendChild(script);
        });
    }

    return loading;
}
