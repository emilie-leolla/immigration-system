import React from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMyAgencyName } from "@/lib/agency-actions";
import { getTranslations } from "next-intl/server";
import { SuperAdminDashboardShell } from "./dashboard-shell";

export default async function SuperAdminDashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
        redirect("/sign-in");
    }

    const t = await getTranslations("superAdminDashboard");
    const agencyName = await getMyAgencyName();

    const superAdminSidebarItems = [
        { icon: "LayoutDashboard", label: t("nav.dashboard"), href: "/super-admin/dashboard" },
        { icon: "Building2", label: t("nav.agencies"), href: "/super-admin/dashboard/agencies" },
        { icon: "CreditCard", label: t("nav.payments"), href: "/super-admin/dashboard/payments" },
        { icon: "UserCog", label: t("nav.users"), href: "/super-admin/dashboard/users" },
        { icon: "List", label: t("nav.history"), href: "/super-admin/dashboard/logs" },
        { icon: "Settings", label: t("nav.settings"), href: "/super-admin/dashboard/settings" },
    ];

    return (
        <SuperAdminDashboardShell
            items={superAdminSidebarItems}
            userRole={t("role")}
            userName={session.user.name || t("defaultUserName")}
            agencyName={agencyName}
        >
            {children}
        </SuperAdminDashboardShell>
    );
}