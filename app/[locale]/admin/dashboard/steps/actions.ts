"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAgencyTemplates, getTemplateSteps } from "@/lib/steps-server";
import { StepDefinition, APP_STEP_SEQUENCE, STEP_LABELS } from "@/lib/steps";
import { ProcedureType } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { checkWorkflowQuota } from "@/lib/subscription";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "ADMIN") return null;
    const agencyId = (session.user as any).agencyId;
    if (!agencyId) return null;
    return { session, agencyId };
}

export async function getTemplates() {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };
    return { templates: await getAgencyTemplates(ctx.agencyId) };
}

export async function createTemplateAction(
    name: string,
    description: string
): Promise<{ error?: string; code?: "NO_SUBSCRIPTION" | "INACTIVE" | "QUOTA_EXCEEDED"; success?: boolean; templateId?: string }> {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };

    if (!name || !name.trim()) return { error: "Give this workflow a name." };

    const quota = await checkWorkflowQuota(ctx.agencyId);
    if (!quota.ok) {
        return { error: quota.error, code: quota.code };
    }

    try {
        // Clone the agency's current "Default" workflow as the starting
        // point for every new one.
        const defaultTemplate = await prisma.applicationTemplate.findFirst({
            where: { agencyId: ctx.agencyId, name: "Default" }
        });

        const seedSteps = defaultTemplate
            ? await getTemplateSteps(defaultTemplate.id)
            : await (async () => {
                  // If no Default workflow exists, create the built-in catalog
                  // with NULL labels. The label is resolved from next-intl at
                  // display time, so it never gets frozen in the language used
                  // when the workflow was created.
                  return APP_STEP_SEQUENCE.map((type, index) => ({
                      type: type as ProcedureType,
                      label: null as string | null,
                      description: null as string | null,
                      order: index,
                      subSteps: [] as { label: string; description: string | null; order: number }[],
                      requiredDocuments: [] as string[]
                  }));
              })();

        const template = await prisma.applicationTemplate.create({
            data: {
                agencyId: ctx.agencyId,
                name: name.trim(),
                description: description?.trim() || null,
                steps: {
                    create: seedSteps.map((s, index) => ({
                        type: s.type,
                        // Built-in default labels are never stored. Only a
                        // genuinely custom literal label is persisted.
                        label:
                            s.type && s.label?.trim() === STEP_LABELS[s.type]
                                ? null
                                : s.label?.trim() || null,
                        description: s.description,
                        order: index,
                        requiredDocuments: s.requiredDocuments,
                        subSteps: {
                            create: s.subSteps.map((sub, subIndex) => ({
                                label: sub.label,
                                description: sub.description,
                                order: subIndex
                            }))
                        }
                    }))
                }
            }
        });

        await prisma.auditLog.create({
            data: {
                action: "CREATE_APPLICATION_TEMPLATE",
                details: `Admin ${ctx.session.user.name} created the application workflow "${template.name}".`,
                userId: ctx.session.user.id,
                agencyId: ctx.agencyId,
                targetId: template.id
            }
        });

        revalidatePath("/admin/dashboard/steps");
        return { success: true, templateId: template.id };
    } catch (e: any) {
        console.error("Create template error:", e);
        return { error: "Failed to create the workflow." };
    }
}

export async function deleteTemplateAction(templateId: string, confirmationName?: string) {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };

    try {
        const template = await prisma.applicationTemplate.findUnique({ where: { id: templateId } });
        if (!template || template.agencyId !== ctx.agencyId) return { error: "Workflow not found." };
        if (confirmationName?.trim() !== template.name) {
            return { error: "Type the workflow name exactly to confirm deletion." };
        }

        const inUse = await prisma.application.count({ where: { applicationTemplateId: templateId } });
        if (inUse > 0) {
            await prisma.applicationTemplate.update({ where: { id: templateId }, data: { isActive: false } });
        } else {
            await prisma.applicationTemplate.delete({ where: { id: templateId } });
        }

        revalidatePath("/admin/dashboard/steps");
        return { success: true };
    } catch (e: any) {
        return { error: "Failed to remove the workflow." };
    }
}

export async function getTemplateForEditing(templateId: string) {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };

    const template = await prisma.applicationTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.agencyId !== ctx.agencyId) return { error: "Workflow not found." };

    const steps = await getTemplateSteps(templateId);
    return { template: { id: template.id, name: template.name, description: template.description }, steps };
}

export interface StepInput {
    type: ProcedureType | null;
    label: string;
    description: string;
    isActive: boolean;
    subSteps: { label: string; description: string }[];
    requiredDocuments: string[];
}

export async function saveTemplateStepsAction(templateId: string, steps: StepInput[]) {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };

    const template = await prisma.applicationTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.agencyId !== ctx.agencyId) return { error: "Workflow not found." };

    if (!Array.isArray(steps) || steps.length === 0) {
        return { error: "At least one step is required." };
    }

    // A built-in step can have an empty label because its displayed name comes
    // from next-intl. A custom step (type === null) must have its own name.
    for (const s of steps) {
        if (!s.type && (!s.label || !s.label.trim())) {
            return { error: "Every custom step needs a name." };
        }
    }

    if (!steps.some((s) => s.isActive)) {
        return { error: "At least one step must be active." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.stepTemplate.deleteMany({ where: { applicationTemplateId: templateId } });

            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                const trimmedLabel = s.label?.trim() || "";

                await tx.stepTemplate.create({
                    data: {
                        applicationTemplateId: templateId,
                        type: s.type || null,
                        // Empty label means "use the translated built-in label".
                        // Custom labels are still preserved exactly as entered.
                        label: trimmedLabel || null,
                        description: s.description?.trim() || null,
                        order: i,
                        isActive: s.isActive,
                        requiredDocuments: (s.requiredDocuments || []).map((d) => d.trim()).filter(Boolean),
                        subSteps: {
                            create: s.subSteps
                                .filter((sub) => sub.label && sub.label.trim())
                                .map((sub, subIndex) => ({
                                    label: sub.label.trim(),
                                    description: sub.description?.trim() || null,
                                    order: subIndex
                                }))
                        }
                    }
                });
            }
        });

        await prisma.auditLog.create({
            data: {
                action: "UPDATE_APPLICATION_TEMPLATE",
                details: `Admin ${ctx.session.user.name} updated the application workflow "${template.name}".`,
                userId: ctx.session.user.id,
                agencyId: ctx.agencyId,
                targetId: templateId
            }
        });

        revalidatePath(`/admin/dashboard/steps/${templateId}`);
        return { success: true };
    } catch (e: any) {
        console.error("Save template steps error:", e);
        return { error: "Failed to save the workflow." };
    }
}

/** Built-in step types an admin can optionally attach to a step. */
export async function getBuiltInTypeOptions() {
    const t = await getTranslations("stepTypeLabels");
    return APP_STEP_SEQUENCE.map((type) => ({ type, label: t(type) }));
}