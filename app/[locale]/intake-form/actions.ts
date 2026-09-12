"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auditDetails } from "@/lib/audit-log";
import { extractProfileSyncFields } from "@/lib/intake-form/engine";

async function requireClient() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "CLIENT") return null;
    return session;
}

/**
 * Fetches the client's in-progress or submitted intake form, creating an
 * empty draft on first visit.
 */
export async function getOrCreateIntakeFormAction() {
    const session = await requireClient();
    if (!session) return { error: "Unauthorized access." };

    try {
        const existing = await prisma.intakeFormResponse.findUnique({
            where: { clientId: session.user.id },
        });

        if (existing) {
            return { success: true, form: existing };
        }

        const created = await prisma.intakeFormResponse.create({
            data: { clientId: session.user.id },
        });

        return { success: true, form: created };
    } catch (e: any) {
        console.error("Get/create intake form error:", e);
        return { error: "Failed to load the intake form." };
    }
}

/**
 * Saves progress so far — called after every step, so the client can leave
 * and come back later without losing anything already answered.
 */
export async function saveIntakeFormProgressAction(
    answers: Record<string, any>,
    currentSection: string | null
) {
    const session = await requireClient();
    if (!session) return { error: "Unauthorized access." };

    try {
        const existing = await prisma.intakeFormResponse.findUnique({
            where: { clientId: session.user.id },
        });

        if (existing?.status === "SUBMITTED") {
            return { error: "This form has already been submitted." };
        }

        await prisma.intakeFormResponse.upsert({
            where: { clientId: session.user.id },
            update: { answers, currentSection },
            create: { clientId: session.user.id, answers, currentSection },
        });

        return { success: true };
    } catch (e: any) {
        console.error("Save intake form progress error:", e);
        return { error: "Failed to save your progress." };
    }
}

/**
 * Final submission — locks the form, and syncs every answer that maps to
 * a profile field onto the client's User record (nationality, phone,
 * date of birth, marital status, etc.), saving the agent from re-typing
 * it all by hand.
 */
export async function submitIntakeFormAction(answers: Record<string, any>) {
    const session = await requireClient();
    if (!session) return { error: "Unauthorized access." };

    try {
        const existing = await prisma.intakeFormResponse.findUnique({
            where: { clientId: session.user.id },
        });

        if (existing?.status === "SUBMITTED") {
            return { error: "This form has already been submitted." };
        }

        const country = answers.destinationCountry || null;
        const profileUpdates = extractProfileSyncFields(country, answers);

        await prisma.$transaction(async (tx) => {
            await tx.intakeFormResponse.upsert({
                where: { clientId: session.user.id },
                update: {
                    answers,
                    country,
                    status: "SUBMITTED",
                    submittedAt: new Date(),
                },
                create: {
                    clientId: session.user.id,
                    answers,
                    country,
                    status: "SUBMITTED",
                    submittedAt: new Date(),
                },
            });

            if (Object.keys(profileUpdates).length > 0) {
                await tx.user.update({
                    where: { id: session.user.id },
                    data: profileUpdates,
                });
            }

            await tx.auditLog.create({
                data: {
                    action: "SUBMIT_INTAKE_FORM",
                    details: auditDetails("intakeFormSubmitted", {
                        clientName: session.user.name,
                        country: country || "N/A",
                    }),
                    userId: session.user.id,
                    agencyId: (session.user as any).agencyId,
                    targetId: session.user.id,
                },
            });
        });

        revalidatePath("/dashboard/client");
        return { success: true };
    } catch (e: any) {
        console.error("Submit intake form error:", e);
        return { error: "Failed to submit the form. Please try again." };
    }
}