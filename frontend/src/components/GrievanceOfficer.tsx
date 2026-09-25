import { business } from "../lib/business";

// Rule 4 of the Consumer Protection (E-Commerce) Rules 2020: name, designation and
// contact of the grievance officer, who acknowledges within 48 hours and resolves within a month.
function GrievanceOfficer() {
    const { grievanceOfficer } = business;

    return (
        <section>
            <h2>Grievance Officer</h2>
            <p>
                {grievanceOfficer.name}, {grievanceOfficer.designation}<br />
                Email: <a href={`mailto:${business.email}`}>{business.email}</a><br />
                Phone: <a href={business.phoneHref}>{business.phone}</a>
            </p>
            <p>
                We acknowledge every complaint within 48 hours and resolve it within one month
                of receiving it.
            </p>
        </section>
    );
}

export default GrievanceOfficer
