"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPricingSettings } from "@/lib/pricing";

export { getPricingSettings };

export async function updatePricingSettingsAction(formData: FormData) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    const basePriceFcfa = parseInt((formData.get("basePriceFcfa") as string) || "", 10);
    const pricePerAgentFcfa = parseInt((formData.get("pricePerAgentFcfa") as string) || "", 10);
    const pricePerClientFcfa = parseInt((formData.get("pricePerClientFcfa") as string) || "", 10);

    if (
        Number.isNaN(basePriceFcfa) || basePriceFcfa < 0 ||
        Number.isNaN(pricePerAgentFcfa) || pricePerAgentFcfa < 0 ||
        Number.isNaN(pricePerClientFcfa) || pricePerClientFcfa < 0
    ) {
        return { error: "All amounts must be positive numbers." };
    }

    try {
        await prisma.pricingSettings.upsert({
            where: { id: "singleton" },
            update: { basePriceFcfa, pricePerAgentFcfa, pricePerClientFcfa },
            create: { id: "singleton", basePriceFcfa, pricePerAgentFcfa, pricePerClientFcfa },
        });

        await prisma.auditLog.create({
            data: {
                action: "UPDATE_PRICING_SETTINGS",
                details: `Custom plan pricing updated by Super Admin: base=${basePriceFcfa}, agent=${pricePerAgentFcfa}, client=${pricePerClientFcfa} FCFA.`,
                userId: session.user.id,
            },
        });

        revalidatePath("/super-admin/dashboard/settings");
        revalidatePath("/admin/dashboard/billing");
        return { success: true };
    } catch (e: any) {
        console.error("Update pricing settings error:", e);
        return { error: "Failed to update pricing settings." };
    }
}

async function requireSuperAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
        return null;
    }
    return session;
}

export async function getAllPlans() {
    const session = await requireSuperAdmin();
    if (!session) throw new Error("Unauthorized");

    return prisma.plan.findMany({
        orderBy: { priceFcfa: "asc" },
        include: { _count: { select: { subscriptions: true } } },
    });
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
    if (value === null) return null;
    const trimmed = (value as string).trim();
    if (trimmed === "") return null;
    const n = parseInt(trimmed, 10);
    return Number.isNaN(n) ? null : n;
}

export async function createPlanAction(formData: FormData) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    const name = (formData.get("name") as string)?.trim();
    const slug = (formData.get("slug") as string)?.trim()?.toLowerCase();
    const priceFcfa = parseInt((formData.get("priceFcfa") as string) || "0", 10);
    const maxAgents = parseOptionalInt(formData.get("maxAgents"));
    const maxClients = parseOptionalInt(formData.get("maxClients"));
    const isPublic = formData.get("isPublic") === "on";

    if (!name || !slug) return { error: "Name and slug are required." };
    if (Number.isNaN(priceFcfa) || priceFcfa < 0) return { error: "Price must be a positive number." };

    try {
        const existing = await prisma.plan.findUnique({ where: { slug } });
        if (existing) return { error: "A plan with this slug already exists." };

        const plan = await prisma.plan.create({
            data: { name, slug, priceFcfa, maxAgents, maxClients, isPublic },
        });

        await prisma.auditLog.create({
            data: {
                action: "CREATE_PLAN",
                details: `Plan "${name}" created by Super Admin.`,
                userId: session.user.id,
                targetId: plan.id,
            },
        });

        revalidatePath("/super-admin/dashboard/settings");
        return { success: true };
    } catch (e: any) {
        console.error("Create plan error:", e);
        return { error: "Failed to create plan." };
    }
}

export async function updatePlanAction(planId: string, formData: FormData) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    const name = (formData.get("name") as string)?.trim();
    const priceFcfa = parseInt((formData.get("priceFcfa") as string) || "0", 10);
    const maxAgents = parseOptionalInt(formData.get("maxAgents"));
    const maxClients = parseOptionalInt(formData.get("maxClients"));
    const isPublic = formData.get("isPublic") === "on";

    if (!name) return { error: "Name is required." };
    if (Number.isNaN(priceFcfa) || priceFcfa < 0) return { error: "Price must be a positive number." };

    try {
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return { error: "Plan not found." };

        await prisma.plan.update({
            where: { id: planId },
            data: { name, priceFcfa, maxAgents, maxClients, isPublic },
        });

        await prisma.auditLog.create({
            data: {
                action: "UPDATE_PLAN",
                details: `Plan "${name}" updated by Super Admin.`,
                userId: session.user.id,
                targetId: planId,
            },
        });

        revalidatePath("/super-admin/dashboard/settings");
        return { success: true };
    } catch (e: any) {
        console.error("Update plan error:", e);
        return { error: "Failed to update plan." };
    }
}

export async function deletePlanAction(planId: string) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    try {
        const plan = await prisma.plan.findUnique({
            where: { id: planId },
            include: {
                _count: {
                    select: { subscriptions: true },
                },
            },
        });

        if (!plan) return { error: "Plan not found." };

        if (plan._count.subscriptions > 0) {
            return {
                error: `Cannot delete plan "${plan.name}" because it is currently assigned to ${plan._count.subscriptions} active agenc${plan._count.subscriptions === 1 ? "y" : "ies"}. Please reassign them or set this plan to hidden.`,
            };
        }

        await prisma.$transaction(async (tx) => {
            // Unlink any pending downgrade/upgrade references
            await tx.subscription.updateMany({
                where: { pendingPlanId: planId },
                data: { pendingPlanId: null },
            });

            // Unlink any payment targetPlanId references
            await tx.payment.updateMany({
                where: { targetPlanId: planId },
                data: { targetPlanId: null },
            });

            // Delete the plan
            await tx.plan.delete({
                where: { id: planId },
            });

            await tx.auditLog.create({
                data: {
                    action: "DELETE_PLAN",
                    details: `Plan "${plan.name}" (${plan.slug}) deleted by Super Admin.`,
                    userId: session.user.id,
                    targetId: planId,
                },
            });
        });

        revalidatePath("/super-admin/dashboard/settings");
        revalidatePath("/admin/dashboard/billing");
        return { success: true };
    } catch (e: any) {
        console.error("Delete plan error:", e);
        return { error: e.message || "Failed to delete plan." };
    }
}