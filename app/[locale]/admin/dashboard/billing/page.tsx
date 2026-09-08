import React from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Users,
    Briefcase,
    CreditCard,
} from "lucide-react";
import { getAvailablePlans } from "./actions";
import { getPricingSettings } from "@/lib/pricing";
import UpgradePlanSection from "./upgrade-plan-section";
import CustomPlanSection from "./custom-plan-section";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
    const t = await getTranslations("adminBilling");

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    const agencyId = (session?.user as any)?.agencyId;

    if (!agencyId) {
        return (
            <div className="max-w-4xl mx-auto p-8 text-center text-gray-500">
                {t("noAgencyLinked")}
            </div>
        );
    }

    const [
        subscription,
        agentCount,
        clientCount,
        plans,
        pricingSettings,
    ] = await Promise.all([
        prisma.subscription.findUnique({
            where: {
                agencyId,
            },
            include: {
                plan: true,
                pendingPlan: true,
                payments: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 10,
                },
            },
        }),

        prisma.user.count({
            where: {
                agencyId,
                role: "AGENT",
            },
        }),

        prisma.user.count({
            where: {
                agencyId,
                role: "CLIENT",
            },
        }),

        getAvailablePlans(),
        getPricingSettings(),
    ]);

    if (!subscription) {
        return (
            <div className="max-w-4xl mx-auto p-8 text-center text-gray-500">
                {t("noSubscription")}
            </div>
        );
    }

    const { plan } = subscription;

    const agentPct = plan.maxAgents
        ? Math.min(
              100,
              Math.round(
                  (agentCount / plan.maxAgents) * 100
              )
          )
        : 0;

    const clientPct = plan.maxClients
        ? Math.min(
              100,
              Math.round(
                  (clientCount / plan.maxClients) * 100
              )
          )
        : 0;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <h1
                    className="text-2xl font-bold"
                    style={{
                        color: "#2b62f8ff",
                    }}
                >
                    {t("title")}
                </h1>

                <p className="text-gray-500 text-sm mt-1">
                    {t("subtitle")}
                </p>
            </div>

            {/* Current subscription */}
            <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-[#2b62f8ff] text-white py-6">
                    <CardTitle className="flex items-center justify-between">
                        <span className="text-xl font-black flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />

                            {plan.name}{" "}
                            {t("planSuffix")}
                        </span>

                        <span className="text-lg font-bold">
                            {plan.priceFcfa.toLocaleString()} FCFA
                            {t("perYear")}
                        </span>
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                    {/* Status */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-500">
                            {t("status")}
                        </span>

                        <span
                            className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                                subscription.status === "ACTIVE"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                        >
                            {subscription.status}
                        </span>
                    </div>

                    {/* Auto renew */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-500">
                            {t("autoRenew")}
                        </span>

                        <span className="font-bold text-gray-800">
                            {subscription.autoRenew
                                ? t("enabled")
                                : t("disabled")}
                        </span>
                    </div>

                    {/* Renewal date */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-500">
                            {t("renewsOn")}
                        </span>

                        <span className="font-bold text-gray-800">
                            {new Date(
                                subscription.currentPeriodEnd
                            ).toLocaleDateString()}
                        </span>
                    </div>

                    {/* Usage */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        {/* Agents */}
                        <div>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1.5">
                                <span className="flex items-center gap-1.5">
                                    <Briefcase className="h-3.5 w-3.5" />

                                    {t("agents")}
                                </span>

                                <span>
                                    {agentCount} /{" "}
                                    {plan.maxAgents ?? "∞"}
                                </span>
                            </div>

                            {plan.maxAgents && (
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#1E3A8A]"
                                        style={{
                                            width: `${agentPct}%`,
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Clients */}
                        <div>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1.5">
                                <span className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />

                                    {t("clients")}
                                </span>

                                <span>
                                    {clientCount} /{" "}
                                    {plan.maxClients ?? "∞"}
                                </span>
                            </div>

                            {plan.maxClients && (
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#1E3A8A]"
                                        style={{
                                            width: `${clientPct}%`,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Change plan */}
            <div className="space-y-3">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                    {t("changePlan")}
                </h2>

                <UpgradePlanSection
                    plans={plans as any}
                    currentPlanId={plan.id}
                    pendingPlan={
                        subscription.pendingPlan as any
                    }
                />

                <CustomPlanSection pricing={pricingSettings as any} />
            </div>

            {/* Payment history */}
            <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="py-5 border-b border-gray-50">
                    <CardTitle className="text-sm font-black text-gray-400 uppercase tracking-widest">
                        {t("paymentHistory")}
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                    {subscription.payments.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            {t("noPayments")}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {subscription.payments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="p-4 flex justify-between items-center text-sm"
                                >
                                    <div>
                                        <p className="font-bold text-gray-800">
                                            {payment.amountFcfa.toLocaleString()}{" "}
                                            FCFA
                                            {payment.method
                                                ? ` — ${payment.method.replace(
                                                      "_",
                                                      " "
                                                  )}`
                                                : ""}
                                        </p>

                                        <p className="text-xs text-gray-400">
                                            {new Date(
                                                payment.createdAt
                                            ).toLocaleString()}
                                        </p>
                                    </div>

                                    <span
                                        className={`text-xs font-black uppercase px-2 py-1 rounded ${
                                            payment.status ===
                                            "SUCCESS"
                                                ? "bg-green-100 text-green-700"
                                                : payment.status ===
                                                  "FAILED"
                                                ? "bg-red-100 text-red-700"
                                                : "bg-amber-100 text-amber-700"
                                        }`}
                                    >
                                        {payment.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}