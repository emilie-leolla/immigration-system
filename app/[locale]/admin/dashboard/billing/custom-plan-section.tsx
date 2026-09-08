"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Sparkles,
    Loader2,
    AlertCircle,
    CreditCard,
    Smartphone,
    ShieldCheck,
    Wand2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createCustomPlanAndCheckoutAction } from "./actions";
import { MethodCard } from "./upgrade-plan-section";

type PaymentMethod = "MTN_MOBILE_MONEY" | "ORANGE_MONEY" | "CARD";

interface PricingSettings {
    basePriceFcfa: number;
    pricePerAgentFcfa: number;
    pricePerClientFcfa: number;
}

export default function CustomPlanSection({ pricing }: { pricing: PricingSettings }) {
    const t = useTranslations("adminBilling.custom");
    const tBilling = useTranslations("adminBilling");

    const [open, setOpen] = useState(false);
    const [numAgents, setNumAgents] = useState("1");
    const [numClients, setNumClients] = useState("10");
    const [method, setMethod] = useState<PaymentMethod>("MTN_MOBILE_MONEY");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();

    const agents = Math.max(0, parseInt(numAgents, 10) || 0);
    const clients = Math.max(0, parseInt(numClients, 10) || 0);
    const totalPrice =
        pricing.basePriceFcfa +
        agents * pricing.pricePerAgentFcfa +
        clients * pricing.pricePerClientFcfa;

    function closeDialog() {
        if (!isPending) {
            setOpen(false);
            setError("");
            setPhone("");
        }
    }

    function handleConfirm() {
        setError("");

        if (agents < 1 || clients < 1) {
            setError(t("errorMinimum"));
            return;
        }

        if (method === "MTN_MOBILE_MONEY" || method === "ORANGE_MONEY") {
            const cleanPhone = phone.replace(/\D/g, "");
            if (!cleanPhone || cleanPhone.length < 9) {
                setError(t("errorPhone"));
                return;
            }
        }

        startTransition(async () => {
            const formData = new FormData();
            formData.set("numAgents", String(agents));
            formData.set("numClients", String(clients));
            formData.set("paymentMethod", method);
            formData.set("phoneNumber", phone);

            const result = await createCustomPlanAndCheckoutAction(formData);

            if (result?.error) {
                setError(result.error);
                return;
            }

            if (result?.paymentUrl) {
                window.location.href = result.paymentUrl;
                return;
            }

            if (result?.txRef) {
                const locale = window.location.pathname.split("/")[1] || "en";
                window.location.href = `/${locale}/admin/dashboard/billing/verify?ref=${encodeURIComponent(result.txRef)}`;
                return;
            }

            window.location.reload();
        });
    }

    return (
        <>
            <Card className="border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/30 hover:bg-blue-50/60 transition-all">
                <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0">
                            <Wand2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-black text-gray-900">{t("cardTitle")}</p>
                            <p className="text-xs text-gray-500 font-semibold">
                                {t("cardDescription")}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setOpen(true)}
                        className="font-bold rounded-xl gap-2 bg-[#1E3A8A] text-white hover:bg-blue-900 shadow-md hover:shadow-lg transition-all shrink-0"
                    >
                        <Sparkles className="h-4 w-4" />
                        {t("customizeButton")}
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
                <DialogContent className="sm:max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#3B82F6] p-6 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
                                <Wand2 className="h-6 w-6 text-yellow-300" />
                                {t("dialogTitle")}
                            </DialogTitle>
                            <DialogDescription className="text-blue-100 text-sm mt-1">
                                {t("dialogDescription")}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-black text-gray-800 mb-1.5">
                                    {t("numAgentsLabel")}
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={numAgents}
                                    onChange={(e) => setNumAgents(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-black text-gray-800 mb-1.5">
                                    {t("numClientsLabel")}
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={numClients}
                                    onChange={(e) => setNumClients(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/50 border border-blue-100 p-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                    {t("summaryTitle")}
                                </p>
                                <p className="font-black text-gray-900 text-lg mt-0.5">
                                    {t("agentsCount", { count: agents })}, {t("clientsCount", { count: clients })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-2xl text-[#1E3A8A]">
                                    {totalPrice.toLocaleString()}{" "}
                                    <span className="text-sm font-bold text-gray-600">FCFA</span>
                                </p>
                                <p className="text-xs text-gray-400 font-bold">{tBilling("perYear")}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-black text-gray-800 mb-2.5">
                                {t("selectPaymentMethod")}
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <MethodCard
                                    active={method === "MTN_MOBILE_MONEY"}
                                    onClick={() => { setMethod("MTN_MOBILE_MONEY"); setError(""); }}
                                    badgeColor="bg-[#FFCC00] text-black font-black text-xs"
                                    badgeText="MTN"
                                    title={t("mtnTitle")}
                                    subtitle={t("mobileMoneySubtitle")}
                                    activeBorder="border-[#FFCC00] bg-yellow-50/60 ring-2 ring-yellow-400"
                                />
                                <MethodCard
                                    active={method === "ORANGE_MONEY"}
                                    onClick={() => { setMethod("ORANGE_MONEY"); setError(""); }}
                                    badgeColor="bg-[#FF7900] text-white font-black text-xs"
                                    badgeText="OM"
                                    title={t("orangeTitle")}
                                    subtitle={t("mobileMoneySubtitle")}
                                    activeBorder="border-[#FF7900] bg-orange-50/60 ring-2 ring-orange-400"
                                />
                                <MethodCard
                                    active={method === "CARD"}
                                    onClick={() => { setMethod("CARD"); setError(""); }}
                                    badgeColor="bg-blue-600 text-white"
                                    icon={<CreditCard className="h-4 w-4" />}
                                    title={t("cardMethodTitle")}
                                    subtitle={t("cardMethodSubtitle")}
                                    activeBorder="border-blue-500 bg-blue-50/60 ring-2 ring-blue-500"
                                />
                            </div>
                        </div>

                        {(method === "MTN_MOBILE_MONEY" || method === "ORANGE_MONEY") && (
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-800 flex items-center justify-between">
                                    <span>{method === "MTN_MOBILE_MONEY" ? t("mtnNumberLabel") : t("orangeNumberLabel")}</span>
                                    <span className="text-xs text-gray-400 font-medium">{t("phoneCountryLabel")}</span>
                                </label>
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white transition-all shadow-sm">
                                    <span className="px-3.5 flex items-center gap-1.5 bg-gray-50 text-gray-700 font-bold text-sm border-r border-gray-200 select-none">
                                        <span className="text-base">🇨🇲</span> +237
                                    </span>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={phone.replace(/^237/, "")}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                                            setPhone(`237${digits}`);
                                        }}
                                        placeholder="6 XX XX XX XX"
                                        className="flex-1 px-4 py-3 outline-none font-semibold text-gray-900 placeholder:text-gray-300 text-base"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Smartphone className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                    {t("phoneHint")}
                                </p>
                            </div>
                        )}

                        {method === "CARD" && (
                            <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 flex gap-3 items-center">
                                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <div className="text-xs text-blue-900">
                                    <p className="font-bold text-sm text-blue-950 mb-0.5">{t("cardPaymentTitle")}</p>
                                    <p>{t("cardPaymentDescription")}</p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
                                <AlertCircle className="shrink-0 w-4 h-4 mt-0.5 text-red-600" />
                                <span className="font-semibold">{error}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-semibold">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            {t("securityNote")}
                        </div>

                        <Button
                            onClick={handleConfirm}
                            disabled={isPending}
                            className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-black h-12 rounded-xl text-base shadow-lg hover:shadow-xl transition-all"
                        >
                            {isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="animate-spin w-5 h-5" />
                                    {t("processingPayment")}
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    {t("payButton", { amount: totalPrice.toLocaleString() })}
                                    {method === "CARD" ? <CreditCard className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                                </span>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}