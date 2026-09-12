import { Question } from "./types";

/**
 * Asked first, right after personal details — this is the branch point:
 * every question after this one (except the other shared sections) comes
 * from the matching country module in ./canada.ts, ./france.ts, ./germany.ts
 */
export const destinationQuestion: Question = {
    id: "destinationCountry",
    section: "destination",
    label: "Dans quel pays souhaitez-vous immigrer ?",
    type: "radio",
    required: true,
    options: [
        { value: "CANADA", label: "Canada" },
        { value: "FRANCE", label: "France" },
        { value: "GERMANY", label: "Allemagne" },
    ],
};

export const personalDetailsQuestions: Question[] = [
    {
        id: "phone",
        section: "personalDetails",
        label: "Votre numéro de téléphone (WhatsApp de préférence)",
        helpText: "Pensez à préciser l'indicatif du pays. Exemple : +237 676 11 32 24",
        type: "text",
        required: true,
        profileField: "phoneNumber",
    },
    {
        id: "dateOfBirth",
        section: "personalDetails",
        label: "Quelle est votre date de naissance ?",
        type: "date",
        required: true,
        profileField: "dateOfBirth",
    },
    {
        id: "countryOfResidence",
        section: "personalDetails",
        label: "Quel est votre pays de résidence actuel ?",
        placeholder: "Exemple : Cameroun",
        type: "text",
        required: true,
    },
    {
        id: "cityOfResidence",
        section: "personalDetails",
        label: "Quelle est votre ville de résidence actuelle ?",
        placeholder: "Exemple : Yaoundé",
        type: "text",
        required: true,
        profileField: "currentAddress",
    },
    {
        id: "passportStatus",
        section: "personalDetails",
        label: "Détenez-vous un passeport valide (avec votre profession y indiquée) ?",
        type: "radio",
        required: true,
        options: [
            { value: "VALID_WITH_PROFESSION", label: "Oui, j'ai un passeport valide et ma profession y est indiquée" },
            { value: "VALID_NO_PROFESSION", label: "Oui, j'ai un passeport valide, mais ma profession n'y est pas indiquée" },
            { value: "NONE", label: "Non, je n'ai pas de passeport valide" },
        ],
        documentType: "PASSPORT",
    },
];

export const academicQuestions: Question[] = [
    {
        id: "hasMaster",
        section: "academic",
        label: "Avez-vous un diplôme universitaire de niveau Master 2 (Ingénieur et Doctorat inclus) ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non (j'ai un seul diplôme universitaire)" },
        ],
    },

    // --- Branch: has a Master's ---
    {
        id: "masterDate",
        section: "academicMaster",
        label: "Mois et année d'obtention de ce diplôme de Master 2",
        placeholder: "Exemple : Juillet 2022",
        type: "text",
        required: true,
        condition: [{ questionId: "hasMaster", equals: "YES" }],
    },
    {
        id: "masterUniversity",
        section: "academicMaster",
        label: "Université qui a délivré ce diplôme de Master 2",
        placeholder: "Exemple : Université de Douala",
        type: "text",
        required: true,
        condition: [{ questionId: "hasMaster", equals: "YES" }],
    },
    {
        id: "masterField",
        section: "academicMaster",
        label: "Filière d'étude de ce diplôme de Master 2",
        placeholder: "Exemple : Comptabilité et finance",
        type: "text",
        required: true,
        condition: [{ questionId: "hasMaster", equals: "YES" }],
    },
    {
        id: "masterHasOtherDegree",
        section: "academicMaster",
        label: "Avez-vous un autre diplôme à part le Master 2 ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [{ questionId: "hasMaster", equals: "YES" }],
    },

    // --- Branch: no Master's — Licence details ---
    {
        id: "licenceDate",
        section: "academicLicence",
        label: "Mois et année d'obtention de ce diplôme de licence",
        placeholder: "Exemple : Juillet 2022",
        type: "text",
        required: true,
        condition: [{ questionId: "hasMaster", equals: "NO" }],
    },
    {
        id: "licenceUniversity",
        section: "academicLicence",
        label: "Université qui a délivré ce diplôme de licence",
        placeholder: "Exemple : Université de Douala",
        type: "text",
        required: true,
        condition: [{ questionId: "hasMaster", equals: "NO" }],
    },
    {
        id: "licenceField",
        section: "academicLicence",
        label: "Filière d'étude de ce diplôme de licence",
        placeholder: "Exemple : Comptabilité et finance",
        type: "text",
        required: true,
        condition: [{ questionId: "hasMaster", equals: "NO" }],
    },
    {
        id: "licenceHasOtherDegree",
        section: "academicLicence",
        label: "Avez-vous un autre diplôme à part cette licence (un diplôme de niveau Bac+2) ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [{ questionId: "hasMaster", equals: "NO" }],
    },

    // --- Licence details also asked when Master holder said they have another degree ---
    {
        id: "licenceDateBis",
        section: "academicLicenceBis",
        label: "Mois et année d'obtention de ce diplôme de licence",
        placeholder: "Exemple : Juillet 2022",
        type: "text",
        required: true,
        condition: [
            { questionId: "hasMaster", equals: "YES" },
            { questionId: "masterHasOtherDegree", equals: "YES" },
        ],
    },
    {
        id: "licenceUniversityBis",
        section: "academicLicenceBis",
        label: "Université qui a délivré ce diplôme de licence",
        placeholder: "Exemple : Université de Douala",
        type: "text",
        required: true,
        condition: [
            { questionId: "hasMaster", equals: "YES" },
            { questionId: "masterHasOtherDegree", equals: "YES" },
        ],
    },
    {
        id: "licenceFieldBis",
        section: "academicLicenceBis",
        label: "Filière d'étude de ce diplôme de licence",
        placeholder: "Exemple : Comptabilité et finance",
        type: "text",
        required: true,
        condition: [
            { questionId: "hasMaster", equals: "YES" },
            { questionId: "masterHasOtherDegree", equals: "YES" },
        ],
    },

    // --- Bac+2 details (BTS/HND/DSEP) ---
    {
        id: "bac2Type",
        section: "academicBac2",
        label: "Sélectionnez votre diplôme de niveau Bac+2",
        type: "radio",
        required: true,
        options: [
            { value: "BTS", label: "BTS" },
            { value: "HND", label: "HND" },
            { value: "DSEP", label: "DSEP" },
        ],
        condition: [{ questionId: "licenceHasOtherDegree", equals: "YES" }],
    },
    {
        id: "bac2Date",
        section: "academicBac2",
        label: "Mois et année d'obtention de ce diplôme de niveau Bac+2",
        placeholder: "Exemple : Juillet 2022",
        type: "text",
        required: true,
        condition: [{ questionId: "licenceHasOtherDegree", equals: "YES" }],
    },
    {
        id: "bac2University",
        section: "academicBac2",
        label: "Université/établissement qui a délivré ce diplôme de niveau Bac+2",
        placeholder: "Exemple : Université de Douala",
        type: "text",
        required: true,
        condition: [{ questionId: "licenceHasOtherDegree", equals: "YES" }],
    },
    {
        id: "bac2Field",
        section: "academicBac2",
        label: "Filière d'étude de ce diplôme de niveau Bac+2",
        placeholder: "Exemple : Comptabilité et finance",
        type: "text",
        required: true,
        condition: [{ questionId: "licenceHasOtherDegree", equals: "YES" }],
    },

    {
        id: "academicOtherDetails",
        section: "academicOptional",
        label: "Autres informations concernant vos études que vous jugez important de préciser (facultatif)",
        helpText: "Exemple : J'ai un doctorat, je ne peux pas avoir accès à mes relevés de notes de Licence",
        type: "textarea",
        required: false,
    },
];

export const experienceQuestions: Question[] = [
    {
        id: "hasExperience",
        section: "experience",
        label: "Avez-vous de l'expérience professionnelle ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
    },
    {
        id: "job1Title",
        section: "experienceJob1",
        label: "Quelle est ou était votre profession dans l'emploi le plus récent ?",
        type: "text",
        required: true,
        condition: [{ questionId: "hasExperience", equals: "YES" }],
    },
    {
        id: "job1Dates",
        section: "experienceJob1",
        label: "Date (mois et année) de début et fin dans l'emploi le plus récent",
        helpText: "Préciser \"en cours\" le cas échéant. Exemple : de Juillet 2001 - en cours",
        type: "text",
        required: true,
        condition: [{ questionId: "hasExperience", equals: "YES" }],
    },
    {
        id: "job1Proof",
        section: "experienceJob1",
        label: "Êtes-vous en mesure de fournir des preuves de cette expérience professionnelle ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [{ questionId: "hasExperience", equals: "YES" }],
        documentType: "WORK_CERTIFICATE",
    },
    {
        id: "hasOtherJob",
        section: "experienceJob1",
        label: "Avez-vous une autre expérience de travail dans une autre entreprise ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [{ questionId: "hasExperience", equals: "YES" }],
    },
    {
        id: "job2Title",
        section: "experienceJob2",
        label: "Quelle était votre profession dans cet autre emploi ?",
        type: "text",
        required: true,
        condition: [
            { questionId: "hasExperience", equals: "YES" },
            { questionId: "hasOtherJob", equals: "YES" },
        ],
    },
    {
        id: "job2Dates",
        section: "experienceJob2",
        label: "Date (mois et année) de début et fin pour cet autre emploi",
        placeholder: "Exemple : de Juillet 2001 à Février 2025",
        type: "text",
        required: true,
        condition: [
            { questionId: "hasExperience", equals: "YES" },
            { questionId: "hasOtherJob", equals: "YES" },
        ],
    },
    {
        id: "job2Proof",
        section: "experienceJob2",
        label: "Êtes-vous en mesure de fournir des preuves de cette autre expérience professionnelle ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [
            { questionId: "hasExperience", equals: "YES" },
            { questionId: "hasOtherJob", equals: "YES" },
        ],
        documentType: "WORK_CERTIFICATE",
    },
];

export const financialQuestions: Question[] = [
    {
        id: "hasProofOfFunds",
        section: "financial",
        label: "Avez-vous une preuve de fonds valide ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
    },
];

export const familyQuestions: Question[] = [
    {
        id: "hasCanadianFamily",
        section: "family",
        label: "Avez-vous un frère/sœur ou parent de plus de 18 ans qui réside dans le pays visé, ou qui en a la nationalité ?",
        helpText: "Il s'agit ici de la famille directe (les cousins/cousines et oncles/tantes, neveux/nièces sont exclus)",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
    },
    {
        id: "travelMotivation",
        section: "family",
        label: "Quelle est votre motivation de voyage ?",
        type: "radio",
        required: true,
        options: [
            { value: "STUDIES", label: "Études" },
            { value: "EMPLOYMENT", label: "Emploi" },
            { value: "FAMILY", label: "Famille" },
            { value: "TOURISM", label: "Tourisme" },
            { value: "BUSINESS", label: "Affaires" },
            { value: "OTHER", label: "Autre" },
        ],
    },
    {
        id: "numberOfChildren",
        section: "family",
        label: "Combien d'enfant(s) avez-vous (les enfants de votre conjoint y compris) ?",
        helpText: "Les enfants doivent être les vôtres, c'est-à-dire votre nom doit figurer sur l'acte de naissance comme étant le parent.",
        type: "select",
        required: true,
        options: [
            { value: "0", label: "00" },
            { value: "1", label: "01" },
            { value: "2", label: "02" },
            { value: "3", label: "03" },
            { value: "4", label: "04" },
            { value: "5", label: "05" },
            { value: "6+", label: "+ de 5" },
        ],
    },
    {
        id: "numberOfAccompanyingChildren",
        section: "family",
        label: "Combien d'enfant(s) vous accompagneront (les enfants de votre conjoint y compris) ?",
        type: "select",
        required: true,
        options: [
            { value: "0", label: "00" },
            { value: "1", label: "01" },
            { value: "2", label: "02" },
            { value: "3", label: "03" },
            { value: "4", label: "04" },
            { value: "5", label: "05" },
            { value: "6+", label: "+ de 5" },
        ],
    },
    {
        id: "maritalStatus",
        section: "family",
        label: "Quel est votre statut matrimonial ?",
        type: "radio",
        required: true,
        profileField: "maritalStatus",
        options: [
            { value: "SINGLE", label: "Célibataire" },
            { value: "MARRIED", label: "Marié(e)" },
            { value: "COMMON_LAW", label: "Conjoint(e) de fait" },
        ],
    },

    // --- Spouse / common-law partner details ---
    {
        id: "spouseAccompanying",
        section: "spouse",
        label: "Est-ce que votre conjoint(e) vous accompagnera ?",
        type: "checkbox",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
    {
        id: "spouseName",
        section: "spouse",
        label: "Nom du conjoint",
        type: "text",
        required: true,
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
    {
        id: "spouseAge",
        section: "spouse",
        label: "Âge du conjoint",
        type: "number",
        required: true,
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
    {
        id: "spouseAcademicLevel",
        section: "spouse",
        label: "Niveau académique du conjoint",
        helpText: "Quel est son diplôme le plus élevé, avec l'année d'obtention. Exemple : BEPC session 2019",
        type: "text",
        required: true,
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
    {
        id: "spouseHasEquivalence",
        section: "spouse",
        label: "Votre conjoint a-t-il une équivalence de diplôme ?",
        type: "radio",
        required: true,
        options: [
            { value: "YES", label: "Oui" },
            { value: "NO", label: "Non" },
        ],
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
    {
        id: "spouseExperienceYears",
        section: "spouse",
        label: "Nombre d'années d'expérience professionnelle du conjoint",
        helpText: "Assurez-vous que cette expérience peut être prouvée",
        type: "number",
        required: true,
        condition: [{ questionId: "maritalStatus", in: ["MARRIED", "COMMON_LAW"] }],
    },
];