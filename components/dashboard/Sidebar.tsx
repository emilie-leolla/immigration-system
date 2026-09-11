"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LogOut,
    LayoutDashboard,
    Users,
    UserCog,
    FileText,
    Settings as SettingsIcon,
    Briefcase,
    FolderSearch,
    List,
    MessageSquare,
    X,
    Menu,
    CreditCard,
    ListOrdered,
    Building2,
    Activity,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { LOGOS } from "@/lib/branding";
import { useTranslations } from "next-intl";

const iconMap: Record<string, any> = {
    LayoutDashboard,
    Users,
    UserCog,
    FileText,
    Settings: SettingsIcon,
    Briefcase,
    FolderSearch,
    List,
    MessageSquare,
    CreditCard,
    ListOrdered,
    Building2,
    Activity,
};

interface SidebarItem {
    icon: string;
    label: string;
    href: string;
}

interface SidebarProps {
    items: SidebarItem[];
    userRole: string;
    userName: string;
    agencyName?: string | null;
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({
    items,
    userRole,
    userName,
    agencyName,
    isOpen: externalIsOpen,
    onClose,
}: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const t = useTranslations("common");
    const [internalIsOpen, setInternalIsOpen] = useState(false);

    const isOpen =
        externalIsOpen !== undefined
            ? externalIsOpen
            : internalIsOpen;

    const close = () => {
        if (onClose) onClose();
        else setInternalIsOpen(false);
    };

    /*
     * ------------------------------------------------------------
     * ROLE DETECTION
     * ------------------------------------------------------------
     *
     * Keep the existing roles working while adding SUPER_ADMIN.
     */
    const role = (userRole || "").toUpperCase().replace(/[\s-]/g, "_");

    const isSuperAdmin =
        role === "SUPER_ADMIN" ||
        role === "SUPERADMIN";

    /*
     * ------------------------------------------------------------
     * HOME ROUTE
     * ------------------------------------------------------------
     *
     * Super Admin belongs to the global platform area.
     * Admin/Agent continue using the existing admin area.
     */
    const homeHref = isSuperAdmin
        ? "/super-admin/dashboard"
        : "/dashboard";

    /*
     * ------------------------------------------------------------
     * SUPER ADMIN NAVIGATION
     * ------------------------------------------------------------
     *
     * This is only used when the parent does not provide items.
     *
     * If your Super Admin layout already passes items, those items
     * remain untouched.
     */
    const superAdminItems: SidebarItem[] = [
        {
            icon: "LayoutDashboard",
            label: "Tableau de bord",
            href: "/super-admin/dashboard",
        },
        {
            icon: "Building2",
            label: "Agences",
            href: "/super-admin/agencies",
        },
        {
            icon: "CreditCard",
            label: "Paiements",
            href: "/super-admin/payments",
        },
        {
            icon: "Users",
            label: "Utilisateurs",
            href: "/super-admin/users",
        },
        {
            icon: "Activity",
            label: "Historique",
            href: "/super-admin/logs",
        },
        {
            icon: "Settings",
            label: "Paramètres",
            href: "/super-admin/settings",
        },
    ];

    /*
     * IMPORTANT:
     *
     * We do NOT erase the existing `items`.
     *
     * Super Admin only receives the fallback menu if no items
     * were supplied by its layout.
     */
    const navigationItems =
        isSuperAdmin && items.length === 0
            ? superAdminItems
            : items;

    /*
     * ------------------------------------------------------------
     * LOGOUT
     * ------------------------------------------------------------
     */
    const handleLogout = async () => {
        sessionStorage.removeItem("freeModeDialogShown");
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                },
            },
        });
    };

    return (
        <>
            {/* ── Dark backdrop (mobile only) ── */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
                    isOpen
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                }`}
                onClick={close}
                aria-hidden="true"
            />

            {/* ── Sidebar panel ── */}
            <aside
                className={`
                    fixed left-0 top-0 z-50 h-screen flex flex-col
                    bg-white border-r border-gray-100
                    w-[78vw] max-w-[300px] sm:max-w-[280px]
                    md:w-64 lg:w-64 xl:w-72
                    transition-transform duration-300 ease-in-out
                    ${
                        isOpen
                            ? "translate-x-0 shadow-2xl"
                            : "-translate-x-full"
                    }
                    md:translate-x-0 md:shadow-none md:z-30
                `}
            >
                {/* =====================================================
                    Logo / brand
                ====================================================== */}
                <div className="flex items-center justify-between h-14 md:h-16 border-b border-gray-100 px-4 xl:px-6 shrink-0">
                    <Link
                        href={homeHref}
                        onClick={close}
                        className="flex items-center min-w-0 hover:opacity-80 transition-opacity"
                    >
                        {isSuperAdmin ? (
                            <Image
                                src={LOGOS.sidebar}
                                alt="Procédure Facile"
                                width={200}
                                height={50}
                                className="h-11 xl:h-14 w-auto object-contain"
                                priority
                            />
                        ) : (
                            <span className="text-base xl:text-lg font-extrabold text-[var(--color-primary)] tracking-wide truncate">
                                {agencyName || "Procédure Facile"}
                            </span>
                        )}
                    </Link>

                    {/* Close button — mobile only */}
                    <button
                        type="button"
                        onClick={close}
                        className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* =====================================================
                    User info
                ====================================================== */}
                <div className="px-4 xl:px-6 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-[var(--color-secondary)] flex items-center justify-center text-[var(--color-primary)] font-bold shrink-0 text-sm xl:text-base">
                            {userName?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div className="overflow-hidden min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                                {userName}
                            </p>

                            <p className="text-xs text-gray-400 capitalize">
                                {isSuperAdmin
                                    ? "Super Admin"
                                    : userRole}
                            </p>
                        </div>
                    </div>
                </div>

                {/* =====================================================
                    Nav links
                ====================================================== */}
                <nav className="flex-1 overflow-y-auto px-3 xl:px-4 py-4 space-y-0.5">
                    {navigationItems.map((item, index) => {
                        /*
                         * Exact route OR child route — EXCEPT for the
                         * first nav item (Dashboard/overview), which must
                         * always match exactly. Position-based instead of
                         * comparing against a guessed "homeHref" string,
                         * since that home path differs per role
                         * ("/dashboard" for admin, "/dashboard/agent" for
                         * agents, "/super-admin/dashboard" for super
                         * admin) — a mismatch there silently disabled this
                         * fix for any role whose home path wasn't exactly
                         * "/dashboard" or "/super-admin/dashboard".
                         *
                         * Example:
                         * /super-admin/agencies
                         * /super-admin/agencies/new
                         *
                         * Both keep "Agences" active.
                         */
                        const isActive =
                            index === 0
                                ? pathname === item.href
                                : pathname === item.href ||
                                  pathname.startsWith(`${item.href}/`);

                        const IconComponent =
                            iconMap[item.icon] || LayoutDashboard;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={close}
                                className={`flex items-center px-3 xl:px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                                    isActive
                                        ? "bg-[var(--color-secondary)] text-[var(--color-primary)] shadow-sm"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }`}
                            >
                                <IconComponent
                                    className={`mr-3 h-4.5 w-4.5 h-5 w-5 shrink-0 ${
                                        isActive
                                            ? "text-[var(--color-primary)]"
                                            : "text-gray-400"
                                    }`}
                                />

                                <span className="truncate">
                                    {item.label}
                                </span>

                                {isActive && (
                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* =====================================================
                    Logout
                ====================================================== */}
                <div className="px-3 xl:px-4 py-4 border-t border-gray-100 shrink-0">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 xl:px-4 py-2.5 text-sm font-medium text-gray-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all group"
                    >
                        <LogOut className="mr-3 h-5 w-5 shrink-0 group-hover:rotate-12 transition-transform" />

                        <span>
                            {t("logout")}
                        </span>
                    </button>
                </div>
            </aside>
        </>
    );
}