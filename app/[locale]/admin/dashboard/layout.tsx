"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import {
    LayoutDashboard,
    Users,
    Briefcase,
    FileText,
    FolderSearch,
    List,
    Settings as SettingsIcon
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useRouter, useParams } from "next/navigation";
import { getMyAgencyName } from "@/lib/agency-actions";
import AiSearchBar from "@/app/[locale]/admin/dashboard/search/ai-search-bar";
import AiChatDrawer from "@/app/[locale]/admin/dashboard/search/ai-chat-drawer";
import { FreeModeDialog } from "@/app/[locale]/admin/dashboard/free-mode-dialog";
import { UpgradeDialogProvider } from "@/app/[locale]/admin/dashboard/upgrade-dialog-context";
import { useTranslations } from "next-intl";
export default function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations("adminLayout");
    const { data: session, isPending } = useSession();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [agencyName, setAgencyName] = useState<string | null>(null);

    useEffect(() => {
        // Simple role-based protection
        if (!isPending) {
            // Check if user is logged in
            if (!session) {
                router.push("/sign-in");
            }
        }
    }, [session, isPending, router]);

    useEffect(() => {
        if (session) {
            getMyAgencyName().then(setAgencyName).catch(() => setAgencyName(null));
        }
    }, [session]);

    if (isPending) {
        return <div className="min-h-screen flex items-center justify-center">{t("loading")}</div>;
    }

    if (!session) return null; // Prevent flicker while redirecting
const adminSidebarItems = [
        { icon: "LayoutDashboard", label: t("nav.overview"), href: "/admin/dashboard" },
        { icon: "Briefcase", label: t("nav.manageAgents"), href: "/admin/dashboard/agents" },
        { icon: "Users", label: t("nav.manageClients"), href: "/admin/dashboard/clients" },
        { icon: "FileText", label: t("nav.allProcedures"), href: "/admin/dashboard/applications" },
        { icon: "ListOrdered", label: t("nav.procedureSteps"), href: "/admin/dashboard/steps" },
        { icon: "FolderSearch", label: t("nav.documentsMonitoring"), href: "/admin/dashboard/documents" },
        { icon: "List", label: t("nav.systemLogs"), href: "/admin/dashboard/logs" },
        { icon: "CreditCard", label: t("nav.billing"), href: "/admin/dashboard/billing" },
        { icon: "MessageSquare", label: t("nav.contactSupport"), href: "/admin/dashboard/support" },
        { icon: "Settings", label: t("nav.systemSettings"), href: "/admin/dashboard/settings" }
    ];
    return (
        <UpgradeDialogProvider>
            <div className="flex bg-white min-h-screen" style={{ fontFamily: "var(--font-geist-sans)" }}>
                {/* Sidebar */}
                <Sidebar
                    items={adminSidebarItems}
                    userRole={t("userRole")}
                    userName={session?.user?.name || t("defaultUserName")}
                    agencyName={agencyName}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                />


                {/* Main Content wrapper */}
                <div className="flex-1 md:ml-64 flex flex-col min-h-screen relative max-w-full">
                    <Header
                        title=""
                        showLogout={true}
                        onMenuClick={() => setIsSidebarOpen(true)}
                        centerSlot={<AiSearchBar />}
                        locale={locale}
                    />

                    <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full mx-auto" style={{ backgroundColor: "#F9FAFB" }}>
                        {children}
                    </main>

                    <AiChatDrawer />
                    <FreeModeDialog />
                </div>

            </div>
        </UpgradeDialogProvider>
    );
}