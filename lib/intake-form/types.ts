export type QuestionType =
    | "text"
    | "textarea"
    | "radio"
    | "checkbox"
    | "date"
    | "select"
    | "number"
    | "upload";

export interface QuestionOption {
    value: string;
    label: string;
}

/**
 * A single condition checked against previously-given answers. All
 * conditions in a question's `condition` array must be true (AND) for the
 * question to be shown.
 */
export interface Condition {
    questionId: string;
    equals?: string;
    in?: string[];
    notEquals?: string;
}

export interface Question {
    id: string;
    section: string;
    label: string;
    helpText?: string;
    placeholder?: string;
    type: QuestionType;
    options?: QuestionOption[];
    required?: boolean;
    condition?: Condition[];
    /**
     * If set, this answer is written directly onto the client's User/profile
     * record on submission (see lib/intake-form/engine.ts -> syncProfileFields).
     */
    profileField?: string;
    /**
     * If type === "upload", the DocumentType this file should be saved
     * under when the client attaches it.
     */
    documentType?: string;
}

export interface CountryModule {
    id: string;
    label: string;
    questions: Question[];
}

export type Answers = Record<string, any>;