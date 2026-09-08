import prisma from "@/lib/prisma";

export async function getAgencySubscription(agencyId: string) {
    return prisma.subscription.findUnique({
        where: { agencyId },
        include: { plan: true },
    });
}

export async function checkAgentQuota(agencyId: string): Promise<{ ok: boolean; error?: string; code?: "NO_SUBSCRIPTION" | "INACTIVE" | "QUOTA_EXCEEDED" }> {
    const sub = await getAgencySubscription(agencyId);
    if (!sub) return { ok: false, code: "NO_SUBSCRIPTION", error: "No active subscription found for your agency." };
    if (sub.status !== "ACTIVE") {
        return { ok: false, code: "INACTIVE", error: "Your subscription is not active. New agents cannot be created until it's renewed." };
    }
    if (sub.plan.maxAgents === null) return { ok: true };

    const count = await prisma.user.count({ where: { agencyId, role: "AGENT" } });
    if (count >= sub.plan.maxAgents) {
        return { ok: false, code: "QUOTA_EXCEEDED", error: `Your plan (${sub.plan.name}) allows up to ${sub.plan.maxAgents} agent(s). Upgrade your plan to add more.` };
    }
    return { ok: true };
}

export async function checkClientQuota(agencyId: string): Promise<{ ok: boolean; error?: string; code?: "NO_SUBSCRIPTION" | "INACTIVE" | "QUOTA_EXCEEDED" }> {
    const sub = await getAgencySubscription(agencyId);
    if (!sub) return { ok: false, code: "NO_SUBSCRIPTION", error: "No active subscription found for your agency." };
    if (sub.status !== "ACTIVE") {
        return { ok: false, code: "INACTIVE", error: "Your subscription is not active. New clients cannot be created until it's renewed." };
    }
    if (sub.plan.maxClients === null) return { ok: true };

    const count = await prisma.user.count({ where: { agencyId, role: "CLIENT" } });
    if (count >= sub.plan.maxClients) {
        return { ok: false, code: "QUOTA_EXCEEDED", error: `Your plan (${sub.plan.name}) allows up to ${sub.plan.maxClients} client(s). Upgrade your plan to add more.` };
    }
    return { ok: true };
}

/**
 * Every agency automatically gets a "Default" workflow the first time they
 * visit the Procedure Steps page (see lib/steps-server.ts ensureDefaultTemplate),
 * before they've manually created anything themselves. That auto-provisioned
 * one doesn't count against the quota — only workflows the admin actively
 * created count, so a free-plan admin can still create their first custom
 * workflow.
 */
export async function checkWorkflowQuota(agencyId: string): Promise<{ ok: boolean; error?: string; code?: "NO_SUBSCRIPTION" | "INACTIVE" | "QUOTA_EXCEEDED" }> {
    const sub = await getAgencySubscription(agencyId);
    if (!sub) return { ok: false, code: "NO_SUBSCRIPTION", error: "No active subscription found for your agency." };
    if (sub.status !== "ACTIVE") {
        return { ok: false, code: "INACTIVE", error: "Your subscription is not active. New workflows cannot be created until it's renewed." };
    }
    if (sub.plan.maxWorkflows === null || sub.plan.maxWorkflows === undefined) return { ok: true };

    const count = await prisma.applicationTemplate.count({
        where: { agencyId, isActive: true, name: { not: "Default" } },
    });
    if (count >= sub.plan.maxWorkflows) {
        return { ok: false, code: "QUOTA_EXCEEDED", error: `Your plan (${sub.plan.name}) allows up to ${sub.plan.maxWorkflows} custom workflow(s). Upgrade your plan to create more.` };
    }
    return { ok: true };
}