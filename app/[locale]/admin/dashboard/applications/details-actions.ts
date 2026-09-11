"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auditDetails } from "@/lib/audit-log";

export async function getApplicationDetails(applicationId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session || !["ADMIN", "SUPER_ADMIN"].includes((session.user as any).role)) {
            return { error: "Unauthorized access." };
        }

        const agencyId = (session.user as any).agencyId;

        const app = await prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        dateOfBirth: true,
                        nationality: true,
                        maritalStatus: true,
                        phoneNumber: true,
                        address: true
                    }
                },
                agent: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                steps: {
                    include: {
                        Document: {
                            orderBy: {
                                uploadedAt: "desc"
                            }
                        },
                        subSteps: {
                            orderBy: {
                                order: "asc"
                            }
                        }
                    },
                    orderBy: {
                        updatedAt: "asc"
                    }
                }
            }
        }) as any;

        if (!app) return { error: "Procedure not found." };
        if (app.agencyId !== agencyId) {
            return { error: "This application does not belong to your agency." };
        }

        const mappedApp = {
            ...app,
            destination: app.country,
            type: app.steps[0]?.type || "GENERAL"
        };

        return { success: true, application: mappedApp };
    } catch (e: any) {
        return { error: e.message || "Failed to fetch details" };
    }
}

export async function unlockApplication(applicationId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });

        if (!session || !["ADMIN", "SUPER_ADMIN"].includes((session.user as any).role)) {
            return { error: "Unauthorized access." };
        }

        const agencyId = (session.user as any).agencyId;

        const existing = await prisma.application.findUnique({
            where: { id: applicationId }
        });

        if (!existing) return { error: "Procedure not found." };

        if (existing.agencyId !== agencyId) {
            return { error: "This application does not belong to your agency." };
        }

        await prisma.application.update({
            where: { id: applicationId },
            data: { status: "IN_PROGRESS" }
        });

        await prisma.applicationStep.updateMany({
            where: { applicationId },
            data: { isLocked: false }
        });

        await prisma.auditLog.create({
            data: {
                action: "APPLICATION_UNLOCKED",
                details: auditDetails("applicationUnlocked", { applicationId }),
                userId: session.user.id,
                agencyId,
                targetId: applicationId
            }
        });

        revalidatePath("/admin/dashboard/applications");

        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Failed to unlock application." };
    }
}