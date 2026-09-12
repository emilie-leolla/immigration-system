import { Question } from "./types";

/**
 * Sources checked before writing these (Sept 2026): France Éducation
 * International / Centre ENIC-NARIC France handles diploma comparability
 * attestations (~120€, ~4 months). Since Jan 2026, ENIC-NARIC attestations
 * are no longer accepted for naturalization specifically — a TCF IRN test
 * is required instead for that purpose. Adjust these questions if rules
 * change again; immigration policy shifts often.
 */
export const franceModule: Question[] = [
    {
        id: "fr_hasPrefectureApplication",
        section: "fr_immigration",
        label: "Avez-vous déjà fait une demande de titre de séjour ou de visa auprès de la préfecture / des autorités françaises dans le passé ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
    },
    {
        id: "fr_prefectureDetails",
        section: "fr_immigration",
        label: "Veuillez préciser les détails de la demande faite et la décision reçue.",
        type: "textarea",
        required: true,
        condition: [{ questionId: "fr_hasPrefectureApplication", equals: "YES" }],
    },
    {
        id: "fr_immigrationGoal",
        section: "fr_immigration",
        label: "Quel est l'objectif principal de votre démarche en France ?",
        type: "radio",
        required: true,
        options: [
            { value: "WORK", label: "Emploi / carte de séjour salarié" },
            { value: "STUDIES", label: "Études" },
            { value: "FAMILY", label: "Regroupement familial" },
            { value: "NATURALIZATION", label: "Naturalisation" },
        ],
    },

    // --- Diploma equivalence for France is the ENIC-NARIC attestation ---
    {
        id: "fr_masterEnicNaric",
        section: "academicMaster",
        label: "Avez-vous fait une demande d'attestation de comparabilité ENIC-NARIC pour votre diplôme de Master 2 ?",
        helpText: "Délivrée par France Éducation International — c'est l'équivalent français de l'évaluation de diplôme",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
            { value: "IN_PROGRESS", label: "En cours" },
        ],
        condition: [{ questionId: "hasMaster", equals: "YES" }],
    },
    {
        id: "fr_licenceEnicNaric",
        section: "academicLicence",
        label: "Avez-vous fait une demande d'attestation de comparabilité ENIC-NARIC pour ce diplôme de licence ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
            { value: "IN_PROGRESS", label: "En cours" },
        ],
        condition: [{ questionId: "hasMaster", equals: "NO" }],
    },
    {
        id: "fr_bac2EnicNaric",
        section: "academicBac2",
        label: "Avez-vous fait une demande d'attestation de comparabilité ENIC-NARIC pour votre diplôme de niveau Bac+2 ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
            { value: "IN_PROGRESS", label: "En cours" },
        ],
        condition: [{ questionId: "licenceHasOtherDegree", equals: "YES" }],
    },

    // --- Language tests — TCF / DELF-DALF, with TCF IRN specifically for naturalization ---
    {
        id: "fr_hasFrenchTest",
        section: "language",
        label: "Avez-vous déjà passé un test de connaissance du français ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
    },
    {
        id: "fr_frenchTestType",
        section: "language",
        label: "Quel(s) test(s) avez-vous fait (cochez plusieurs cases si applicable) ?",
        helpText: "Le TCF IRN est spécifiquement requis pour une demande de naturalisation depuis janvier 2026 — l'attestation ENIC-NARIC seule n'y suffit plus.",
        type: "checkbox",
        required: true,
        options: [
            { value: "TCF_TP", label: "TCF Tout Public" },
            { value: "TCF_IRN", label: "TCF IRN (immigration, résidence, naturalisation)" },
            { value: "DELF", label: "DELF" },
            { value: "DALF", label: "DALF" },
        ],
        condition: [{ questionId: "fr_hasFrenchTest", equals: "YES" }],
        documentType: "LANGUAGE_REGISTRATION",
    },
    {
        id: "fr_frenchLevel",
        section: "language",
        label: "Quel niveau avez-vous obtenu (A1 à C2) ?",
        placeholder: "Exemple : B2",
        type: "text",
        required: true,
        condition: [{ questionId: "fr_hasFrenchTest", equals: "YES" }],
        documentType: "LANGUAGE_RESULT",
    },

    {
        id: "fr_preferredRegion",
        section: "lifeInCountry",
        label: "Dans quelle région/ville de France aimeriez-vous vous installer ?",
        helpText: "Vous pouvez en citer plusieurs. Exemple : Île-de-France / Lyon / Toulouse",
        type: "text",
        required: true,
    },

    // --- Spouse — France uses the same TCF/DELF-DALF tests ---
    {
        id: "fr_spouseLanguageTest",
        section: "spouseLanguage",
        label: "Quel(s) test(s) de langue française le conjoint a-t-il ?",
        type: "radio",
        required: true,
        options: [
            { value: "NONE", label: "Aucun test de langue" },
            { value: "TCF_TP", label: "TCF Tout Public" },
            { value: "TCF_IRN", label: "TCF IRN" },
            { value: "DELF", label: "DELF" },
            { value: "DALF", label: "DALF" },
        ],
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
    {
        id: "fr_spouseLevel",
        section: "spouseLanguage",
        label: "Son niveau obtenu (A1 à C2)",
        placeholder: "Exemple : B1",
        type: "text",
        required: false,
        condition: [
            { questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] },
            { questionId: "fr_spouseLanguageTest", notEquals: "NONE" },
        ],
    },
];