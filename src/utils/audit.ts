import { PrismaClient, AuditAction } from "@prisma/client"
import { Request } from "express"
import { AuditLogData } from '../interfaces/audit.interface';
import { logger } from "./logger"

const prisma = new PrismaClient()

export async function createAuditLog(
  data: AuditLogData,
  req: Request
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action as AuditAction,
        entityType: data.entity,
        entityId: data.entityId.toString(),
        performedById: data.userId.toString(),
        userId: data.userId.toString(),
        newData: {
          details: data.details,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          reportId: data.reportId,
          paymentId: data.paymentId,
        },
      },
    })

    logger.info(`Audit log created - ${data.action} by user ${data.userId}`)
  } catch (error) {
    logger.error("Error creating audit log:", error)
  }
}
