"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Layers, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createPlanAction, updatePlanAction, deletePlanAction } from "./actions";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

interface Plan {
    id: string;
    name: string;
    slug: string;
    priceFcfa: number;
    maxAgents: number | null;
    maxClients: number | null;
    maxWorkflows: number | null;
    isPublic: boolean;
    _count: { subscriptions: number };
}

export default function PlanManager({ initialPlans }: { initialPlans: Plan[] }) {
    const [plans, setPlans] = useState(initialPlans);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
    const [error, setError] = useState("");
    const [isPending, startTransition] = useTransition();
    const [isDeletePending, startDeleteTransition] = useTransition();
    const createFormRef = useRef<HTMLFormElement>(null);

    function handleCreate(formData: FormData) {
        setError("");
        startTransition(async () => {
            const result = await createPlanAction(formData);
            if (result?.error) {
                setError(result.error);
            } else {
                toast.success("Plan created");
                setIsCreateOpen(false);
                createFormRef.current?.reset();
                window.location.reload();
            }
        });
    }

    function handleUpdate(formData: FormData) {
        if (!editingPlan) return;
        setError("");
        startTransition(async () => {
            const result = await updatePlanAction(editingPlan.id, formData);
            if (result?.error) {
                setError(result.error);
            } else {
                toast.success("Plan updated");
                setEditingPlan(null);
                window.location.reload();
            }
        });
    }

    function handleDelete() {
        if (!deletingPlan) return;
        setError("");
        startDeleteTransition(async () => {
            const result = await deletePlanAction(deletingPlan.id);
            if (result?.error) {
                setError(result.error);
                toast.error(result.error);
            } else {
                toast.success(`Plan "${deletingPlan.name}" deleted`);
                setDeletingPlan(null);
                window.location.reload();
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Subscription Plans
                </h2>
                <Button
                    onClick={() => { setError(""); setIsCreateOpen(true); }}
                    className="bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold rounded-xl gap-2"
                >
                    <Plus className="h-4 w-4" /> New Plan
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                    <Card key={plan.id} className="border-none shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-shadow">
                        <CardContent className="p-5 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-black text-gray-900 text-lg">{plan.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{plan.slug}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { setError(""); setEditingPlan(plan); }}
                                        className="p-2 text-gray-400 hover:text-[#1E3A8A] hover:bg-blue-50 transition-colors rounded-lg"
                                        title="Edit plan"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => { setError(""); setDeletingPlan(plan); }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg"
                                        title="Delete plan"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-lg font-black text-[#1E3A8A]">{plan.priceFcfa.toLocaleString()} FCFA<span className="text-xs text-gray-400 font-bold">/year</span></p>
                            <div className="flex flex-wrap gap-2 text-xs font-bold text-gray-500">
                                <span className="px-2 py-1 bg-gray-100 rounded-lg">Agents: {plan.maxAgents ?? "∞"}</span>
                                <span className="px-2 py-1 bg-gray-100 rounded-lg">Clients: {plan.maxClients ?? "∞"}</span>
                                <span className="px-2 py-1 bg-gray-100 rounded-lg">Workflows: {plan.maxWorkflows ?? "∞"}</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <span className={`text-xs font-black uppercase px-2 py-1 rounded ${plan.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                    {plan.isPublic ? "Public" : "Hidden"}
                                </span>
                                <span className="text-xs text-gray-400 font-semibold">{plan._count.subscriptions} agenc{plan._count.subscriptions === 1 ? "y" : "ies"}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Create dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-[#1E3A8A]">New Plan</DialogTitle>
                        <DialogDescription>Create a new subscription plan agencies can select.</DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                            <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form ref={createFormRef} action={handleCreate} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input name="name" required disabled={isPending} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Slug (unique)</Label>
                            <Input name="slug" required disabled={isPending} placeholder="e.g. gold" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Price (FCFA / year)</Label>
                            <Input name="priceFcfa" type="number" min={0} required disabled={isPending} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label>Max agents</Label>
                                <Input name="maxAgents" type="number" min={0} placeholder="Unlimited" disabled={isPending} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max clients</Label>
                                <Input name="maxClients" type="number" min={0} placeholder="Unlimited" disabled={isPending} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max workflows</Label>
                                <Input name="maxWorkflows" type="number" min={0} placeholder="Unlimited" disabled={isPending} />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <input type="checkbox" name="isPublic" defaultChecked disabled={isPending} />
                            Visible to agencies (public)
                        </label>

                        <Button type="submit" disabled={isPending} className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold h-11 rounded-xl">
                            {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Create Plan"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-[#1E3A8A]">Edit Plan</DialogTitle>
                        <DialogDescription>Slug cannot be changed once created.</DialogDescription>
                    </DialogHeader>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                            <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {editingPlan && (
                        <form action={handleUpdate} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Name</Label>
                                <Input name="name" required disabled={isPending} defaultValue={editingPlan.name} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Slug</Label>
                                <Input disabled value={editingPlan.slug} className="bg-gray-50" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Price (FCFA / year)</Label>
                                <Input name="priceFcfa" type="number" min={0} required disabled={isPending} defaultValue={editingPlan.priceFcfa} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Max agents</Label>
                                    <Input name="maxAgents" type="number" min={0} placeholder="Unlimited" disabled={isPending} defaultValue={editingPlan.maxAgents ?? ""} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Max clients</Label>
                                    <Input name="maxClients" type="number" min={0} placeholder="Unlimited" disabled={isPending} defaultValue={editingPlan.maxClients ?? ""} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Max workflows</Label>
                                    <Input name="maxWorkflows" type="number" min={0} placeholder="Unlimited" disabled={isPending} defaultValue={editingPlan.maxWorkflows ?? ""} />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <input type="checkbox" name="isPublic" defaultChecked={editingPlan.isPublic} disabled={isPending} />
                                Visible to agencies (public)
                            </label>

                            <Button type="submit" disabled={isPending} className="w-full bg-[#1E3A8A] text-white hover:bg-blue-900 font-bold h-11 rounded-xl">
                                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "Save Changes"}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog (with typed name) */}
            {deletingPlan && (
                <ConfirmActionDialog
                    open={!!deletingPlan}
                    onOpenChange={(open) => !open && setDeletingPlan(null)}
                    onConfirm={handleDelete}
                    title="Delete Subscription Plan"
                    description={
                        deletingPlan._count.subscriptions > 0
                            ? `⚠️ This plan currently has ${deletingPlan._count.subscriptions} active agenc${deletingPlan._count.subscriptions === 1 ? "y" : "ies"}. You must move them to another plan or hide this plan before deleting.`
                            : `Are you sure you want to delete the plan "${deletingPlan.name}"? This action cannot be undone.`
                    }
                    confirmTargetName={deletingPlan.name}
                    confirmButtonText="Delete Plan"
                    actionType="delete"
                    variant="danger"
                    isPending={isDeletePending}
                    error={error}
                />
            )}
        </div>
    );
}