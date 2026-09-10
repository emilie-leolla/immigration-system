"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAgencyStepDefinitions, getAgencyTemplates, getTemplateSteps } from "@/lib/steps-server";
import { ApplicationType } from "@prisma/client";
import { auditDetails } from "@/lib/audit-log";

export async function getWorkflowTemplatesAction() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }
    const agencyId = (session.user as any).agencyId;
    if (!agencyId) return { error: "Your account is not linked to an agency." };

    const templates = await getAgencyTemplates(agencyId);
    return { templates: templates.filter((t) => t.isActive) };
}

export async function updateClientProfileAction(
    clientId: string,
    data: {
        name: string;
        email: string;
        phoneNumber: string;
        nationality?: string;
        dateOfBirth?: string;
        maritalStatus?: string;
        numberOfChildren?: number;
        address?: string;
    }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    if (!data.name || !data.email || !data.phoneNumber) {
        return { error: "Name, email, and phone number are required." };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return { error: "Please provide a valid email address." };
    }

    try {
        const isAdmin = (session.user as any).role === "ADMIN";
        const agencyId = (session.user as any).agencyId;

        // Confirm this agent/admin actually has access to this client
        const existingClient = await prisma.user.findUnique({
            where: isAdmin ? { id: clientId, agencyId } : { id: clientId, agentId: session.user.id },
            select: { id: true }
        });

        if (!existingClient) {
            return { error: "Client not found or not assigned to you." };
        }

        await prisma.user.update({
            where: { id: clientId },
            data: {
                name: data.name,
                email: data.email,
                phoneNumber: data.phoneNumber,
                nationality: data.nationality || null,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
                maritalStatus: (data.maritalStatus as any) || null,
                numberOfChildren: data.numberOfChildren !== undefined ? Number(data.numberOfChildren) : 0,
                address: data.address || null
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                action: "PROFILE_UPDATE",
                details: auditDetails("clientProfileUpdatedByActor", {
                    actorRole: (session.user as any).role === "ADMIN" ? "Admin" : "Agent",
                    actorName: session.user.name,
                    clientName: data.name,
                }),
                userId: session.user.id,
                targetId: clientId
            }
        });

        revalidatePath(`/dashboard/agent/clients/${clientId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Client profile update error:", e);
        if (e.code === 'P2002' && e.meta?.target?.includes('email')) {
            return { error: "This email address is already in use." };
        }
        return { error: e.message || "Failed to update client profile." };
    }
}

export async function createApplicationForClientAction(
    clientId: string,
    data: { country: string; type: string; templateId?: string; description?: string }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    if (!data.country) {
        return { error: "Country is required." };
    }

    try {
        const isAdmin = (session.user as any).role === "ADMIN";
        const agencyId = (session.user as any).agencyId;

        // Confirm this agent/admin actually has access to this client
        const client = await prisma.user.findUnique({
            where: isAdmin ? { id: clientId, agencyId } : { id: clientId, agentId: session.user.id },
            select: { id: true, name: true, agentId: true, agencyId: true }
        });

        if (!client) {
            return { error: "Client not found or not assigned to you." };
        }

        let stepDefs;
        if (data.templateId) {
            const template = await prisma.applicationTemplate.findUnique({ where: { id: data.templateId } });
            if (!template || template.agencyId !== client.agencyId) {
                return { error: "This workflow does not belong to your agency." };
            }
            stepDefs = await getTemplateSteps(data.templateId);
        } else {
            stepDefs = await getAgencyStepDefinitions(client.agencyId);
        }

        const application = await prisma.application.create({
            data: {
                country: data.country,
                type: (data.type as ApplicationType) || "PR",
                clientId: client.id,
                agentId: client.agentId || session.user.id,
                agencyId: client.agencyId,
                applicationTemplateId: data.templateId || null,
                status: "IN_PROGRESS",
                steps: {
                    create: stepDefs.map((def, index) => {
                        const isFirstThree = index < 3;
                        const isStep4 = index === 3;
                        return {
                            type: def.type,
                            label: def.label,
                            order: index,
                            status: isFirstThree ? "APPROVED" : (isStep4 ? "IN_PROGRESS" : "PENDING"),
                            isLocked: isFirstThree ? false : (isStep4 ? false : true),
                            description: isFirstThree ? "Automatically verified." : (def.description || data.description || null),
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
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                action: "APPLICATION_CREATION",
                details: auditDetails("applicationCreatedByActor", {
                    actorRole: (session.user as any).role === "ADMIN" ? "Admin" : "Agent",
                    actorName: session.user.name,
                    appType: data.type,
                    country: data.country,
                    clientName: client.name,
                }),
                userId: session.user.id,
                targetId: client.id
            }
        });

        revalidatePath(`/dashboard/agent/clients/${clientId}`);
        return { success: true, applicationId: application.id };
    } catch (e: any) {
        console.error("Agent application creation error:", e);
        return { error: e.message || "Failed to create application." };
    }
}

export async function sendOfficialMessageAction(clientId: string, subject: string, content: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    if (!subject || !content) {
        return { error: "Subject and content are required." };
    }

    try {
        const client = await prisma.user.findUnique({
            where: { id: clientId },
            select: { name: true }
        });

        await prisma.$transaction(async (tx) => {
            // 1. Create OfficialMessage
            await tx.officialMessage.create({
                data: {
                    subject,
                    content,
                    senderId: session.user.id,
                    receiverId: clientId,
                }
            });

            // 2. Log Action
            await tx.auditLog.create({
                data: {
                    action: "SEND_MESSAGE",
                    details: auditDetails("officialMessageSent", { clientName: client?.name || "client", subject }),
                    userId: session.user.id,
                    targetId: clientId,
                }
            });
        });

        revalidatePath(`/dashboard/agent/clients/${clientId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Messaging Error:", e);
        return { error: "Failed to send official message." };
    }
}