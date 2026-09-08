"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, AlertCircle, ArrowUpCircle, ArrowDownCircle, X, ShieldCheck, Smartphone, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { upgradeSubscriptionAction, cancelPendingDowngradeAction } from "./actions";
import { useTranslations } from "next-intl";

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceFcfa: number;
  maxAgents: number | null;
  maxClients: number | null;
}

type PaymentMethod = "MTN_MOBILE_MONEY" | "ORANGE_MONEY" | "CARD";

export default function UpgradePlanSection({ plans, currentPlanId, pendingPlan }: { plans: Plan[]; currentPlanId: string; pendingPlan: Plan | null }) {
  const t = useTranslations("adminBilling.upgrade");
  const tBilling = useTranslations("adminBilling");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("MTN_MOBILE_MONEY");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isCancelPending, startCancelTransition] = useTransition();

  const currentPlan = plans.find((p) => p.id === currentPlanId);
  const isPaidPlan = !!selectedPlan && selectedPlan.priceFcfa > 0;

  function closeDialog() {
    if (!isPending) {
      setSelectedPlan(null);
      setError("");
      setPhone("");
    }
  }

  function handleConfirm() {
    if (!selectedPlan) return;
    setError("");

    if (isPaidPlan && (method === "MTN_MOBILE_MONEY" || method === "ORANGE_MONEY")) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 9) {
        setError("Please enter a valid Cameroon phone number (e.g. 6XX XX XX XX).");
        return;
      }
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("planId", selectedPlan.id);
      formData.set("paymentMethod", method);
      formData.set("phoneNumber", phone);
      const result = await upgradeSubscriptionAction(formData);

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

      toast.success(t("toastUpdated"));
      closeDialog();
      window.location.reload();
    });
  }

  function handleCancelDowngrade() {
    startCancelTransition(async () => {
      const result = await cancelPendingDowngradeAction();
      if (result?.error) toast.error(result.error);
      else { toast.success(t("toastDowngradeCancelled")); window.location.reload(); }
    });
  }

  return (
    <div className="space-y-4">
      {pendingPlan && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3 text-amber-800 text-sm">
            <ArrowDownCircle className="h-5 w-5 shrink-0" />
            <span>{t.rich("downgradeScheduled", { strong: (chunks) => <strong>{chunks}</strong>, planName: pendingPlan.name })}</span>
          </div>
          <Button variant="outline" size="sm" disabled={isCancelPending} onClick={handleCancelDowngrade} className="gap-1.5 font-bold border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0">
            {isCancelPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{t("cancel")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <Card key={plan.id} className={`border-none shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all ${isCurrent ? "ring-2 ring-[#1E3A8A]" : ""}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-black text-gray-900 text-lg">{plan.name}</p>
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 bg-blue-100 text-[#1E3A8A] text-xs font-black rounded-full uppercase">Active</span>
                  )}
                </div>
                <p className="text-xl font-black text-[#1E3A8A]">{plan.priceFcfa.toLocaleString()} FCFA <span className="text-xs text-gray-400 font-bold">{tBilling("perYear")}</span></p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded-lg">{t("agentsShort")}: {plan.maxAgents ?? "∞"}</span>
                  <span className="px-2 py-1 bg-gray-100 rounded-lg">{t("clientsShort")}: {plan.maxClients ?? "∞"}</span>
                </div>
                {isCurrent ? (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#1E3A8A] uppercase pt-2 py-2 rounded-xl bg-blue-50">
                    <CheckCircle2 className="h-4 w-4 text-[#1E3A8A]" />{t("currentPlan")}
                  </div>
                ) : (
                  <Button
                    onClick={() => { setError(""); setPhone(""); setMethod("MTN_MOBILE_MONEY"); setSelectedPlan(plan); }}
                    className="w-full font-bold rounded-xl gap-2 bg-[#1E3A8A] text-white hover:bg-blue-900 shadow-md hover:shadow-lg transition-all"
                  >
                    <ArrowUpCircle className="h-4 w-4" />{t("upgradeButton")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#3B82F6] p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-300" />
                {selectedPlan ? `Upgrade to ${selectedPlan.name}` : "Upgrade Plan"}
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-sm mt-1">
                Choose your payment method and complete your subscription.
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedPlan && (
            <div className="p-6 space-y-6">
              {/* Selected plan summary */}
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50/50 border border-blue-100 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Selected Plan</p>
                  <p className="font-black text-gray-900 text-xl mt-0.5">{selectedPlan.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-semibold">
                    <span>Agents: {selectedPlan.maxAgents ?? "Unlimited"}</span>
                    <span>•</span>
                    <span>Clients: {selectedPlan.maxClients ?? "Unlimited"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-2xl text-[#1E3A8A]">{selectedPlan.priceFcfa.toLocaleString()} <span className="text-sm font-bold text-gray-600">FCFA</span></p>
                  <p className="text-xs text-gray-400 font-bold">per year</p>
                </div>
              </div>

              {isPaidPlan ? (
                <>
                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-sm font-black text-gray-800 mb-2.5">Select Payment Method</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* MTN Mobile Money */}
                      <MethodCard
                        active={method === "MTN_MOBILE_MONEY"}
                        onClick={() => { setMethod("MTN_MOBILE_MONEY"); setError(""); }}
                        badgeColor="bg-[#FFCC00] text-black font-black text-xs"
                        badgeText="MTN"
                        title="MTN MoMo"
                        subtitle="Mobile Money"
                        activeBorder="border-[#FFCC00] bg-yellow-50/60 ring-2 ring-yellow-400"
                      />

                      {/* Orange Money */}
                      <MethodCard
                        active={method === "ORANGE_MONEY"}
                        onClick={() => { setMethod("ORANGE_MONEY"); setError(""); }}
                        badgeColor="bg-[#FF7900] text-white font-black text-xs"
                        badgeText="OM"
                        title="Orange Money"
                        subtitle="Mobile Money"
                        activeBorder="border-[#FF7900] bg-orange-50/60 ring-2 ring-orange-400"
                      />

                      {/* Card */}
                      <MethodCard
                        active={method === "CARD"}
                        onClick={() => { setMethod("CARD"); setError(""); }}
                        badgeColor="bg-blue-600 text-white"
                        icon={<CreditCard className="h-4 w-4" />}
                        title="Credit / Debit"
                        subtitle="Visa / Mastercard"
                        activeBorder="border-blue-500 bg-blue-50/60 ring-2 ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Phone input for Mobile Money */}
                  {(method === "MTN_MOBILE_MONEY" || method === "ORANGE_MONEY") && (
                    <div className="space-y-2">
                      <label className="text-sm font-black text-gray-800 flex items-center justify-between">
                        <span>{method === "MTN_MOBILE_MONEY" ? "MTN Mobile Money Number" : "Orange Money Number"}</span>
                        <span className="text-xs text-gray-400 font-medium">Cameroon (+237)</span>
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
                        A payment prompt will appear on this phone. Enter your PIN to validate.
                      </p>
                    </div>
                  )}

                  {/* Card redirect info */}
                  {method === "CARD" && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 flex gap-3 items-center">
                      <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="text-xs text-blue-900">
                        <p className="font-bold text-sm text-blue-950 mb-0.5">Card Payment via CamPay</p>
                        <p>You will be redirected to the secure CamPay gateway to complete payment with Visa or Mastercard.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-green-900 text-sm font-semibold">
                  This is a free plan. No payment is required to activate it.
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
                  <AlertCircle className="shrink-0 w-4 h-4 mt-0.5 text-red-600" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {isPaidPlan && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Secured & encrypted 256-bit payment via CamPay
                </div>
              )}

              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-black h-12 rounded-xl text-base shadow-lg hover:shadow-xl transition-all"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin w-5 h-5" />
                    Processing payment...
                  </span>
                ) : isPaidPlan ? (
                  <span className="flex items-center justify-center gap-2">
                    Pay {selectedPlan.priceFcfa.toLocaleString()} FCFA
                    {method === "CARD" ? <CreditCard className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  </span>
                ) : (
                  "Activate Free Plan"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MethodCard({
  active,
  onClick,
  badgeColor,
  badgeText,
  icon,
  title,
  subtitle,
  activeBorder,
}: {
  active: boolean;
  onClick: () => void;
  badgeColor: string;
  badgeText?: string;
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  activeBorder: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 p-3.5 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
        active
          ? `${activeBorder} shadow-sm`
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 opacity-80 hover:opacity-100"
      }`}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${badgeColor}`}>
        {icon || badgeText}
      </div>
      <p className="font-black text-xs text-gray-900 leading-tight">{title}</p>
      <p className="text-[10px] text-gray-400 font-semibold leading-none">{subtitle}</p>
    </button>
  );
}