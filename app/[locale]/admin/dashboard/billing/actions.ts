"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { initializePayment } from "@/lib/campay";
import { getLocale } from "next-intl/server";

const CURRENCY = "XAF";

type CheckoutResult = {
    success?: boolean;
    error?: string;
    paymentUrl?: string;
    txRef?: string;
    paymentReference?: string;
};

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "ADMIN") return null;
    const agencyId = (session.user as any).agencyId;
    if (!agencyId) return null;
    return { session, agencyId };
}

export async function getAvailablePlans() {
    return prisma.plan.findMany({
        where: { isPublic: true },
        orderBy: { priceFcfa: "asc" },
    });
}

/**
 * Free plans and downgrades never touch CamPay — they just change
 * the subscription directly. Paid upgrades create a PENDING Payment and
 * hand back a CamPay checkout link for the browser to redirect to;
 * the plan itself only changes once that payment is confirmed (see
 * lib/subscription-payments.ts, called from the webhook and the
 * redirect-back page).
 */
/**
 * Shared paid-checkout logic: creates the PENDING Payment row and kicks off
 * the CamPay flow (card or mobile money) for any target plan — the plan
 * itself only changes once the payment is confirmed (see
 * lib/subscription-payments.ts). Used by both the regular plan-picker
 * upgrade flow and the custom-plan flow, since a custom plan is really
 * just a Plan row created on the fly.
 */
async function processPaidCheckout({
    session,
    agencyId,
    subscription,
    newPlan,
    paymentMethod,
    phoneNumber,
}: {
    session: any;
    agencyId: string;
    subscription: { id: string };
    newPlan: { id: string; name: string; priceFcfa: number };
    paymentMethod: string;
    phoneNumber: string;
}): Promise<CheckoutResult> {
    if (paymentMethod !== "MTN_MOBILE_MONEY" && paymentMethod !== "ORANGE_MONEY" && paymentMethod !== "CARD") {
        return { error: "Please select a payment method (MTN Mobile Money, Orange Money, or Card)." };
    }

    let normalizedPhone = phoneNumber.replace(/\D/g, "");
    if (paymentMethod === "MTN_MOBILE_MONEY" || paymentMethod === "ORANGE_MONEY") {
        if (normalizedPhone.startsWith("237") && normalizedPhone.length === 12) {
            // Already 2376XXXXXXXX
        } else if (normalizedPhone.length === 9 && normalizedPhone.startsWith("6")) {
            normalizedPhone = `237${normalizedPhone}`;
        } else {
            return { error: "Enter a valid Cameroon mobile number (e.g. 6XX XX XX XX or 2376XXXXXXXX)." };
        }
    }

    const txRef = `UPG-${agencyId.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    await prisma.payment.create({
        data: {
            subscriptionId: subscription.id,
            amountFcfa: newPlan.priceFcfa,
            status: "PENDING",
            reference: txRef,
            targetPlanId: newPlan.id,
            method: paymentMethod === "MTN_MOBILE_MONEY"
                ? "MTN_MOBILE_MONEY"
                : paymentMethod === "ORANGE_MONEY"
                ? "ORANGE_MONEY"
                : "CARD",
        },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
    const locale = await getLocale();
    const verifyUrl = `${appUrl}/${locale}/admin/dashboard/billing/verify?ref=${encodeURIComponent(txRef)}`;

    if (paymentMethod === "CARD") {
        const init = await initializePayment({
            txRef,
            amount: newPlan.priceFcfa,
            redirectUrl: verifyUrl,
            customerEmail: session.user.email,
            customerName: session.user.name || "Customer",
            title: `${newPlan.name} plan subscription`,
        });

        if (!init.ok || !init.paymentUrl) {
            await prisma.payment.update({ where: { reference: txRef }, data: { status: "FAILED" } });
            return { error: init.error || "Could not start the card payment." };
        }

        if (init.gatewayReference) {
            await prisma.payment.update({
                where: { reference: txRef },
                data: { gatewayTransactionId: init.gatewayReference },
            });
        }

        return { success: true, paymentUrl: init.paymentUrl, txRef };
    }

    const { collectMobileMoney } = await import("@/lib/campay");
    const collect = await collectMobileMoney({
        txRef,
        amount: newPlan.priceFcfa,
        phoneNumber: normalizedPhone,
        description: `${newPlan.name} subscription`,
    });

    if (!collect.ok || !collect.gatewayReference) {
        await prisma.payment.update({ where: { reference: txRef }, data: { status: "FAILED" } });
        return { error: collect.error || "Could not start the Mobile Money payment. Please verify your phone number." };
    }

    await prisma.payment.update({
        where: { reference: txRef },
        data: { gatewayTransactionId: collect.gatewayReference },
    });

    return {
        success: true,
        txRef,
        paymentReference: collect.gatewayReference,
    };
}

export async function upgradeSubscriptionAction(formData: FormData): Promise<CheckoutResult> {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };
    const { session, agencyId } = ctx;

    const planId = String(formData.get("planId") || "");
    const paymentMethod = String(formData.get("paymentMethod") || "");
    const phoneNumber = String(formData.get("phoneNumber") || "").replace(/\D/g, "");

    if (!planId) return { error: "Select a plan." };

    try {
        const [subscription, newPlan] = await Promise.all([
            prisma.subscription.findUnique({ where: { agencyId }, include: { plan: true } }),
            prisma.plan.findUnique({ where: { id: planId } }),
        ]);

        if (!subscription) return { error: "No subscription found for your agency." };
        if (!newPlan || !newPlan.isPublic) return { error: "This plan is not available." };
        if (newPlan.id === subscription.planId) return { error: "You are already on this plan." };

        // If plan is free (0 FCFA), switch immediately
        if (newPlan.priceFcfa === 0) {
            await prisma.$transaction(async (tx) => {
                await tx.subscription.update({
                    where: { agencyId },
                    data: {
                        planId: newPlan.id,
                        pendingPlanId: null,
                        status: "ACTIVE",
                        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    },
                });

                await tx.auditLog.create({
                    data: {
                        action: "UPGRADE_SUBSCRIPTION",
                        details: `Agency switched to the free plan "${newPlan.name}".`,
                        userId: session.user.id,
                        agencyId,
                        targetId: subscription.id,
                    },
                });
            });

            revalidatePath("/admin/dashboard/billing");
            return { success: true };
        }

        return await processPaidCheckout({ session, agencyId, subscription, newPlan, paymentMethod, phoneNumber });
    } catch (e: any) {
        console.error("Upgrade subscription error:", e);
        return { error: e.message || "Failed to update your subscription." };
    }
}

/**
 * The custom-plan flow: an agency picks its own agent/client limits, we
 * calculate the price from the (super-admin-editable) pricing settings,
 * create a private one-off Plan row for exactly those limits, then run it
 * through the same paid-checkout flow as any other plan.
 */
export async function createCustomPlanAndCheckoutAction(formData: FormData): Promise<CheckoutResult> {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };
    const { session, agencyId } = ctx;

    const numAgents = parseInt((formData.get("numAgents") as string) || "", 10);
    const numClients = parseInt((formData.get("numClients") as string) || "", 10);
    const paymentMethod = String(formData.get("paymentMethod") || "");
    const phoneNumber = String(formData.get("phoneNumber") || "").replace(/\D/g, "");

    if (Number.isNaN(numAgents) || numAgents < 1 || Number.isNaN(numClients) || numClients < 1) {
        return { error: "Enter a valid number of agents and clients (at least 1 each)." };
    }

    try {
        const { getPricingSettings, calculateCustomPlanPrice } = await import("@/lib/pricing");
        const [subscription, pricingSettings] = await Promise.all([
            prisma.subscription.findUnique({ where: { agencyId } }),
            getPricingSettings(),
        ]);

        if (!subscription) return { error: "No subscription found for your agency." };

        const priceFcfa = calculateCustomPlanPrice(numAgents, numClients, pricingSettings);

        const newPlan = await prisma.plan.create({
            data: {
                name: `Sur mesure (${numAgents} agents, ${numClients} clients)`,
                slug: `custom-${agencyId.slice(0, 8)}-${Date.now()}`,
                priceFcfa,
                maxAgents: numAgents,
                maxClients: numClients,
                isPublic: false,
            },
        });

        if (priceFcfa === 0) {
            await prisma.$transaction(async (tx) => {
                await tx.subscription.update({
                    where: { agencyId },
                    data: {
                        planId: newPlan.id,
                        pendingPlanId: null,
                        status: "ACTIVE",
                        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    },
                });

                await tx.auditLog.create({
                    data: {
                        action: "UPGRADE_SUBSCRIPTION",
                        details: `Agency switched to a custom plan (${numAgents} agents, ${numClients} clients).`,
                        userId: session.user.id,
                        agencyId,
                        targetId: subscription.id,
                    },
                });
            });

            revalidatePath("/admin/dashboard/billing");
            return { success: true };
        }

        return await processPaidCheckout({ session, agencyId, subscription, newPlan, paymentMethod, phoneNumber });
    } catch (e: any) {
        console.error("Create custom plan error:", e);
        return { error: e.message || "Failed to create your custom plan." };
    }
}

export async function cancelPendingDowngradeAction() {
    const ctx = await requireAdmin();
    if (!ctx) return { error: "Unauthorized access." };
    const { session, agencyId } = ctx;

    try {
        await prisma.subscription.update({
            where: { agencyId },
            data: { pendingPlanId: null },
        });

        await prisma.auditLog.create({
            data: {
                action: "CANCEL_PLAN_DOWNGRADE",
                details: "Agency cancelled a scheduled plan downgrade.",
                userId: session.user.id,
                agencyId,
            },
        });

        revalidatePath("/admin/dashboard/billing");
        return { success: true };
    } catch (e: any) {
        return { error: "Failed to cancel the scheduled downgrade." };
    }
}