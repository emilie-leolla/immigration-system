"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ApplicationStatus, ProcedureStatus } from "@prisma/client";
import { auditDetails } from "@/lib/audit-log";
import { getAgencyTemplates, getTemplateSteps } from "@/lib/steps-server";
import { getTranslations } from "next-intl/server";
import { createS3UploadUrl, deleteS3Object } from "@/lib/s3";
// Looks up the agency name that actually owns an application — used for
// client-facing emails so the brand shown is always the client's own
// agency, regardless of which agent/admin performed the action.
async function getApplicationAgencyName(agencyId: string | null): Promise<string | null> {
    if (!agencyId) return null;
    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    return agency?.name || null;
}

export async function updateApplicationStatusAction(
    applicationId: string,
    newStatus: string,
    modificationMessage?: string
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    try {
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: { client: true }
        });

        if (!application) return { error: "Procedure not found." };
        
        await prisma.$transaction(async (tx) => {
            // 1. Update Application status
            await tx.application.update({
                where: { id: applicationId },
                data: { status: newStatus as ApplicationStatus }
            });

            // 2. Audit Log
            await tx.auditLog.create({
                data: {
                    action: "STATUS_UPDATE",
                    details: auditDetails("applicationStatusUpdated", { applicationId, newStatus, clientName: application.client.name }),
                    userId: session.user.id,
                    targetId: applicationId
                }
            });

            // 3. System Message & Official Message (if message provided)
            if (modificationMessage) {
                const firstStep = await tx.applicationStep.findFirst({
                    where: { applicationId },
                    orderBy: { order: "asc" }
                });

                if (firstStep) {
                    const actorRoleLabel = (session.user as any).role === "ADMIN" ? "ADMIN" : "AGENT";
                    await tx.message.create({
                        data: {
                            content: `${actorRoleLabel} UPDATE: ${modificationMessage}`,
                            procedureId: firstStep.id,
                            senderId: session.user.id
                        }
                    });
                }

                // Also create an OFFICIAL MESSAGE for the client dashboard
                await tx.officialMessage.create({
                    data: {
                        subject: `Application Update: ${newStatus}`,
                        content: modificationMessage,
                        senderId: session.user.id,
                        receiverId: application.clientId
                    }
                });
            }
        });

        revalidatePath("/dashboard/agent/applications");
        revalidatePath(`/dashboard/agent/applications/${applicationId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Status Update Error:", e);
        return { error: e.message || "Failed to update status." };
    }
}

import { sendEmail } from "@/lib/resend";

export async function updateStepAction(
    stepId: string,
    data: {
        status?: ProcedureStatus;
        isLocked?: boolean;
        description?: string;
        organization?: string; // New field for Step 5 (Diploma Equivalence)
        languageTest?: string; // Test type for Language Test Registration step (TCF, TEF, IELTS...)
    }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    try {
        const step = await prisma.applicationStep.findUnique({
            where: { id: stepId },
            include: { 
                application: {
                    include: { 
                        steps: true,
                        client: true 
                    }
                },
                Document: true,
                subSteps: {
                    orderBy: { order: "asc" }
                }
            }
        });

        if (!step) return { error: "Step not found." };

        const appSteps = [...step.application.steps].sort((a, b) => a.order - b.order);
        const currentIdx = appSteps.findIndex(s => s.id === step.id);

        // Validation for "APPROVED" status
        if (data.status === "APPROVED") {
            // ... (rest of validation)
            if (currentIdx > 0) {
                const previousSteps = appSteps.slice(0, currentIdx);
                const allPreviousApproved = previousSteps.every(s => s.status === "APPROVED");
                if (!allPreviousApproved) {
                    return { error: "Must approve previous steps before completing this one." };
                }
            }

            // A parent step can only be approved after every child sub-step
            // has itself been approved. Sub-steps are real workflow items,
            // not just a visual checklist.
            if (step.subSteps.length > 0) {
                const allSubStepsApproved = step.subSteps.every((sub) => sub.status === "APPROVED");
                if (!allSubStepsApproved) {
                    return { error: "All sub-steps must be approved before completing this step." };
                }
            }

            if (step.type === "DOCUMENT_COLLECTION") {
                // Match by the document's `type` (a fixed enum set from the
                // upload dropdown), never by its free-text `name` — the name
                // is just a display label and can be worded differently
                // ("National ID Card" vs "National ID"), which made this
                // check reject documents that were actually uploaded.
                const requiredTypes: { type: string; label: string }[] = [
                    { type: "PASSPORT", label: "Passport" },
                    { type: "BIRTH_CERTIFICATE", label: "Birth Certificate" },
                    { type: "ID_CARD", label: "National ID" },
                    { type: "CV", label: "CV" },
                    { type: "DIPLOMA", label: "Diploma" },
                    { type: "TRANSCRIPT", label: "Transcripts" },
                    { type: "PASSPORT_PHOTO", label: "Passport Photo" }
                ];
                const uploadedTypes = step.Document.map((d) => d.type);
                const missing = requiredTypes.filter((d) => !uploadedTypes.includes(d.type as any));
                if (missing.length > 0) {
                    return { error: `Cannot complete step. Missing documents: ${missing.map((d) => d.label).join(", ")}` };
                }
            }

            if (step.type === "PROFILE_CREATION") {
                const hasConfirmation = step.Document.some(d => d.name.startsWith("Profile_Confirmation_"));
                if (!hasConfirmation) {
                    return { error: "Cannot complete step. Profile confirmation screenshot is missing." };
                }
            }
        }

        // Store organization in description if it's Step 5
        let updateData: any = { ...data };
        if (step.type === "DIPLOMA_EQUIVALENCE" && data.organization) {
            updateData.description = `Org: ${data.organization}${data.description ? ` | ${data.description}` : ""}`;
            delete updateData.organization;
        }

        // Store the chosen language test (TCF, TEF, IELTS...) in description for the Language Test Registration step
        if (step.type === "LANGUAGE_TEST_REGISTRATION" && data.languageTest) {
            updateData.description = `Test: ${data.languageTest}${data.description ? ` | ${data.description}` : ""}`;
            delete updateData.languageTest;
        }

        const updatedStep = await prisma.applicationStep.update({
            where: { id: stepId },
            data: {
                ...updateData,
                updatedAt: new Date()
            }
        });

        // Create an Official Message if this is a modification request (ACTION_REQUIRED)
        if (data.status === "ACTION_REQUIRED" && data.description) {
            const tStep = await getTranslations("stepTypeLabels");
            const stepLabel = step.label || (step.type ? tStep(step.type) : step.type);
            
            // 1. Create database record
            await prisma.officialMessage.create({
                data: {
                    subject: `Action Required: ${stepLabel}`,
                    content: data.description,
                    senderId: session.user.id,
                    receiverId: step.application.clientId
                }
            });

            // 2. Send email notification via Resend
            if (step.application.client.email) {
                // Always use the application's OWN agency — not the acting
                // user's agency. getMyAgencyName() looked up whoever is
                // currently logged in, so a Super Admin (who belongs to no
                // agency) or any mismatch silently fell back to the default
                // brand name instead of the client's real agency.
                const agencyName = await getApplicationAgencyName(step.application.agencyId);
                await sendEmail({
                    to: step.application.client.email,
                    subject: `Action Required - ${agencyName || "ATLE Immigration"}`,
                    fromName: agencyName || undefined,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #1E3A8A; padding: 20px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 20px;">Modification Requested</h1>
                            </div>
                            <div style="padding: 30px;">
                                <p style="font-size: 16px; color: #374151;">Hello <strong>${step.application.client.name}</strong>,</p>
                                <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                                    An agent has requested a modification on your application step: <br/>
                                    <strong style="color: #1E3A8A;">${stepLabel}</strong>
                                </p>
                                <div style="background-color: #f9fafb; border-left: 4px solid #1E3A8A; padding: 15px; margin: 20px 0;">
                                    <p style="font-size: 14px; color: #1f2937; margin: 0; font-style: italic;">
                                        "${data.description}"
                                    </p>
                                </div>
                                <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                                    Please log in to your dashboard to view the full details and upload any required documents.
                                </p>
                            </div>
                        </div>
                    `
                });
            }
        }

        // Send an email notification to the client whenever an agent/admin validates (approves) a step
        if (data.status === "APPROVED" && step.status !== "APPROVED" && step.application.client.email) {
            const tStep = await getTranslations("stepTypeLabels");
            const stepLabel = step.label || (step.type ? tStep(step.type) : step.type);
            const agencyName = await getApplicationAgencyName(step.application.agencyId);

            await sendEmail({
                to: step.application.client.email,
                subject: `Step Validated - ${agencyName || "ATLE Immigration"}`,
                fromName: agencyName || undefined,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #059669; padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 20px;">Step Validated ✓</h1>
                        </div>
                        <div style="padding: 30px;">
                            <p style="font-size: 16px; color: #374151;">Hello <strong>${step.application.client.name}</strong>,</p>
                            <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                                Good news! Your ${agencyName ? `agency ${agencyName}` : "agency"} has just validated the following step of your application: <br/>
                                <strong style="color: #059669;">${stepLabel}</strong>
                            </p>
                            <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                                Please log in to your dashboard to see the details and track the progress of the next step.
                            </p>
                        </div>
                    </div>
                `
            });
        }

        // Auto-unlock next step ONLY IF status is APPROVED
        if (data.status === "APPROVED") {
            if (currentIdx !== -1 && currentIdx < appSteps.length - 1) {
                const nextStep = appSteps[currentIdx + 1];

                if (nextStep && nextStep.isLocked) {
                    await prisma.applicationStep.update({
                        where: { id: nextStep.id },
                        data: {
                            isLocked: false,
                            status: "IN_PROGRESS"
                        }
                    });
                }
            }
        }

        // Audit Log — always record the actor's role (Agent vs Admin) so the
        // change is traceable even though both roles can act on a step.
        const actorRole = (session.user as any).role === "ADMIN" ? "Admin" : "Agent";
        await prisma.auditLog.create({
            data: {
                action: "STEP_UPDATE",
                details: auditDetails("stepUpdatedByActor", { actorRole, actorName: session.user.name, stepType: step.type, status: data.status || step.status }),
                userId: session.user.id,
                targetId: step.applicationId
            }
        });

        revalidatePath(`/dashboard/agent/applications/${step.applicationId}`);
        return { success: true, step: updatedStep };
    } catch (e: any) {
        console.error("Step Update Error:", e);
        return { error: e.message || "Failed to update step." };
    }
}

export async function addStepCommentAction(stepId: string, comment: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    try {
        const step = await prisma.applicationStep.findUnique({
            where: { id: stepId }
        });

        if (!step) return { error: "Step not found." };

        await prisma.message.create({
            data: {
                content: comment,
                procedureId: step.id,
                senderId: session.user.id
            }
        });

        revalidatePath(`/dashboard/agent/applications/${step.applicationId}`);
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Failed to add comment." };
    }
}
export async function createDocumentUploadAction(
    stepId: string,
    fileName: string,
    contentType: string,
    fileSize: number
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    const agencyId = (session.user as any).agencyId;

    try {
        if (!fileName || !fileName.trim()) {
            return { error: "File name is required." };
        }

        if (!contentType) {
            return { error: "File type is required." };
        }

        // 20 MB maximum
        const MAX_FILE_SIZE = 20 * 1024 * 1024;

        if (fileSize > MAX_FILE_SIZE) {
            return {
                error: "File is too large. Maximum size is 20 MB."
            };
        }

        const step = await prisma.applicationStep.findUnique({
            where: { id: stepId },
            include: {
                application: true
            }
        });

        if (!step) {
            return { error: "Step not found." };
        }

        if (step.application.agencyId !== agencyId) {
            return {
                error: "This application does not belong to your agency."
            };
        }

        const safeFileName = fileName
            .trim()
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        const key = [
            "documents",
            agencyId,
            step.applicationId,
            stepId,
            `${crypto.randomUUID()}-${safeFileName}`
        ].join("/");

        const uploadUrl = await createS3UploadUrl(
            key,
            contentType
        );

        return {
            success: true,
            uploadUrl,
            storageKey: key
        };
    } catch (e: any) {
        console.error("S3 upload URL error:", e);

        return {
            error: e.message || "Failed to prepare document upload."
        };
    }
}

export async function addDocumentAction(
    stepId: string,
    name: string,
    storageKey: string,
    type: string = "OTHER"
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    const agencyId = (session.user as any).agencyId;

    try {
        const step = await prisma.applicationStep.findUnique({
            where: { id: stepId },
            include: {
                application: {
                    include: {
                        client: true
                    }
                }
            }
        });

        if (!step) {
            return { error: "Step not found." };
        }

        if (step.application.agencyId !== agencyId) {
            return {
                error: "This application does not belong to your agency."
            };
        }

        if (!storageKey || !storageKey.startsWith(`documents/${agencyId}/`)) {
            return {
                error: "Invalid document storage location."
            };
        }

        const document = await prisma.document.create({
            data: {
                name,
                // Keep this field populated for compatibility.
                // Downloads for new files will use storageKey.
                fileUrl: "",
                storageKey,
                type: type as any,
                status: "UPLOADED",
                procedureId: stepId,
                uploaderId: session.user.id
            }
        });

        await prisma.auditLog.create({
            data: {
                action: "DOCUMENT_UPLOAD",
                details: auditDetails("documentUploadedByActor", { actorName: session.user.name, docName: name, clientName: step.application.client.name, stepType: step.type }),
                userId: session.user.id,
                agencyId,
                targetId: step.applicationId
            }
        });

        revalidatePath(
            `/dashboard/agent/applications/${step.applicationId}`
        );

        return {
            success: true,
            document
        };
    } catch (e: any) {
        console.error("Document upload error:", e);

        return {
            error: e.message || "Failed to attach document."
        };
    }
}

export async function deleteDocumentAction(documentId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    const agencyId = (session.user as any).agencyId;

    try {
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                Procedure: {
                    include: {
                        application: true
                    }
                }
            }
        });

        if (!document) {
            return { error: "Document not found." };
        }

        if (
            document.Procedure.application.agencyId !== agencyId
        ) {
            return {
                error: "This document does not belong to your agency."
            };
        }

        // Delete from S3 only when this is an S3 document.
        // Old UploadThing documents can remain untouched.
        if (document.storageKey) {
            await deleteS3Object(document.storageKey);
        }

        await prisma.document.delete({
            where: { id: documentId }
        });

        await prisma.auditLog.create({
            data: {
                action: "DOCUMENT_DELETE",
                details: auditDetails("documentDeletedByActor", { actorName: session.user.name, docName: document.name }),
                userId: session.user.id,
                agencyId,
                targetId: document.Procedure.applicationId
            }
        });

        revalidatePath(
            `/dashboard/agent/applications/${document.Procedure.applicationId}`
        );

        return { success: true };
    } catch (e: any) {
        console.error("Document delete error:", e);

        return {
            error: e.message || "Failed to delete document."
        };
    }
}
export async function toggleSubStepAction(subStepId: string, status: ProcedureStatus) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }
    const agencyId = (session.user as any).agencyId;

    try {
        const subStep = await prisma.applicationSubStep.findUnique({
            where: { id: subStepId },
            include: {
                applicationStep: {
                    include: { application: true }
                }
            }
        });

        if (!subStep) return { error: "Sub-step not found." };
        if (subStep.applicationStep.application.agencyId !== agencyId) {
            return { error: "This sub-step does not belong to your agency." };
        }

        // Once the parent is approved, its children become part of the
        // approved history and cannot be changed underneath it.
        if (subStep.applicationStep.status === "APPROVED" && status !== "APPROVED") {
            return { error: "You cannot change a sub-step after its parent step has been approved." };
        }

        const updatedSubStep = await prisma.applicationSubStep.update({
            where: { id: subStepId },
            data: {
                status,
                // Keep the old boolean in sync for compatibility with the
                // client-facing stepper that still reads isCompleted.
                isCompleted: status === "APPROVED"
            }
        });

        revalidatePath(`/dashboard/agent/applications/${subStep.applicationStep.applicationId}`);
        return { success: true, subStep: updatedSubStep };
    } catch (e: any) {
        return { error: e.message || "Failed to update sub-step." };
    }
}

export async function getClientsAndTemplates() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }
    const isAdmin = (session.user as any).role === "ADMIN";
    const agencyId = (session.user as any).agencyId;
    if (!agencyId) return { error: "Your account is not linked to an agency." };

    const [clients, templates] = await Promise.all([
        prisma.user.findMany({
            where: isAdmin ? { role: "CLIENT", agencyId } : { role: "CLIENT", agentId: session.user.id },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" }
        }),
        getAgencyTemplates(agencyId)
    ]);

    return { clients, templates: templates.filter((t) => t.isActive) };
}

export async function createApplicationAction(clientId: string, templateId: string, country: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }
    const isAdmin = (session.user as any).role === "ADMIN";
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

        if (!client || client.role !== "CLIENT" || client.agencyId !== agencyId) {
            return { error: "This client does not belong to your agency." };
        }
        if (!isAdmin && client.agentId !== session.user.id) {
            return { error: "This client is not assigned to you." };
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
                agentId: (session.user as any).role === "AGENT" ? session.user.id : client.agentId || null,
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
                details: auditDetails("applicationCreatedByAgent", { templateName: template.name, clientName: client.name, actorName: session.user.name }),
                userId: session.user.id,
                agencyId,
                targetId: application.id
            }
        });

        revalidatePath("/dashboard/agent/applications");
        return { success: true, application };
    } catch (e: any) {
        console.error("Create application error:", e);
        return { error: "Failed to create the application." };
    }
}

export async function finalizeProcedureAction(
    applicationId: string,
    customMessage?: string
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return { error: "Unauthorized access." };
    }

    try {
        const application = await prisma.application.findUnique({
            where: { id: applicationId },
            include: {
                client: true,
                steps: {
                    orderBy: { order: "asc" }
                }
            }
        });

        if (!application) return { error: "Procedure not found." };

        const agencyName = await getApplicationAgencyName(application.agencyId);
        const finalMessage = customMessage?.trim() ||
            "Congratulations! Your immigration procedure has been successfully completed. We were delighted to guide you through every step of this journey and wish you all the best for your future!";

        await prisma.$transaction(async (tx) => {
            // 1. Update Application status to COMPLETED
            await tx.application.update({
                where: { id: applicationId },
                data: { status: "COMPLETED" as ApplicationStatus }
            });

            // 2. Also mark any remaining non-approved steps as APPROVED
            await tx.applicationStep.updateMany({
                where: {
                    applicationId,
                    status: { not: "APPROVED" }
                },
                data: {
                    status: "APPROVED" as ProcedureStatus,
                    isLocked: false
                }
            });

            // 3. Create OfficialMessage for client dashboard
            await tx.officialMessage.create({
                data: {
                    subject: "Procedure Completed - Congratulations!",
                    content: finalMessage,
                    senderId: session.user.id,
                    receiverId: application.clientId
                }
            });

            // 4. Create in-step thread message if step exists
            const firstStep = application.steps[0];
            if (firstStep) {
                const actorRole = (session.user as any).role === "ADMIN" ? "ADMIN" : "AGENT";
                await tx.message.create({
                    data: {
                        content: `🎉 ${actorRole} FINALIZED PROCEDURE: ${finalMessage}`,
                        procedureId: firstStep.id,
                        senderId: session.user.id
                    }
                });
            }

            // 5. Audit Log
            await tx.auditLog.create({
                data: {
                    action: "FINALIZE_PROCEDURE",
                    details: auditDetails("procedureFinalizedByActor", {
                        applicationId,
                        country: application.country,
                        clientName: application.client.name,
                        clientEmail: application.client.email,
                        actorName: session.user.name,
                    }),
                    userId: session.user.id,
                    agencyId: application.agencyId,
                    targetId: applicationId
                }
            });
        });

        // 6. Send celebratory email notification to client via Resend
        if (application.client.email) {
            try {
                await sendEmail({
                    to: application.client.email,
                    subject: `🎉 Congratulations! Your Procedure is Complete - ${agencyName || "ATLE Immigration"}`,
                    fromName: agencyName || undefined,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <div style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); padding: 30px 20px; text-align: center;">
                                <div style="font-size: 40px; margin-bottom: 8px;">🎉</div>
                                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">Procedure Completed!</h1>
                                <p style="color: #ecfdf5; margin: 8px 0 0 0; font-size: 14px;">Destination: <strong>${application.country}</strong></p>
                            </div>
                            <div style="padding: 30px; background-color: #ffffff;">
                                <p style="font-size: 16px; color: #1f2937;">Hello <strong>${application.client.name}</strong>,</p>
                                <p style="font-size: 15px; color: #374151; line-height: 1.6;">
                                    ${finalMessage}
                                </p>
                                <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                    <p style="font-size: 14px; color: #065f46; margin: 0; font-weight: 600;">
                                        ✓ All steps and requirements for this procedure have been fully verified and approved.
                                    </p>
                                </div>
                                <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
                                    You can access your completed documents and official confirmation messages anytime by logging into your client dashboard.
                                </p>
                                <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
                                    <p style="font-size: 13px; color: #9ca3af; margin: 0;">
                                        Thank you for trusting <strong>${agencyName || "our team"}</strong> to guide you through this journey.
                                    </p>
                                </div>
                            </div>
                        </div>
                    `
                });
            } catch (emailErr) {
                console.error("Failed to send finalization email:", emailErr);
            }
        }

        revalidatePath("/dashboard/agent/applications");
        revalidatePath(`/dashboard/agent/applications/${applicationId}`);
        revalidatePath("/admin/dashboard/applications");
        revalidatePath("/dashboard/client");
        return { success: true };
    } catch (e: any) {
        console.error("Finalize Procedure Error:", e);
        return { error: e.message || "Failed to finalize procedure." };
    }
}