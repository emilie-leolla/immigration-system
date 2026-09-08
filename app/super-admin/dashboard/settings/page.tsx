import React from "react";
import { getAllPlans, getPricingSettings } from "./actions";
import PlanManager from "./plan-manager";
import PricingSettingsForm from "./pricing-settings-form";

export const dynamic = "force-dynamic";

export default async function SuperAdminSettingsPage() {
    const [plans, pricingSettings] = await Promise.all([
        getAllPlans(),
        getPricingSettings(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: "#1E3A8A" }}>Settings</h1>
                <p className="text-gray-500 text-sm mt-1">Manage the plans agencies can subscribe to.</p>
            </div>

            <PricingSettingsForm initial={pricingSettings as any} />

            <PlanManager initialPlans={plans as any} />
        </div>
    );
}