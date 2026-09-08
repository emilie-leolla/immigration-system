"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { updatePricingSettingsAction } from "./actions";

interface PricingSettings {
    basePriceFcfa: number;
    pricePerAgentFcfa: number;
    pricePerClientFcfa: number;
}

export default function PricingSettingsForm({ initial }: { initial: PricingSettings }) {
    const t = useTranslations("adminSettings.pricing");

    const [basePriceFcfa, setBasePriceFcfa] = useState(String(initial.basePriceFcfa));
    const [pricePerAgentFcfa, setPricePerAgentFcfa] = useState(String(initial.pricePerAgentFcfa));
    const [pricePerClientFcfa, setPricePerClientFcfa] = useState(String(initial.pricePerClientFcfa));
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.set("basePriceFcfa", basePriceFcfa);
            formData.set("pricePerAgentFcfa", pricePerAgentFcfa);
            formData.set("pricePerClientFcfa", pricePerClientFcfa);

            const result = await updatePricingSettingsAction(formData);

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success(t("successToast"));
        } catch (err) {
            console.error(err);
            toast.error(t("errorToast"));
        } finally {
            setLoading(false);
        }
    };

    // Live example, updates as the super admin types
    const exampleAgents = 4;
    const exampleClients = 100;
    const exampleTotal =
        (parseInt(basePriceFcfa, 10) || 0) +
        exampleAgents * (parseInt(pricePerAgentFcfa, 10) || 0) +
        exampleClients * (parseInt(pricePerClientFcfa, 10) || 0);

    return (
        <div
            className="bg-white p-6"
            style={{ boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)", borderRadius: "12px" }}
        >
            <h2 className="text-lg font-bold mb-1" style={{ color: "#1E3A8A" }}>
                {t("title")}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
                {t("description")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("baseFeeLabel")}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={basePriceFcfa}
                            onChange={(e) => setBasePriceFcfa(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("perAgentLabel")}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={pricePerAgentFcfa}
                            onChange={(e) => setPricePerAgentFcfa(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t("perClientLabel")}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={pricePerClientFcfa}
                            onChange={(e) => setPricePerClientFcfa(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                    {t("exampleText", {
                        agents: exampleAgents,
                        clients: exampleClients,
                        total: exampleTotal.toLocaleString(),
                    })}
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    className="text-white"
                    style={{ backgroundColor: "#1E3A8A" }}
                >
                    {loading ? t("saving") : t("save")}
                </Button>
            </form>
        </div>
    );
}