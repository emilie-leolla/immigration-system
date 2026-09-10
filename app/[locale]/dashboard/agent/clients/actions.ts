"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAgencyStepDefinitions, getTemplateSteps } from "@/lib/steps-server";
import { ApplicationType } from "@prisma/client";
import { auditDetails } from "@/lib/audit-log";
import { hashPassword } from "better-auth/crypto";
import { checkClientQuota } from "@/lib/subscription";
export async function createClientAction(formData: FormData) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    const agencyId = (session.user as any).agencyId;
    if (!agencyId) {
        return { error: "Your account is not linked to an agency." };
    }

    const isAgent = (session.user as any).role === "AGENT";

    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = formData.get("password") as string;

    if (!name || !email || !password) {
        return { error: "All fields are required." };
    }

    if (name.length > 50) {
        return { error: "Name must be 50 characters or less." };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { error: "Invalid email format." };
    }

    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return { error: "A user with this email already exists." };
        }
const quota = await checkClientQuota(agencyId);
if (!quota.ok) {
    return { error: quota.error };
}
        const hashedPassword = await hashPassword(password);

        const newClient = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: "CLIENT" as any,
                status: "ACTIVE" as any,
                agencyId,
                agentId: isAgent ? session.user.id : null,
                emailVerified: true,
                accounts: {
                    create: {
                        providerId: "credential",
                        accountId: email,
                        password: hashedPassword,
                    },
                },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "CREATE_CLIENT",
                details: auditDetails("clientCreatedByActor", {
                    name,
                    email,
                    actorRole: isAgent ? "Agent" : "Admin",
                    actorName: session.user.name,
                }),
                userId: session.user.id,
                agencyId,
                targetId: newClient.id,
            },
        });

        revalidatePath("/dashboard/agent/clients");

        return {
            success: true,
            clientId: newClient.id,
        };
    } catch (e: any) {
        console.error("Client creation error:", e);
        return {
            error: e.message || "An error occurred while creating the client.",
        };
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