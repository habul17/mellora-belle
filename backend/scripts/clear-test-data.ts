// Run once, just before launch: removes every order and every customer
// account (all of them are tests until the shop opens), so the first real
// customer is order #1001 and the admin's order list starts empty. Admin
// accounts, products and stock settings stay.
//
// It only lists what it would remove unless it's given --delete with the
// number of orders it listed, so an order placed in between stops it.
//   Laptop (dev database):  npx tsx scripts/clear-test-data.ts
//   Live shop:              DATABASE_URL="<Render's DATABASE_URL>" npx tsx scripts/clear-test-data.ts
//   Then, to remove them:   ...same command... --delete <number of orders>
import { prisma } from "../src/lib/prisma.js"

const deleteIndex = process.argv.indexOf("--delete");
const confirmCount = deleteIndex === -1 ? null : Number(process.argv[deleteIndex + 1]);

try {
    const orders = await prisma.order.findMany({
        select: { id: true, number: true, status: true, totalAmount: true, createdAt: true, user: { select: { email: true } } },
        orderBy: { number: "asc" },
    });
    const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true, email: true } });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });

    console.log(`Database: ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown)"}\n`);
    console.log(`${orders.length} order(s):`);
    for (const o of orders) {
        console.log(`  #${o.number}  ${o.status.padEnd(18)} ₹${o.totalAmount}  ${o.user.email}  ${o.createdAt.toISOString().slice(0, 16).replace("T", " ")}`);
    }
    console.log(`\n${customers.length} customer account(s): ${customers.map((c) => c.email).join(", ") || "none"}`);
    console.log(`Kept: admin account(s) ${admins.map((a) => a.email).join(", ")}, all products and stock settings.\n`);

    if (confirmCount === null) {
        console.log(`Nothing removed. To remove all of the above, run this again with: --delete ${orders.length}`);
    } else if (confirmCount !== orders.length) {
        console.error(Number.isInteger(confirmCount)
            ? `Stopped: --delete ${confirmCount} doesn't match the ${orders.length} order(s) listed above. Nothing removed.`
            : `Stopped: put the number of orders listed above after --delete (--delete ${orders.length}). Nothing removed.`);
        process.exitCode = 1;
    } else {
        const orderIds = orders.map((o) => o.id);
        const customerIds = customers.map((c) => c.id);

        await prisma.$transaction([
            prisma.shipment.deleteMany({ where: { orderId: { in: orderIds } } }),
            prisma.orderEmail.deleteMany({ where: { orderId: { in: orderIds } } }),
            prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }),
            prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
            prisma.auditLog.deleteMany({ where: { OR: [{ entityType: "Order", entityId: { in: orderIds } }, { actorId: { in: customerIds } }] } }),
            prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
            prisma.cartItem.deleteMany({ where: { cart: { userId: { in: customerIds } } } }),
            prisma.cart.deleteMany({ where: { userId: { in: customerIds } } }),
            prisma.refreshToken.deleteMany({ where: { userId: { in: customerIds } } }),
            prisma.passwordResetToken.deleteMany({ where: { userId: { in: customerIds } } }),
            prisma.user.deleteMany({ where: { id: { in: customerIds } } }),
            // The first real order is #1001, as the numbering was set up for.
            prisma.$executeRawUnsafe(`ALTER SEQUENCE "Order_number_seq" RESTART WITH 1001`),
        ]);

        console.log(`Removed ${orders.length} order(s) and ${customers.length} customer account(s). The next order will be #1001.`);
        console.log("Stock wasn't changed: set the real count for every size on the admin Stock page now.");
    }
} finally {
    await prisma.$disconnect();
}
