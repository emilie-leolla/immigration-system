"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAgencyTemplates } from "@/lib/steps-server";
import { auditDetails } from "@/lib/audit-log";
import { getTemplateSteps } from "@/lib/steps-server";

export async function getClientsAndTemplates() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "ADMIN") {
        return { error: "Unauthorized access." };
    }
    const agencyId = (session.user as any).agencyId;
    if (!agencyId) return { error: "Your account is not linked to an agency." };

    const [clients, templates] = await Promise.all([
        prisma.user.findMany({
            where: { role: "CLIENT", agencyId },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" }
        }),
        getAgencyTemplates(agencyId)
    ]);

    return { clients, templates: templates.filter((t) => t.isActive) };
}

export async function createApplicationAction(clientId: string, templateId: string, country: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "ADMIN") {
        return { error: "Unauthorized access." };
    }
    const agencyId = (session.user as any).agencyId;
    if (!agencyId) return { error: "Your account is not linked to an agency." };

    if (!clientId) return { error: "Select a client." };
    if (!templateId) return { error: "Select a workflow." };
    if (!country || !country.trim()) return { error: "Enter a destination country." };

    try {
        const [client, template] = await Promise.all([
            prisma.user.findUnique({ where: { id: clientId } }),
            prisma.applicationTemplate.findUnique({ where: { id: templateId } })
        ]);

        if (!client || client.agencyId !== agencyId || client.role !== "CLIENT") {
            return { error: "This client does not belong to your agency." };
        }
        if (!template || template.agencyId !== agencyId) {
            return { error: "This workflow does not belong to your agency." };
        }

        const stepDefs = await getTemplateSteps(templateId);
        if (stepDefs.length === 0) {
            return { error: "This workflow has no steps yet — add some under Procedure Steps first." };
        }

        const application = await prisma.application.create({
            data: {
                country: country.trim(),
                clientId: client.id,
                agentId: client.agentId || null,
                agencyId,
                applicationTemplateId: templateId,
                status: "IN_PROGRESS",
                steps: {
                    create: stepDefs.map((def, index) => {
                        const isFirstThree = index < 3;
                        const isStep4 = index === 3;
                        return {
                            type: def.type,
                            label: def.label,
                            order: index,
                            status: isFirstThree ? "APPROVED" : isStep4 ? "IN_PROGRESS" : "PENDING",
                            isLocked: isFirstThree ? false : isStep4 ? false : true,
                            description: isFirstThree ? "Automatically verified." : def.description || null,
                            requiredDocuments: def.requiredDocuments,
                            subSteps: {
                                create: def.subSteps.map((sub, subIndex) => ({
                                    label: sub.label,
                                    description: sub.description,
                                    order: subIndex
                                }))
                            }
                        };
                    })
                }
            },
            include: { client: { select: { name: true, email: true } } }
        });

        await prisma.auditLog.create({
            data: {
                action: "CREATE_APPLICATION",
                details: auditDetails("applicationCreatedByAdmin", { templateName: template.name, clientName: client.name, adminName: session.user.name }),
                userId: session.user.id,
                agencyId,
                targetId: application.id
            }
        });

        revalidatePath("/admin/dashboard/applications");
        return { success: true, application };
    } catch (e: any) {
        console.error("Create application error:", e);
        return { error: "Failed to create the application." };
    }
}

export async function deleteApplicationAction(applicationId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || (session.user as any).role !== "ADMIN") {
        return { error: "Unauthorized access." };
    }

    const adminAgencyId = (session.user as any).agencyId;

    try {
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: { client: true }
        });

        if (!application) return { error: "Procedure not found." };
        if (application.agencyId !== adminAgencyId) return { error: "This application does not belong to your agency." };

        await prisma.$transaction(async (tx) => {
            // Delete related documents first
            const steps = await tx.applicationStep.findMany({
                where: { applicationId },
                select: { id: true }
            });
            const stepIds = steps.map((p: any) => p.id);

            await tx.document.deleteMany({
                where: { procedureId: { in: stepIds } }
            });

            // Delete messages
            await tx.message.deleteMany({
                where: { procedureId: { in: stepIds } }
            });

            // Delete steps
            await tx.applicationStep.deleteMany({
                where: { applicationId }
            });

            // Delete application
            await tx.application.delete({
                where: { id: applicationId }
            });

            // Audit Log
            await tx.auditLog.create({
                data: {
                    action: "DELETE_APPLICATION",
                    details: auditDetails("applicationDeleted", { clientName: application.client.name, country: application.country }),
                    userId: session.user.id,
                    agencyId: adminAgencyId
                }
            });
        });

        revalidatePath("/admin/dashboard/applications");
        return { success: true };
    } catch (e: any) {
        console.error("Delete Error:", e);
        return { error: e.message || "Failed to delete application." };
    }
}

export async function updateApplicationAction(
    applicationId: string,
    data: {
        status?: string;
        agentId?: string | null;
        destination?: string;
    }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || (session.user as any).role !== "ADMIN") {
        return { error: "Unauthorized access." };
    }

    const adminAgencyId = (session.user as any).agencyId;

    try {
        const oldApp = await prisma.application.findUnique({
            where: { id: applicationId },
            include: { client: true }
        });

        if (!oldApp) return { error: "Procedure not found." };
        if (oldApp.agencyId !== adminAgencyId) return { error: "This application does not belong to your agency." };

        if (data.agentId) {
            const agent = await prisma.user.findUnique({ where: { id: data.agentId } });
            if (!agent || agent.agencyId !== adminAgencyId) {
                return { error: "This agent does not belong to your agency." };
            }
        }

        await prisma.application.update({
            where: { id: applicationId },
            data: {
                status: data.status as any,
                agentId: data.agentId,
                country: data.destination
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                action: "UPDATE_APPLICATION",
                details: auditDetails("applicationUpdated", { clientName: oldApp.client.name, changes: JSON.stringify(data) }),
                userId: session.user.id,
                agencyId: adminAgencyId
            }
        });

        revalidatePath("/admin/dashboard/applications");
        return { success: true };
    } catch (e: any) {
        console.error("Update Error:", e);
        return { error: e.message || "Failed to update application." };
    }
}