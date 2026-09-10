"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ProcedureStatus } from "@prisma/client";
import { auditDetails } from "@/lib/audit-log";

const AGENT_ONLY_STEPS = ["DIPLOMA_EQUIVALENCE", "PROFILE_CREATION", "APPLICATION_SUBMISSION", "PASSPORT_SUBMISSION"];

export async function submitProcedureAction(stepId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) return { error: "Unauthorized" };

    const step = await prisma.applicationStep.findUnique({
        where: { id: stepId },
        include: { application: { include: { steps: true } } }
    });

    if (!step || step.application.clientId !== session.user.id) {
        return { error: "Step not found." };
    }

    // Role-based validation: Clients cannot submit Agent-Only steps
    if (step.type && AGENT_ONLY_STEPS.includes(step.type)) {
        return { error: "This step is handled strictly by the agent. You will be notified when it is complete." };
    }

    if (step.isLocked && step.status !== "PENDING") {
        return { error: "This step is locked." };
    }

    try {
        const appSteps = [...step.application.steps].sort((a, b) => a.order - b.order);
        const currentIdx = appSteps.findIndex(s => s.id === step.id);
        const isClientFinalizableStep = currentIdx < 4; // Steps 1 through 4 can be completed by the client

        if (isClientFinalizableStep) {
            await prisma.applicationStep.update({
                where: { id: stepId },
                data: {
                    isLocked: true,
                    status: "APPROVED" as ProcedureStatus,
                }
            });

            // Find the next step in the sequence and unlock it
            if (currentIdx !== -1 && currentIdx < appSteps.length - 1) {
                const nextStep = appSteps[currentIdx + 1];

                if (nextStep) {
                    await prisma.applicationStep.update({
                        where: { id: nextStep.id },
                        data: {
                            isLocked: false,
                            status: "IN_PROGRESS" as ProcedureStatus
                        }
                    });
                }
            }
        } else {
            // For Step 5 and onwards, keep the step pending for agent review
            await prisma.applicationStep.update({
                where: { id: stepId },
                data: {
                    status: "IN_PROGRESS" as ProcedureStatus,
                    isLocked: true
                }
            });
        }

        // Update overall application status if it was PENDING
        if (step.application.status === "PENDING") {
            await prisma.application.update({
                where: { id: step.applicationId },
                data: { status: "IN_PROGRESS" }
            });
        }

        // Audit Log
        await prisma.auditLog.create({
            data: {
                action: "STEP_SUBMISSION",
                details: auditDetails("clientCompletedStep", {
                    stepType: step.type,
                    country: step.application.country,
                    status: isClientFinalizableStep ? "APPROVED" : "IN_PROGRESS",
                }),
                userId: session.user.id,
                targetId: step.applicationId
            }
        });

        revalidatePath(`/dashboard/client/applications/${step.applicationId}`);
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Failed to submit step." };
    }
}

// Clients can no longer upload or remove documents themselves — only an
// agent or admin can (see app/[locale]/dashboard/agent/applications/actions.ts).
// Kept as a hard server-side rejection (not just a hidden UI) so the
// restriction holds even if something still calls this action directly.
export async function addDocumentAction(formData: FormData) {
    return { error: "Only your agent or the agency admin can upload documents for this step." };
}

export async function deleteDocumentAction(documentId: string) {
    return { error: "Only your agent or the agency admin can remove documents for this step." };
}