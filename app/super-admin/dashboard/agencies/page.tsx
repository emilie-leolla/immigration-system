import React from "react";
import { getAgencies, getPlans } from "../actions";
import AgencyList from "./agency-list";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SuperAdminAgenciesPage() {
    const t = await getTranslations("superAdminDashboard");
    const [agencies, plans] = await Promise.all([getAgencies(), getPlans()]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: "#1E3A8A" }}>{t("agenciesPage.title")}</h1>
                <p className="text-gray-500 text-sm mt-1">{t("agenciesPage.subtitle")}</p>
            </div>
            <AgencyList initialAgencies={agencies as any} plans={plans as any} />
        </div>
    );
}
