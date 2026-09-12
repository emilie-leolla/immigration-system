import { Question, Condition, Answers } from "./types";
import {
    destinationQuestion,
    personalDetailsQuestions,
    academicQuestions,
    experienceQuestions,
    financialQuestions,
    familyQuestions,
} from "./shared-questions";
import { canadaModule } from "./canada";
import { franceModule } from "./france";
import { germanyModule } from "./germany";

const countryModules: Record<string, Question[]> = {
    CANADA: canadaModule,
    FRANCE: franceModule,
    GERMANY: germanyModule,
};

/**
 * Canonical section order. Country-specific "immigration" sections use
 * different literal keys (ca_immigration / fr_immigration / de_immigration)
 * since each country's process is named differently — only one of the
 * three will ever actually have visible questions for a given client
 * (whichever country they picked), so listing all three here is safe; the
 * other two simply contribute zero questions and are skipped.
 */
const SECTION_ORDER = [
    "destination",
    "personalDetails",
    "ca_immigration",
    "fr_immigration",
    "de_immigration",
    "academic",
    "academicMaster",
    "academicLicence",
    "academicLicenceBis",
    "academicBac2",
    "academicOptional",
    "experience",
    "experienceJob1",
    "experienceJob2",
    "financial",
    "language",
    "lifeInCountry",
    "family",
    "spouse",
    "spouseLanguage",
];

export const SECTION_LABELS: Record<string, string> = {
    destination: "Destination",
    personalDetails: "Détails personnels",
    ca_immigration: "Précisions sur votre demande auprès de IRCC (Immigration Canada)",
    fr_immigration: "Précisions sur votre démarche en France",
    de_immigration: "Précisions sur votre démarche en Allemagne",
    academic: "Parcours académique / Diplôme universitaire",
    academicMaster: "Détails du diplôme de niveau Master 2",
    academicLicence: "Détails du diplôme de licence",
    academicLicenceBis: "Détails du diplôme de licence",
    academicBac2: "Détails du diplôme de niveau Bac+2",
    academicOptional: "Autres détails concernant vos études (facultatif)",
    experience: "Expérience professionnelle",
    experienceJob1: "Détails de votre emploi le plus récent (ou en cours)",
    experienceJob2: "Détails de l'autre emploi",
    financial: "Situation financière",
    language: "Test de langue",
    lifeInCountry: "Vie dans le pays visé",
    family: "Situation familiale",
    spouse: "Informations du conjoint ou conjoint de fait",
    spouseLanguage: "Test de langue du conjoint",
};

/**
 * Every question that could ever appear for the given country, in the
 * canonical order. Not yet filtered by conditional visibility — see
 * getVisibleQuestions for that.
 */
export function getAllQuestions(country: string | null): Question[] {
    const countryQs = country ? countryModules[country] || [] : [];

    const all: Question[] = [
        destinationQuestion,
        ...personalDetailsQuestions,
        ...academicQuestions,
        ...experienceQuestions,
        ...financialQuestions,
        ...familyQuestions,
        ...countryQs,
    ];

    return all
        .map((q, originalIndex) => ({ q, originalIndex }))
        .sort((a, b) => {
            const ai = SECTION_ORDER.indexOf(a.q.section);
            const bi = SECTION_ORDER.indexOf(b.q.section);
            if (ai !== bi) return ai - bi;
            return a.originalIndex - b.originalIndex;
        })
        .map((x) => x.q);
}

function conditionMet(condition: Condition, answers: Answers): boolean {
    const value = answers[condition.questionId];
    if (condition.equals !== undefined) return value === condition.equals;
    if (condition.notEquals !== undefined) return value !== condition.notEquals;
    if (condition.in !== undefined) return condition.in.includes(value);
    return true;
}

export function isQuestionVisible(question: Question, answers: Answers): boolean {
    if (!question.condition || question.condition.length === 0) return true;
    return question.condition.every((c) => conditionMet(c, answers));
}

export function getVisibleQuestions(country: string | null, answers: Answers): Question[] {
    return getAllQuestions(country).filter((q) => isQuestionVisible(q, answers));
}

export interface FormStep {
    section: string;
    label: string;
    questions: Question[];
}

export function groupIntoSteps(questions: Question[]): FormStep[] {
    const steps: FormStep[] = [];
    for (const q of questions) {
        const last = steps[steps.length - 1];
        if (last && last.section === q.section) {
            last.questions.push(q);
        } else {
            steps.push({
                section: q.section,
                label: SECTION_LABELS[q.section] || q.section,
                questions: [q],
            });
        }
    }
    return steps;
}

/**
 * Turns a raw stored answer (e.g. "MARRIED", or ["TCF_CANADA","IELTS"])
 * into its human-readable label(s) for display to the agent — falls back
 * to the raw value if no matching option is found (e.g. free-text answers).
 */
export function formatAnswerForDisplay(question: Question, value: any): string {
    if (value === undefined || value === null || value === "") return "—";

    if (Array.isArray(value)) {
        return value
            .map((v) => question.options?.find((o) => o.value === v)?.label || v)
            .join(", ");
    }

    if (question.options) {
        const match = question.options.find((o) => o.value === value);
        if (match) return match.label;
    }

    return String(value);
}

/**
 * Every question actually answered for a submitted form, in canonical
 * order, grouped by section — used to render a read-only summary for
 * agents/admins.
 */
export function getAnsweredQuestionsBySection(
    country: string | null,
    answers: Answers
): FormStep[] {
    const visible = getVisibleQuestions(country, answers);
    const answered = visible.filter((q) => {
        const v = answers[q.id];
        return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
    });
    return groupIntoSteps(answered);
}
 /* intake form additionally offers "COMMON_LAW" (conjoint de fait), which
 * has no matching enum value — that answer is kept in the raw JSON
 * response but intentionally NOT synced to the profile field, since
 * writing it would violate the database enum and crash the submission.
 */
const VALID_MARITAL_STATUS = new Set(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]);

/**
 * Builds the { profileFieldName: value } object to merge onto the
 * client's User record on submission — only for questions that declared a
 * profileField AND were actually answered AND (for enum fields) whose
 * value is a valid enum member.
 */
export function extractProfileSyncFields(country: string | null, answers: Answers): Record<string, any> {
    const questions = getAllQuestions(country);
    const updates: Record<string, any> = {};

    for (const q of questions) {
        if (!q.profileField) continue;
        const value = answers[q.id];
        if (value === undefined || value === null || value === "") continue;

        if (q.profileField === "maritalStatus" && !VALID_MARITAL_STATUS.has(value)) {
            continue;
        }

        updates[q.profileField] = value;
    }

    return updates;
}