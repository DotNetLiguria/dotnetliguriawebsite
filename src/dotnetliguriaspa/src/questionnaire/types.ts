// Mirrors DotNetLiguriaCore.Model questionnaire contracts (camelCase JSON, enums as strings).

export type QuestionnaireStatus = 'Draft' | 'Published' | 'Closed' | 'Archived';
export type RespondentMode = 'Anonymous' | 'Identified' | 'Authenticated';
export type QuestionnaireDisplayMode = 'SinglePage' | 'Stepper';
export type QuestionType =
  | 'ShortText' | 'LongText' | 'Email' | 'Number' | 'Date' | 'YesNo'
  | 'SingleChoice' | 'MultipleChoice' | 'Rating' | 'Scale' | 'Matrix' | 'InfoText';
export type ConditionOperator =
  | 'Equals' | 'NotEquals' | 'Contains' | 'GreaterOrEqual' | 'LessOrEqual' | 'Answered' | 'NotAnswered';
export type ResponseSource = 'Web' | 'LegacyFeedback' | 'LegacySqlServer' | 'LegacySqlite';
export type QuestionnaireAvailability = 'Open' | 'NotPublished' | 'NotYetOpen' | 'Closed';

export interface QuestionOption { id: string; label: string }

export interface MatrixRow {
  id: string;
  label: string;
  description?: string | null;
  workshopTrackId?: string | null;
}

export interface QuestionSettings {
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  minLabel?: string | null;
  maxLabel?: string | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  allowOther?: boolean;
  otherLabel?: string | null;
  useDropdown?: boolean;
  placeholder?: string | null;
}

export interface VisibilityCondition {
  questionId: string;
  operator: ConditionOperator;
  value?: string | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  helpText?: string | null;
  required: boolean;
  options: QuestionOption[];
  rows: MatrixRow[];
  settings: QuestionSettings;
  visibleIf?: VisibilityCondition | null;
}

export interface QuestionnaireSection {
  id: string;
  title?: string | null;
  description?: string | null;
  questions: Question[];
}

export interface Questionnaire {
  questionnaireId: string;
  title: string;
  description?: string | null;
  introText?: string | null;
  thankYouText?: string | null;
  status: QuestionnaireStatus;
  respondentMode: RespondentMode;
  onePerEmail: boolean;
  onePerAccount?: boolean;
  consentText?: string | null;
  displayMode: QuestionnaireDisplayMode;
  opensAt?: string | null;
  closesAt?: string | null;
  workshopId?: string | null;
  sections: QuestionnaireSection[];
  version: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  origin: ResponseSource;
  responseCount: number;
}

export interface MatrixAnswer { rowId: string; value: number }

export interface QuestionAnswer {
  questionId: string;
  text?: string | null;
  number?: number | null;
  bool?: boolean | null;
  choices?: string[] | null;
  otherText?: string | null;
  rows?: MatrixAnswer[] | null;
}

export interface Respondent {
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  emailNormalized?: string | null;
}

export interface SubmitQuestionnaireResponseRequest {
  respondent?: Respondent | null;
  consentGiven: boolean;
  answers: QuestionAnswer[];
  website?: string | null;
}

export interface QuestionnaireResponse {
  responseId: string;
  questionnaireId: string;
  questionnaireVersion: number;
  submittedAt: string;
  respondent?: Respondent | null;
  consentGiven: boolean;
  answers: QuestionAnswer[];
  source: ResponseSource;
  sourceKey?: string | null;
}

export interface QuestionnaireValidationError {
  questionId?: string | null;
  field: string;
  message: string;
}

export interface QuestionnaireProblem {
  code: string;
  message: string;
  errors: QuestionnaireValidationError[];
}

export interface QuestionnaireSummary {
  questionnaireId: string;
  title: string;
  status: QuestionnaireStatus;
  workshopId?: string | null;
  workshopTitle?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  responseCount: number;
  updatedAt: string;
  origin: ResponseSource;
}

export interface PublicQuestionnaireView {
  questionnaireId: string;
  title: string;
  availability: QuestionnaireAvailability;
  opensAt?: string | null;
  closesAt?: string | null;
  questionnaire?: Questionnaire | null;
}

export interface CreateQuestionnaireRequest {
  template: 'blank' | 'workshopFeedback';
  title?: string | null;
  workshopId?: string | null;
}

export interface ValueCount { value: number; count: number }
export interface OptionCount { optionId: string; label: string; count: number }
export interface TextAnswer { responseId: string; submittedAt: string; text: string }

export interface MatrixRowStatistics {
  rowId: string;
  label: string;
  answeredCount: number;
  average?: number | null;
  distribution: ValueCount[];
}

export interface QuestionStatistics {
  questionId: string;
  title: string;
  type: QuestionType;
  answeredCount: number;
  average?: number | null;
  min?: number | null;
  max?: number | null;
  distribution: ValueCount[];
  options: OptionCount[];
  rows: MatrixRowStatistics[];
  textAnswers: TextAnswer[];
}

export interface QuestionnaireStatistics {
  questionnaireId: string;
  title: string;
  responseCount: number;
  firstResponseAt?: string | null;
  lastResponseAt?: string | null;
  responsesPerDay: { date: string; count: number }[];
  questions: QuestionStatistics[];
}

export type AnswerMap = Record<string, QuestionAnswer | undefined>;
