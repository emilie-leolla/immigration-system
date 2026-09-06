"use client";

import { Bell, Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";

interface HeaderProps {
    title: string;
    onMenuClick?: () => void;
    showLogout?: boolean;
    centerSlot?: React.ReactNode;
    locale?: string;
}

export function Header({ title, onMenuClick, showLogout = false, centerSlot, locale }: HeaderProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const pathname = usePathname();

    const handleLogout = async () => {
        sessionStorage.removeItem("freeModeDialogShown");
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                }
            }
        });
    };

    function localizedHref(targetLocale: "en" | "fr") {
        const withoutLocale = pathname.replace(/^\/(en|fr)(?=\/|$)/, "");
        return `/${targetLocale}${withoutLocale}`;
    }

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
            {/* ── Top row: hamburger | title | locale | logout ── */}
            <div className="h-14 md:h-16 flex items-center gap-3 px-4 md:px-6">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
                        aria-label="Open menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                )}

                {title && (
                    <h1 className="text-lg font-semibold text-gray-800 tracking-tight shrink-0">
                        {title}
                    </h1>
                )}

                {/* Desktop search (centred) */}
                {centerSlot && (
                    <div className="hidden md:flex flex-1 min-w-0 justify-center">
                        {centerSlot}
                    </div>
                )}

                <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-auto">
                    {locale && (
                        <div className="flex items-center rounded-full border border-gray-200 p-0.5 text-xs font-bold">
                            <Link
                                href={localizedHref("en")}
                                className={`px-2.5 py-1 rounded-full transition-colors ${locale === "en" ? "bg-[#1E3A8A] text-white" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                EN
                            </Link>
                            <Link
                                href={localizedHref("fr")}
                                className={`px-2.5 py-1 rounded-full transition-colors ${locale === "fr" ? "bg-[#1E3A8A] text-white" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                FR
                            </Link>
                        </div>
                    )}

                    {showLogout && (
                        <Button
                            variant="ghost"
                            onClick={handleLogout}
                            className="text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-xl font-bold transition-all px-2 md:px-3"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Mobile search row (visible only below md) ── */}
            {centerSlot && (
                <div className="md:hidden px-4 pb-3">
                    {centerSlot}
                </div>
            )}
        </header>
    );
}