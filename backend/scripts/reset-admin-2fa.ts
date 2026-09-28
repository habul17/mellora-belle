// The recovery path for an admin who has lost the phone with their
// authenticator app. Turns 2FA off for that one account and logs it out
// everywhere; they log in with just their password, then set up 2FA again
// on the new phone (Admin → Security).
//
// Only someone with the database URL can run this, which is the point.
//   Laptop (dev database):   npx tsx scripts/reset-admin-2fa.ts owner@example.com
//   Live shop:               DATABASE_URL="<Render's DATABASE_URL>" npx tsx scripts/reset-admin-2fa.ts owner@example.com
import { prisma } from "../src/lib/prisma.js"
import { normalizeEmail } from "../src/lib/auth.js"

const email = normalizeEmail(process.argv[2]);

if (!email) {
    console.error("Usage: npx tsx scripts/reset-admin-2fa.ts <admin email>");
    process.exit(1);
}

try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, role: "ADMIN" } });

    if (!user) {
        console.error(`No admin account with the email ${email}.`);
        process.exitCode = 1;
    } else {
        await prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, totpPendingSecret: null } }),
            prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
            prisma.auditLog.create({ data: { actorId: user.id, action: "2fa.reset-by-script", entityType: "User", entityId: user.id } }),
        ]);
        console.log(`2FA is off for ${user.email} and all their sessions are logged out. Log in with the password, then set 2FA up again under Admin → Security.`);
    }
} finally {
    await prisma.$disconnect();
}
