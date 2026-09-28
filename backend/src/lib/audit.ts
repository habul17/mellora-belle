import { prisma } from "./prisma.js"
import type { Prisma } from "../generated/prisma/client.js"

// Records one admin change (see the AuditLog model). Called after the change
// has succeeded. A failure here is logged but never undoes or fails the
// change itself: the refund or stock update the admin made still stands.
export async function audit(actorId: string, action: string, entityType: string, entityId: string, details?: Prisma.InputJsonValue) {
    try {
        await prisma.auditLog.create({
            data: { actorId, action, entityType, entityId, ...(details !== undefined && { details }) },
        });
    } catch (err) {
        console.error(`Audit log write failed for ${action} on ${entityType} ${entityId}`, err);
    }
}
