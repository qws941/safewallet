import {
  EducationContentType,
  QuizStatus,
  StatutoryTrainingType,
  TrainingCompletionStatus,
} from "../enums";

// === Education Content ===

export interface CreateEducationContentDto {
  siteId: string;
  title: string;
  description?: string;
  contentType: EducationContentType;
  contentUrl?: string;
  contentBody?: string;
  sortOrder?: number;
}

export interface EducationContentDto {
  id: string;
  siteId: string;
  title: string;
  description: string | null;
  contentType: EducationContentType;
  contentUrl: string | null;
  contentBody: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EducationContentListDto {
  id: string;
  title: string;
  contentType: EducationContentType;
  isActive: boolean;
  quizCount: number;
  createdAt: string;
}

// === Quiz ===

export interface CreateQuizDto {
  siteId: string;
  contentId?: string;
  title: string;
  description?: string;
  passScore?: number;
  pointsReward?: number;
  timeLimitSec?: number;
  questions: CreateQuizQuestionDto[];
}

export interface CreateQuizQuestionDto {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  sortOrder?: number;
}

export interface QuizDto {
  id: string;
  siteId: string;
  contentId: string | null;
  title: string;
  description: string | null;
  status: QuizStatus;
  passScore: number;
  pointsReward: number;
  timeLimitSec: number | null;
  questions: QuizQuestionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestionDto {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  sortOrder: number;
}

export interface QuizListDto {
  id: string;
  title: string;
  status: QuizStatus;
  passScore: number;
  pointsReward: number;
  questionCount: number;
  attemptCount: number;
  createdAt: string;
}

// === Quiz Attempt ===

export interface SubmitQuizAttemptDto {
  quizId: string;
  siteId: string;
  answers: number[];
  startedAt: string;
}

export interface QuizAttemptDto {
  id: string;
  quizId: string;
  userId: string;
  siteId: string;
  score: number;
  passed: boolean;
  answers: number[];
  startedAt: string;
  completedAt: string;
  quizTitle?: string;
  userName?: string;
}

export interface QuizAttemptFilterDto {
  siteId: string;
  quizId?: string;
  userId?: string;
  passed?: boolean;
  page?: number;
  limit?: number;
}

// === Statutory Training ===

export interface CreateStatutoryTrainingDto {
  siteId: string;
  userId: string;
  trainingType: StatutoryTrainingType;
  trainingName: string;
  trainingHours: number;
  scheduledDate: string;
  expiryDate?: string;
  provider?: string;
  notes?: string;
}

export interface UpdateStatutoryTrainingDto {
  status?: TrainingCompletionStatus;
  completedDate?: string;
  certificateUrl?: string;
  notes?: string;
}

export interface StatutoryTrainingDto {
  id: string;
  siteId: string;
  userId: string;
  trainingType: StatutoryTrainingType;
  trainingName: string;
  trainingHours: number;
  scheduledDate: string;
  completedDate: string | null;
  expiryDate: string | null;
  status: TrainingCompletionStatus;
  certificateUrl: string | null;
  provider: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
  creatorName?: string;
}

export interface StatutoryTrainingFilterDto {
  siteId: string;
  trainingType?: StatutoryTrainingType;
  status?: TrainingCompletionStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

// === TBM Record ===

export interface CreateTbmRecordDto {
  siteId: string;
  tbmDate: string;
  location?: string;
  topic: string;
  content?: string;
  weatherInfo?: string;
  safetyIssues?: string;
  attendeeIds: string[];
}

export interface TbmRecordDto {
  id: string;
  siteId: string;
  conductorId: string;
  tbmDate: string;
  location: string | null;
  topic: string;
  content: string | null;
  weatherInfo: string | null;
  safetyIssues: string | null;
  attendeeCount: number;
  attendees: TbmAttendeeDto[];
  conductorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TbmAttendeeDto {
  id: string;
  userId: string;
  userName?: string;
  signedAt: string;
}

export interface TbmRecordListDto {
  id: string;
  tbmDate: string;
  topic: string;
  location: string | null;
  conductorName: string | null;
  attendeeCount: number;
  createdAt: string;
}

export interface TbmRecordFilterDto {
  siteId: string;
  fromDate?: string;
  toDate?: string;
  conductorId?: string;
  page?: number;
  limit?: number;
}
