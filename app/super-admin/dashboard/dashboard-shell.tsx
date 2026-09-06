"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";

interface SidebarItem {
    icon: string;
    label: string;
    href: string;
}

interface SuperAdminDashboardShellProps {
    items: SidebarItem[];
    userRole: string;
    userName: string;
    agencyName?: string | null;
    children: React.ReactNode;
}

// This is a client component because opening/closing the mobile sidebar
// needs interactive state (useState) and a click handler. The parent
// layout.tsx stays a server component so the SUPER_ADMIN auth check and
// redirect keep happening on the server before any of this ever renders.
export function SuperAdminDashboardShell({
    items,
    userRole,
    userName,
    agencyName,
    children,
}: SuperAdminDashboardShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex bg-white min-h-screen" style={{ fontFamily: "var(--font-geist-sans)" }}>
            <Sidebar
                items={items}
                userRole={userRole}
                userName={userName}
                agencyName={agencyName}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 md:ml-64 flex flex-col min-h-screen relative">
                <Header
                    title=""
                    showLogout={true}
                    onMenuClick={() => setIsSidebarOpen(true)}
                />
                <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full mx-auto" style={{ backgroundColor: "#F9FAFB" }}>
                    {children}
                </main>
            </div>
        </div>
    );
}