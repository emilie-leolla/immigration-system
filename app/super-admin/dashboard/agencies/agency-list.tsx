"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Building2,
    Plus,
    Users,
    FileText,
    Ban,
    CheckCircle2,
    AlertCircle,
    Loader2,
    CreditCard,
    Search,
    Pencil,
    Trash2,
} from "lucide-react";
import {
    createAgencyAction,
    toggleSuspendAgencyAction,
    setAgencyPlanAction,
    updateAgencyAction,
    deleteAgencyAction,
} from "./actions";
import { TablePagination } from "@/components/ui/table-pagination";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { toast } from "sonner";

const PAGE_SIZE = 10;

interface Plan {
    id: string;
    name: string;
    slug: string;
    priceFcfa: number;
    maxAgents: number | null;
    maxClients: number | null;
    isPublic: boolean;
}

interface Agency {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    status: "ACTIVE" | "SUSPENDED";
    isInternal: boolean;
    createdAt: string;
    _count: { users: number; applications: number };
    subscription: { plan: Plan } | null;
}

export default function AgencyList({
    initialAgencies,
    plans,
}: {
    initialAgencies: Agency[];
    plans: Plan[];
}) {
    const [agencies, setAgencies] = useState(initialAgencies);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
    const [deletingAgency, setDeletingAgency] = useState<Agency | null>(null);
    const [suspendingAgency, setSuspendingAgency] = useState<Agency | null>(null);
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const formRef = useRef<HTMLFormElement>(null);

    const filteredAgencies = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        if (!search) {
            return agencies;
        }

        return agencies.filter((agency) => {
            return (
                agency.name.toLowerCase().includes(search) ||
                agency.status.toLowerCase().includes(search) ||
                (agency.email ?? "").toLowerCase().includes(search) ||
                (agency.subscription?.plan.name ?? "")
                    .toLowerCase()
                    .includes(search)
            );
        });
    }, [agencies, searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredAgencies.length / PAGE_SIZE)
    );

    const safePage = Math.min(page, totalPages);

    const paginatedAgencies = filteredAgencies.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );

    function handleChangePlan(agencyId: string, planId: string) {
        startTransition(async () => {
            const result = await setAgencyPlanAction(agencyId, planId);

            if (!result?.error) {
                const plan = plans.find((p) => p.id === planId);

                setAgencies((prev) =>
                    prev.map((agency) =>
                        agency.id === agencyId
                            ? {
                                  ...agency,
                                  subscription: plan
                                      ? { plan }
                                      : agency.subscription,
                              }
                            : agency
                    )
                );
                toast.success("Agency subscription plan updated");
            } else {
                toast.error(result.error);
            }
        });
    }

    function handleCreate(formData: FormData) {
        setError("");

        startTransition(async () => {
            const result = await createAgencyAction(formData);

            if (result?.error) {
                setError(result.error);
            } else {
                setIsCreateOpen(false);
                formRef.current?.reset();
                setPage(1);
                toast.success("Agency created successfully");
                window.location.reload();
            }
        });
    }

    function handleUpdate(formData: FormData) {
        if (!editingAgency) return;
        setError("");

        startTransition(async () => {
            const result = await updateAgencyAction(editingAgency.id, formData);

            if (result?.error) {
                setError(result.error);
                toast.error(result.error);
            } else {
                toast.success("Agency updated successfully");
                setEditingAgency(null);
                window.location.reload();
            }
        });
    }

    function handleDeleteConfirm() {
        if (!deletingAgency) return;
        setError("");

        startTransition(async () => {
            const result = await deleteAgencyAction(deletingAgency.id, deletingAgency.name);

            if (result?.error) {
                setError(result.error);
                toast.error(result.error);
            } else {
                toast.success(`Agency "${deletingAgency.name}" permanently deleted`);
                setDeletingAgency(null);
                setAgencies((prev) => prev.filter((a) => a.id !== deletingAgency.id));
            }
        });
    }

    function handleSuspendConfirm() {
        if (!suspendingAgency) return;
        setError("");

        startTransition(async () => {
            const isCurrentlySuspended = suspendingAgency.status === "SUSPENDED";
            const result = await toggleSuspendAgencyAction(
                suspendingAgency.id,
                isCurrentlySuspended
            );

            if (!result?.error) {
                setAgencies((prev) =>
                    prev.map((agency) =>
                        agency.id === suspendingAgency.id
                            ? {
                                  ...agency,
                                  status: isCurrentlySuspended
                                      ? "ACTIVE"
                                      : "SUSPENDED",
                              }
                            : agency
                    )
                );
                toast.success(
                    isCurrentlySuspended
                        ? `Agency "${suspendingAgency.name}" reactivated`
                        : `Agency "${suspendingAgency.name}" suspended`
                );
                setSuspendingAgency(null);
            } else {
                setError(result.error);
                toast.error(result.error);
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search agencies..."
                        className="pl-9"
                    />
                </div>

                <Button
                    onClick={() => { setError(""); setIsCreateOpen(true); }}
                    className="bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold rounded-xl gap-2"
                >
                    <Plus className="h-4 w-4" />
                    New Agency
                </Button>
            </div>

            <div className="bg-[#F9FAFB] rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-gray-100/80">
                                <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200">
                                    Agency
                                </th>
                                <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200">
                                    Users
                                </th>
                                <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200">
                                    Procedures
                                </th>
                                <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200">
                                    Plan
                                </th>
                                <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-[#1E3A8A] border-b-2 border-gray-200 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {paginatedAgencies.map((agency) => (
                                <tr
                                    key={agency.id}
                                    className="hover:bg-blue-50/40 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-[#1E3A8A]">
                                                <Building2 className="h-4 w-4" />
                                            </div>

                                            <div>
                                                <div className="font-bold text-gray-900">
                                                    {agency.name}
                                                </div>

                                                {agency.email && (
                                                    <div className="text-xs text-gray-400 font-medium">
                                                        {agency.email}
                                                    </div>
                                                )}

                                                {agency.isInternal && (
                                                    <span className="text-xs text-gray-400 font-semibold">
                                                        Internal (migration)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-gray-700 font-semibold">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-4 w-4 text-gray-400" />
                                            {agency._count.users}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-gray-700 font-semibold">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="h-4 w-4 text-gray-400" />
                                            {agency._count.applications}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        {agency.isInternal ? (
                                            <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                                <CreditCard className="h-3.5 w-3.5" />
                                                Internal
                                            </span>
                                        ) : (
                                            <select
                                                disabled={isPending}
                                                value={
                                                    agency.subscription?.plan
                                                        .id || ""
                                                }
                                                onChange={(e) =>
                                                    handleChangePlan(
                                                        agency.id,
                                                        e.target.value
                                                    )
                                                }
                                                className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1E3A8A] bg-white"
                                            >
                                                <option value="" disabled>
                                                    Select plan
                                                </option>

                                                {plans
                                                    .filter(
                                                        (p) =>
                                                            p.slug !==
                                                            "internal"
                                                    )
                                                    .map((p) => (
                                                        <option
                                                            key={p.id}
                                                            value={p.id}
                                                        >
                                                            {p.name} (
                                                            {p.priceFcfa.toLocaleString()}{" "}
                                                            FCFA)
                                                        </option>
                                                    ))}
                                            </select>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                                                agency.status === "ACTIVE"
                                                    ? "bg-green-100 text-green-700 border border-green-200"
                                                    : "bg-red-100 text-red-700 border border-red-200"
                                            }`}
                                        >
                                            {agency.status}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        {!agency.isInternal && (
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Edit / Modify Agency */}
                                                <button
                                                    onClick={() => {
                                                        setError("");
                                                        setEditingAgency(agency);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-[#1E3A8A] hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit Agency"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>

                                                {/* Suspend / Reactivate */}
                                                <button
                                                    disabled={isPending}
                                                    onClick={() => {
                                                        setError("");
                                                        if (agency.status === "ACTIVE") {
                                                            setSuspendingAgency(agency);
                                                        } else {
                                                            // Direct reactivate or confirmation
                                                            setSuspendingAgency(agency);
                                                        }
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        agency.status === "SUSPENDED"
                                                            ? "text-green-600 hover:bg-green-50"
                                                            : "text-amber-500 hover:bg-amber-50"
                                                    }`}
                                                    title={
                                                        agency.status === "SUSPENDED"
                                                            ? "Reactivate Agency"
                                                            : "Suspend Agency"
                                                    }
                                                >
                                                    {agency.status === "SUSPENDED" ? (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    ) : (
                                                        <Ban className="h-4 w-4" />
                                                    )}
                                                </button>

                                                {/* Delete Agency */}
                                                <button
                                                    disabled={isPending}
                                                    onClick={() => {
                                                        setError("");
                                                        setDeletingAgency(agency);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete Agency"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {filteredAgencies.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-16 text-center text-gray-400 font-semibold"
                                    >
                                        {searchTerm
                                            ? "No agencies match your search."
                                            : "No agencies yet. Create the first one."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredAgencies.length > PAGE_SIZE && (
                    <div className="px-6 pb-6">
                        <TablePagination
                            page={safePage}
                            totalItems={filteredAgencies.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </div>

            {/* Create Agency Dialog */}
            <Dialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
            >
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-[#1E3A8A]">
                            New Agency
                        </DialogTitle>

                        <DialogDescription>
                            Creates the agency and its first Admin account in
                            one step.
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                            <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form
                        ref={formRef}
                        action={handleCreate}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-800">
                                Agency name
                            </label>

                            <Input
                                name="agencyName"
                                required
                                disabled={isPending}
                            />
                        </div>

                        <hr className="border-gray-200" />

                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            First Admin account
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-800">
                                Full name
                            </label>

                            <Input
                                name="adminName"
                                required
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-800">
                                Email
                            </label>

                            <Input
                                name="adminEmail"
                                type="email"
                                required
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-800">
                                Temporary password
                            </label>

                            <Input
                                name="adminPassword"
                                type="password"
                                required
                                disabled={isPending}
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold h-11 rounded-xl"
                        >
                            {isPending ? (
                                <Loader2 className="animate-spin w-4 h-4" />
                            ) : (
                                "Create Agency"
                            )}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Agency Dialog */}
            <Dialog
                open={!!editingAgency}
                onOpenChange={(open) => !open && setEditingAgency(null)}
            >
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-[#1E3A8A]">
                            Edit Agency
                        </DialogTitle>
                        <DialogDescription>
                            Update the information for this agency.
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                            <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {editingAgency && (
                        <form action={handleUpdate} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Agency Name</Label>
                                <Input
                                    name="name"
                                    defaultValue={editingAgency.name}
                                    required
                                    disabled={isPending}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Email (Optional)</Label>
                                <Input
                                    name="email"
                                    type="email"
                                    defaultValue={editingAgency.email || ""}
                                    disabled={isPending}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Phone Number (Optional)</Label>
                                <Input
                                    name="phone"
                                    defaultValue={editingAgency.phone || ""}
                                    disabled={isPending}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Address (Optional)</Label>
                                <Input
                                    name="address"
                                    defaultValue={editingAgency.address || ""}
                                    disabled={isPending}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold h-11 rounded-xl"
                            >
                                {isPending ? (
                                    <Loader2 className="animate-spin w-4 h-4" />
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Agency Confirmation Dialog (with Typed Name) */}
            {deletingAgency && (
                <ConfirmActionDialog
                    open={!!deletingAgency}
                    onOpenChange={(open) => !open && setDeletingAgency(null)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Agency"
                    description={`This action is irreversible. All users, procedures, and data for "${deletingAgency.name}" will be permanently deleted.`}
                    confirmTargetName={deletingAgency.name}
                    confirmButtonText="Delete Agency"
                    actionType="delete"
                    variant="danger"
                    isPending={isPending}
                    error={error}
                />
            )}

            {/* Suspend Agency Confirmation Dialog (with Typed Name) */}
            {suspendingAgency && (
                <ConfirmActionDialog
                    open={!!suspendingAgency}
                    onOpenChange={(open) => !open && setSuspendingAgency(null)}
                    onConfirm={handleSuspendConfirm}
                    title={
                        suspendingAgency.status === "SUSPENDED"
                            ? "Reactivate Agency"
                            : "Suspend Agency"
                    }
                    description={
                        suspendingAgency.status === "SUSPENDED"
                            ? `This will restore access for all staff and clients under "${suspendingAgency.name}".`
                            : `This will immediately block all agents and clients under "${suspendingAgency.name}" from signing in.`
                    }
                    confirmTargetName={suspendingAgency.name}
                    confirmButtonText={
                        suspendingAgency.status === "SUSPENDED"
                            ? "Reactivate Agency"
                            : "Suspend Agency"
                    }
                    actionType="suspend"
                    variant={suspendingAgency.status === "SUSPENDED" ? "warning" : "warning"}
                    isPending={isPending}
                    error={error}
                />
            )}
        </div>
    );
}
