"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
    getVisibleQuestions,
    groupIntoSteps,
    FormStep,
} from "@/lib/intake-form/engine";
import { Question } from "@/lib/intake-form/types";
import { saveIntakeFormProgressAction, submitIntakeFormAction } from "./actions";

interface Props {
    clientName: string;
    initialAnswers: Record<string, any>;
    initialSection: string | null;
    initialStatus: string;
}

function QuestionField({
    question,
    value,
    onChange,
}: {
    question: Question;
    value: any;
    onChange: (value: any) => void;
}) {
    switch (question.type) {
        case "text":
        case "number":
            return (
                <Input
                    type={question.type === "number" ? "number" : "text"}
                    value={value ?? ""}
                    placeholder={question.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                />
            );

        case "date":
            return (
                <Input
                    type="date"
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                />
            );

        case "textarea":
            return (
                <Textarea
                    value={value ?? ""}
                    placeholder={question.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                />
            );

        case "radio":
            return (
                <div className="space-y-2">
                    {question.options?.map((opt) => (
                        <label
                            key={opt.value}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                value === opt.value
                                    ? "border-[#1E3A8A] bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <input
                                type="radio"
                                className="accent-[#1E3A8A]"
                                checked={value === opt.value}
                                onChange={() => onChange(opt.value)}
                            />
                            <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                        </label>
                    ))}
                </div>
            );

        case "select":
            return (
                <select
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
                >
                    <option value="" disabled>
                        Sélectionnez...
                    </option>
                    {question.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            );

        case "checkbox": {
            const selected: string[] = Array.isArray(value) ? value : [];
            const toggle = (val: string) => {
                if (selected.includes(val)) {
                    onChange(selected.filter((v) => v !== val));
                } else {
                    onChange([...selected, val]);
                }
            };
            return (
                <div className="space-y-2">
                    {question.options?.map((opt) => (
                        <label
                            key={opt.value}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                selected.includes(opt.value)
                                    ? "border-[#1E3A8A] bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <input
                                type="checkbox"
                                className="accent-[#1E3A8A]"
                                checked={selected.includes(opt.value)}
                                onChange={() => toggle(opt.value)}
                            />
                            <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                        </label>
                    ))}
                </div>
            );
        }

        case "upload":
            return (
                <p className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded-xl">
                    Le téléversement de document dans le formulaire arrive bientôt — votre agent pourra vous le demander séparément pour le moment.
                </p>
            );

        default:
            return null;
    }
}

export default function IntakeFormClient({
    clientName,
    initialAnswers,
    initialSection,
    initialStatus,
}: Props) {
    const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
    const [submitted, setSubmitted] = useState(initialStatus === "SUBMITTED");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    const country = answers.destinationCountry || null;

    const steps: FormStep[] = useMemo(() => {
        const visible = getVisibleQuestions(country, answers);
        return groupIntoSteps(visible);
    }, [country, answers]);

    const [stepIndex, setStepIndex] = useState<number>(() => {
        if (!initialSection) return 0;
        const idx = steps.findIndex((s) => s.section === initialSection);
        return idx >= 0 ? idx : 0;
    });

    const safeStepIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
    const currentStep = steps[safeStepIndex];
    const isLastStep = safeStepIndex === steps.length - 1;

    const setAnswer = (id: string, value: any) => {
        setAnswers((prev) => ({ ...prev, [id]: value }));
    };

    const validateCurrentStep = () => {
        if (!currentStep) return true;
        for (const q of currentStep.questions) {
            if (!q.required) continue;
            const v = answers[q.id];
            if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
                setError("Merci de répondre à toutes les questions obligatoires avant de continuer.");
                return false;
            }
        }
        setError("");
        return true;
    };

    const handleNext = () => {
        if (!validateCurrentStep()) return;

        const nextIndex = Math.min(safeStepIndex + 1, steps.length - 1);
        const nextSection = steps[nextIndex]?.section || null;

        startTransition(async () => {
            const result = await saveIntakeFormProgressAction(answers, nextSection);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            setStepIndex(nextIndex);
        });
    };

    const handleBack = () => {
        setError("");
        setStepIndex((i) => Math.max(0, i - 1));
    };

    const handleSubmit = () => {
        if (!validateCurrentStep()) return;

        startTransition(async () => {
            const result = await submitIntakeFormAction(answers);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            setSubmitted(true);
            toast.success("Formulaire envoyé avec succès !");
        });
    };

    if (submitted) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Merci, {clientName} !</h1>
                <p className="text-gray-500">
                    Votre formulaire a bien été envoyé. Votre agent utilisera ces informations pour préparer votre dossier — vous pourrez toujours en discuter ensemble par la suite.
                </p>
            </div>
        );
    }

    if (!currentStep) {
        return null;
    }

    const progressPct = Math.round(((safeStepIndex + 1) / steps.length) * 100);

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="mb-6">
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2">
                    <span>Étape {safeStepIndex + 1} sur {steps.length}</span>
                    <span>{progressPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#1E3A8A] transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h2 className="text-lg font-bold text-[#1E3A8A] mb-6">{currentStep.label}</h2>

                <div className="space-y-6">
                    {currentStep.questions.map((q) => (
                        <div key={q.id}>
                            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                                {q.label}
                                {q.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {q.helpText && (
                                <p className="text-xs text-gray-400 italic mb-2">{q.helpText}</p>
                            )}
                            <QuestionField
                                question={q}
                                value={answers[q.id]}
                                onChange={(v) => setAnswer(q.id, v)}
                            />
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="mt-5 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={safeStepIndex === 0 || isPending}
                        className="gap-2 rounded-xl"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Précédent
                    </Button>

                    {isLastStep ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="gap-2 rounded-xl text-white"
                            style={{ backgroundColor: "#1E3A8A" }}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Soumettre le formulaire
                        </Button>
                    ) : (
                        <Button
                            onClick={handleNext}
                            disabled={isPending}
                            className="gap-2 rounded-xl text-white"
                            style={{ backgroundColor: "#1E3A8A" }}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Suivant
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}