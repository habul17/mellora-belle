// Every business detail the policy pages and footer show lives here, so a change
// (new domain email, the full address before KYC) is one edit in one place.
// The Consumer Protection (E-Commerce) Rules 2020 require the legal name, address,
// customer-care contact and a grievance officer to be displayed on the site.

export const business = {
    name: "Mellora Belle",
    legalName: "Marteena Jency Vincent",
    email: "mellorabelle.in@gmail.com",
    phone: "+91 99444 24576",
    phoneHref: "tel:+919944424576",
    // Full postal address, shown on the Contact page. Razorpay's KYC checks it
    // matches the one on the application.
    address: "477, Selvanilaiyam, Puliyakulam Main Road, Ramanathapuram, Coimbatore, Tamil Nadu 641045",
    city: "Coimbatore, Tamil Nadu",
    jurisdiction: "Coimbatore, Tamil Nadu",
    grievanceOfficer: {
        name: "Marteena Jency Vincent",
        designation: "Grievance Officer",
    },
    policiesUpdated: "6 October 2026",
    // Shown on every product page: the Consumer Protection (E-Commerce) Rules
    // 2020 ask sellers to state it. To confirm with the owner.
    countryOfOrigin: "India",
};

export const shipping = {
    dispatchDays: "1-2 working days",
    deliveryDays: "3-7 working days",
    // Rupees per order with a single item; orders of freeFromItems or more
    // ship free. For display only. Checkout charges SHIPPING_RATES and
    // FREE_SHIPPING_FROM_ITEMS in backend/src/lib/shipping.ts, so change both
    // together.
    rates: {
        tamilNadu: 89,
        restOfIndia: 109,
        remote: 149,
    },
    freeFromItems: 2,
};

export const returns = {
    cancelWindow: "1 hour",
    // Returns are only for damaged, defective or wrong items, reported this
    // many days after delivery. Change RETURN_WINDOW_MS in
    // backend/src/lib/orderStatus.ts with it.
    returnWindowDays: 2,
    refundDays: "5-7 working days",
};

// The six pages that link from the footer, in display order.
export const policyLinks = [
    { to: "/contact", label: "Contact Us" },
    { to: "/shipping", label: "Shipping & Delivery" },
    { to: "/refunds", label: "Cancellation & Refunds" },
    { to: "/pricing", label: "Pricing" },
    { to: "/terms", label: "Terms & Conditions" },
    { to: "/privacy", label: "Privacy Policy" },
];
