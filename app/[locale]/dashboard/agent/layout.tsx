"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { useSession } from "@/lib/auth-client";
import { useState, useEffect } from "react";
import { getMyAgencyName } from "@/lib/agency-actions";
import { useLocale, useTranslations } from "next-intl";

export default function AgentLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations("agentLayout");
    const locale = useLocale();
    const { data: session } = useSession();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [agencyName, setAgencyName] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user) {
            getMyAgencyName().then(setAgencyName);
        }
    }, [session?.user]);

    const agentItems = [
        {
            icon: "LayoutDashboard",
            label: t("overview"),
            href: `/${locale}/dashboard/agent`
        },
        {
            icon: "Users",
            label: t("assignedClients"),
            href: `/${locale}/dashboard/agent/clients`
        },
        {
            icon: "UserCog",
            label: t("profile"),
            href: `/${locale}/dashboard/agent/profile`
        }
    ];

    return (
        <div className="flex h-screen bg-gray-50 max-w-full overflow-hidden">
            <Sidebar
                items={agentItems}
                userRole={t("agentRole")}
                userName={
                    session?.user?.name ||
                    t("defaultUserName")
                }
                agencyName={agencyName}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300 relative max-w-full overflow-x-hidden">
                <Header
                    title={t("headerTitle")}
                    onMenuClick={() => setSidebarOpen(true)}
                    locale={locale}
                />

                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                    {children}
                </main>
            </div>
        </div>
    );
}