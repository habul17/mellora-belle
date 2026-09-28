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
    // Full postal address. Leave empty until it's decided; the Contact page falls back
    // to the city. It MUST be filled in before the Razorpay KYC is submitted.
    address: "",
    city: "Coimbatore, Tamil Nadu",
    jurisdiction: "Coimbatore, Tamil Nadu",
    grievanceOfficer: {
        name: "Marteena Jency Vincent",
        designation: "Grievance Officer",
    },
    policiesUpdated: "25 September 2026",
    // Shown on every product page: the Consumer Protection (E-Commerce) Rules
    // 2020 ask sellers to state it. To confirm with the owner.
    countryOfOrigin: "India",
};

export const shipping = {
    dispatchDays: "1-2 working days",
    deliveryDays: "3-7 working days",
    // Rupees: the first kilo, then each extra kilo or part of one. For display
    // only. Checkout charges SHIPPING_RATES in backend/src/lib/shipping.ts,
    // so change both together.
    rates: {
        tamilNadu: { firstKg: 60, perExtraKg: 30 },
        restOfIndia: { firstKg: 90, perExtraKg: 50 },
    },
};

export const returns = {
    cancelWindow: "1 hour",
    returnWindowDays: 7,
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
