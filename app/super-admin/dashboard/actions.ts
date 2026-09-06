"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * Make sure the current user is a SUPER_ADMIN.
 */
async function requireSuperAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
        return {
            session: null,
            error: "Unauthorized access.",
        };
    }

    return {
        session,
        error: null,
    };
}

/**
 * List every agency on the platform, with its user/application counts and
 * current plan — used by the super-admin agencies page.
 */
export async function getAgencies() {
    const { error } = await requireSuperAdmin();
    if (error) return [];

    const agencies = await prisma.agency.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            status: true,
            isInternal: true,
            createdAt: true,
            _count: {
                select: { users: true, applications: true },
            },
            subscription: {
                select: {
                    plan: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            priceFcfa: true,
                            maxAgents: true,
                            maxClients: true,
                            isPublic: true,
                        },
                    },
                },
            },
        },
    });

    return agencies.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
    }));
}

/**
 * List every plan on the platform — used to populate the plan picker
 * on the super-admin agencies page.
 */
export async function getPlans() {
    const { error } = await requireSuperAdmin();
    if (error) return [];

    return prisma.plan.findMany({
        orderBy: { priceFcfa: "asc" },
        select: {
            id: true,
            name: true,
            slug: true,
            priceFcfa: true,
            maxAgents: true,
            maxClients: true,
            isPublic: true,
        },
    });
}