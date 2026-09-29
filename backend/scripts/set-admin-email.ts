// Changes an admin account's email, which is where "forgot password" sends
// the reset link. The admin logs in with the new email afterwards; the
// password and 2FA stay the same.
//
// Only someone with the database URL can run this.
//   Laptop (dev database):  npx tsx scripts/set-admin-email.ts <current email> <new email>
//   Live shop:              DATABASE_URL="<Render's DATABASE_URL>" npx tsx scripts/set-admin-email.ts <current email> <new email>
import { prisma } from "../src/lib/prisma.js"
import { normalizeEmail, isValidEmail } from "../src/lib/auth.js"

const current = normalizeEmail(process.argv[2]);
const next = normalizeEmail(process.argv[3]);

if (!current || !next) {
    console.error("Usage: npx tsx scripts/set-admin-email.ts <current email> <new email>");
    process.exit(1);
}

if (!isValidEmail(next)) {
    console.error(`"${next}" isn't a valid email address.`);
    process.exit(1);
}

try {
    const admin = await prisma.user.findFirst({ where: { email: { equals: current, mode: "insensitive" }, role: "ADMIN" } });
    const taken = await prisma.user.findFirst({ where: { email: { equals: next, mode: "insensitive" } }, select: { role: true } });

    if (!admin) {
        console.error(`No admin account with the email ${current}.`);
        process.exitCode = 1;
    } else if (taken) {
        console.error(`${next} already belongs to ${taken.role === "ADMIN" ? "an admin" : "a customer"} account. Choose another address (or remove that account first).`);
        process.exitCode = 1;
    } else {
        await prisma.$transaction([
            prisma.user.update({ where: { id: admin.id }, data: { email: next } }),
            prisma.auditLog.create({ data: { actorId: admin.id, action: "admin.email.change-by-script", entityType: "User", entityId: admin.id, details: { from: admin.email, to: next } } }),
        ]);
        console.log(`The admin account now logs in as ${next}. Password and 2FA are unchanged.`);
    }
} finally {
    await prisma.$disconnect();
}
