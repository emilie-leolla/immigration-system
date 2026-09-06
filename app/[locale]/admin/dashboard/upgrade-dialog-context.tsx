"use client";

import { createContext, useContext, useState } from "react";

interface UpgradeDialogContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
    openUpgradeDialog: () => void;
}

const UpgradeDialogContext = createContext<UpgradeDialogContextValue | null>(null);

export function UpgradeDialogProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <UpgradeDialogContext.Provider
            value={{ open, setOpen, openUpgradeDialog: () => setOpen(true) }}
        >
            {children}
        </UpgradeDialogContext.Provider>
    );
}

/**
 * Lets any client component (a quota-check error, the first-login check,
 * a "your plan doesn't support this" moment) open the shared upgrade
 * dialog imperatively, instead of each place needing its own dialog.
 */
export function useUpgradeDialog() {
    const ctx = useContext(UpgradeDialogContext);
    if (!ctx) {
        throw new Error("useUpgradeDialog must be used within an UpgradeDialogProvider");
    }
    return ctx;
}