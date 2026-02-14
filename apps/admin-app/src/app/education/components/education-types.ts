"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  CreateEducationContentInput,
  CreateQuizInput,
  CreateStatutoryTrainingInput,
  QuizQuestion,
} from "@/hooks/use-api";

export type ContentFormState = {
  title: string;
  contentType: CreateEducationContentInput["contentType"];
  description: string;
  contentUrl: string;
  thumbnailUrl: string;
  durationMinutes: string;
};

export type QuizFormState = {
  title: string;
  description: string;
  status: CreateQuizInput["status"];
  pointsReward: string;
  passingScore: string;
  timeLimitMinutes: string;
};

export type QuestionFormState = {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctAnswer: string;
  explanation: string;
};

export type TrainingFormState = {
  userId: string;
  trainingType: CreateStatutoryTrainingInput["trainingType"];
  trainingName: string;
  trainingDate: string;
  expirationDate: string;
  provider: string;
  hoursCompleted: string;
  status: CreateStatutoryTrainingInput["status"];
  notes: string;
};

export type TbmFormState = {
  date: string;
  topic: string;
  content: string;
  weatherCondition: string;
  specialNotes: string;
};

export type EducationContentItem = {
  id: string;
  title: string;
  contentType: CreateEducationContentInput["contentType"];
  description?: string | null;
  createdAt: string;
};

export type QuizItem = {
  id: string;
  title: string;
  status: CreateQuizInput["status"];
  passingScore: number;
  timeLimitMinutes?: number | null;
  createdAt: string;
};

export type QuizDetail = {
  title: string;
  questions: QuizQuestion[];
};

export type TrainingItem = {
  userName?: string | null;
  training: {
    id: string;
    userId: string;
    trainingType: CreateStatutoryTrainingInput["trainingType"];
    trainingName: string;
    trainingDate: string;
    expirationDate?: string | null;
    provider?: string | null;
    hoursCompleted?: number | null;
    status: CreateStatutoryTrainingInput["status"];
    notes?: string | null;
  };
};

export type TbmRecordItem = {
  leaderName?: string | null;
  tbm: {
    id: string;
    date: string;
    topic: string;
    weatherCondition?: string | null;
  };
};

export type TbmDetail = {
  attendeeCount: number;
  attendees: Array<{
    userName?: string | null;
    attendee: {
      id: string;
      attendedAt: string;
    };
  }>;
};

export type Setter<T> = Dispatch<SetStateAction<T>>;
