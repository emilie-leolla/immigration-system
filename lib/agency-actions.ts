"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * Returns the display name of the current user's own agency, or null for
 * accounts with no agency (e.g. Super Admin). Safe to call from any
 * authenticated user — only ever returns their own agency's public name.
 */
export async function getMyAgencyName(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = (session?.user as any)?.agencyId;
    if (!agencyId) return null;

    const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { name: true }
    });

    return agency?.name || null;
}

/**
 * Returns whether the current user's agency is on the free plan (or has
 * no working subscription at all, as a safety fallback). Returns null for
 * accounts with no agency (e.g. Super Admin) since the concept doesn't
 * apply to them.
 */
export async function getMyAgencySubscriptionStatus(): Promise<
    "ACTIVE" | "FREE" | null
> {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = (session?.user as any)?.agencyId;
    if (!agencyId) return null;

    const subscription = await prisma.subscription.findUnique({
        where: { agencyId },
        select: { status: true, plan: { select: { slug: true } } },
    });

    // No subscription row at all (shouldn't normally happen now, but
    // covers agencies created before the Free-plan-on-signup fix), an
    // inactive subscription, or one still sitting on the free plan — all
    // of these mean "show the Free Mode dialog".
    if (
        !subscription ||
        subscription.status !== "ACTIVE" ||
        subscription.plan.slug === "free"
    ) {
        return "FREE";
    }

    return "ACTIVE";
}