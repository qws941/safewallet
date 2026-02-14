"use client";

import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  useToast,
} from "@safetywallet/ui";
import {
  useCreateEducationContent,
  useCreateQuiz,
  useCreateQuizQuestion,
  useCreateStatutoryTraining,
  useCreateTbmRecord,
  useDeleteEducationContent,
  useDeleteQuizQuestion,
  useEducationContents,
  useQuiz,
  useQuizzes,
  useStatutoryTrainings,
  useTbmRecord,
  useTbmRecords,
  useUpdateQuizQuestion,
  useUpdateStatutoryTraining,
  type CreateEducationContentInput,
  type CreateQuizQuestionInput,
  type CreateQuizInput,
  type CreateStatutoryTrainingInput,
  type CreateTbmRecordInput,
  type QuizQuestion,
  type UpdateStatutoryTrainingInput,
} from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";
import { ContentsTab } from "./components/contents-tab";
import type {
  EducationContentItem,
  QuizDetail,
  QuizItem,
  TbmDetail,
  TbmRecordItem,
  TrainingItem,
} from "./components/education-types";
import { QuizzesTab } from "./components/quizzes-tab";
import { StatutoryTab } from "./components/statutory-tab";
import { TbmTab } from "./components/tbm-tab";
import { getErrorMessage, tabItems, type TabId } from "./education-helpers";

export default function EducationPage() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("contents");

  const [contentForm, setContentForm] = useState({
    title: "",
    contentType: "VIDEO" as CreateEducationContentInput["contentType"],
    description: "",
    contentUrl: "",
    thumbnailUrl: "",
    durationMinutes: "",
  });
  const [deleteContentId, setDeleteContentId] = useState<string | null>(null);

  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    status: "DRAFT" as CreateQuizInput["status"],
    pointsReward: "0",
    passingScore: "70",
    timeLimitMinutes: "",
  });
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [questionForm, setQuestionForm] = useState({
    question: "",
    option1: "",
    option2: "",
    option3: "",
    option4: "",
    correctAnswer: "0",
    explanation: "",
  });

  const [trainingForm, setTrainingForm] = useState({
    userId: "",
    trainingType: "NEW_WORKER" as CreateStatutoryTrainingInput["trainingType"],
    trainingName: "",
    trainingDate: "",
    expirationDate: "",
    provider: "",
    hoursCompleted: "0",
    status: "SCHEDULED" as CreateStatutoryTrainingInput["status"],
    notes: "",
  });
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(
    null,
  );

  const [tbmForm, setTbmForm] = useState({
    date: "",
    topic: "",
    content: "",
    weatherCondition: "",
    specialNotes: "",
  });
  const [expandedTbmId, setExpandedTbmId] = useState<string | null>(null);

  const { data: contentsData, isLoading: isContentsLoading } =
    useEducationContents();
  const { data: quizzesData, isLoading: isQuizzesLoading } = useQuizzes();
  const { data: quizDetail } = useQuiz(expandedQuizId || "");
  const { data: trainingsData, isLoading: isTrainingsLoading } =
    useStatutoryTrainings();
  const { data: tbmData, isLoading: isTbmLoading } = useTbmRecords();
  const { data: tbmDetail } = useTbmRecord(expandedTbmId || "");

  const createContentMutation = useCreateEducationContent();
  const deleteContentMutation = useDeleteEducationContent();
  const createQuizMutation = useCreateQuiz();
  const createQuestionMutation = useCreateQuizQuestion();
  const updateQuestionMutation = useUpdateQuizQuestion();
  const deleteQuestionMutation = useDeleteQuizQuestion();
  const createTrainingMutation = useCreateStatutoryTraining();
  const updateTrainingMutation = useUpdateStatutoryTraining();
  const createTbmMutation = useCreateTbmRecord();

  const contents: EducationContentItem[] = contentsData?.contents ?? [];
  const quizzes: QuizItem[] = quizzesData?.quizzes ?? [];
  const trainings: TrainingItem[] = trainingsData?.trainings ?? [];
  const tbmRecords: TbmRecordItem[] = tbmData?.records ?? [];
  const typedQuizDetail: QuizDetail | undefined = quizDetail;
  const typedTbmDetail: TbmDetail | undefined = tbmDetail;

  const sortedQuizQuestions = useMemo(() => {
    if (!typedQuizDetail?.questions) return [];
    return [...typedQuizDetail.questions].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
  }, [typedQuizDetail?.questions]);

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionForm({
      question: "",
      option1: "",
      option2: "",
      option3: "",
      option4: "",
      correctAnswer: "0",
      explanation: "",
    });
  };

  const onCreateContent = async () => {
    if (!currentSiteId || !contentForm.title) return;

    try {
      await createContentMutation.mutateAsync({
        siteId: currentSiteId,
        title: contentForm.title,
        contentType: contentForm.contentType,
        description: contentForm.description || undefined,
        contentUrl: contentForm.contentUrl || undefined,
        thumbnailUrl: contentForm.thumbnailUrl || undefined,
        durationMinutes: contentForm.durationMinutes
          ? Number(contentForm.durationMinutes)
          : undefined,
      });
      toast({ description: "교육자료가 등록되었습니다." });
      setContentForm({
        title: "",
        contentType: "VIDEO",
        description: "",
        contentUrl: "",
        thumbnailUrl: "",
        durationMinutes: "",
      });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const onDeleteContent = async () => {
    if (!deleteContentId) return;
    try {
      await deleteContentMutation.mutateAsync(deleteContentId);
      toast({ description: "교육자료가 삭제되었습니다." });
      setDeleteContentId(null);
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
      setDeleteContentId(null);
    }
  };

  const onCreateQuiz = async () => {
    if (!currentSiteId || !quizForm.title) return;

    try {
      await createQuizMutation.mutateAsync({
        siteId: currentSiteId,
        title: quizForm.title,
        description: quizForm.description || undefined,
        status: quizForm.status,
        pointsReward: Number(quizForm.pointsReward || 0),
        passingScore: Number(quizForm.passingScore || 70),
        timeLimitMinutes: quizForm.timeLimitMinutes
          ? Number(quizForm.timeLimitMinutes)
          : undefined,
      });
      toast({ description: "퀴즈가 등록되었습니다." });
      setQuizForm({
        title: "",
        description: "",
        status: "DRAFT",
        pointsReward: "0",
        passingScore: "70",
        timeLimitMinutes: "",
      });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const fillQuestionForm = (question: QuizQuestion) => {
    setEditingQuestionId(question.id);
    setQuestionForm({
      question: question.question,
      option1: question.options[0] || "",
      option2: question.options[1] || "",
      option3: question.options[2] || "",
      option4: question.options[3] || "",
      correctAnswer: String(question.correctAnswer),
      explanation: question.explanation || "",
    });
  };

  const onSubmitQuestion = async () => {
    if (!expandedQuizId || !questionForm.question) return;

    const options = [
      questionForm.option1,
      questionForm.option2,
      questionForm.option3,
      questionForm.option4,
    ].filter((v) => v.trim().length > 0);

    if (options.length < 2) {
      toast({
        variant: "destructive",
        description: "선택지는 최소 2개 이상 입력해야 합니다.",
      });
      return;
    }

    const payload: CreateQuizQuestionInput = {
      question: questionForm.question,
      options,
      correctAnswer: Number(questionForm.correctAnswer),
      explanation: questionForm.explanation || undefined,
      orderIndex: sortedQuizQuestions.length,
    };

    try {
      if (editingQuestionId) {
        await updateQuestionMutation.mutateAsync({
          quizId: expandedQuizId,
          questionId: editingQuestionId,
          data: payload,
        });
        toast({ description: "문항이 수정되었습니다." });
      } else {
        await createQuestionMutation.mutateAsync({
          quizId: expandedQuizId,
          data: payload,
        });
        toast({ description: "문항이 등록되었습니다." });
      }
      resetQuestionForm();
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const onDeleteQuestion = async (questionId: string) => {
    if (!expandedQuizId) return;
    try {
      await deleteQuestionMutation.mutateAsync({
        quizId: expandedQuizId,
        questionId,
      });
      toast({ description: "문항이 삭제되었습니다." });
      if (editingQuestionId === questionId) {
        resetQuestionForm();
      }
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const onSubmitTraining = async () => {
    if (!currentSiteId || !trainingForm.userId || !trainingForm.trainingName)
      return;
    if (!trainingForm.trainingDate) return;

    const payload: CreateStatutoryTrainingInput = {
      siteId: currentSiteId,
      userId: trainingForm.userId,
      trainingType: trainingForm.trainingType,
      trainingName: trainingForm.trainingName,
      trainingDate: trainingForm.trainingDate,
      expirationDate: trainingForm.expirationDate || undefined,
      provider: trainingForm.provider || undefined,
      hoursCompleted: Number(trainingForm.hoursCompleted || 0),
      status: trainingForm.status,
      notes: trainingForm.notes || undefined,
    };

    try {
      if (editingTrainingId) {
        const updatePayload: UpdateStatutoryTrainingInput = {
          trainingType: payload.trainingType,
          trainingName: payload.trainingName,
          trainingDate: payload.trainingDate,
          expirationDate: payload.expirationDate,
          provider: payload.provider,
          hoursCompleted: payload.hoursCompleted,
          status: payload.status,
          notes: payload.notes,
        };
        await updateTrainingMutation.mutateAsync({
          id: editingTrainingId,
          data: updatePayload,
        });
        toast({ description: "법정교육이 수정되었습니다." });
      } else {
        await createTrainingMutation.mutateAsync(payload);
        toast({ description: "법정교육이 등록되었습니다." });
      }

      setEditingTrainingId(null);
      setTrainingForm({
        userId: "",
        trainingType: "NEW_WORKER",
        trainingName: "",
        trainingDate: "",
        expirationDate: "",
        provider: "",
        hoursCompleted: "0",
        status: "SCHEDULED",
        notes: "",
      });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const onEditTraining = (item: TrainingItem) => {
    setEditingTrainingId(item.training.id);
    setTrainingForm({
      userId: item.training.userId,
      trainingType: item.training.trainingType,
      trainingName: item.training.trainingName,
      trainingDate: item.training.trainingDate,
      expirationDate: item.training.expirationDate || "",
      provider: item.training.provider || "",
      hoursCompleted: String(item.training.hoursCompleted ?? 0),
      status: item.training.status,
      notes: item.training.notes || "",
    });
  };

  const onCreateTbm = async () => {
    if (!currentSiteId || !tbmForm.date || !tbmForm.topic) return;

    const payload: CreateTbmRecordInput = {
      siteId: currentSiteId,
      date: tbmForm.date,
      topic: tbmForm.topic,
      content: tbmForm.content || undefined,
      weatherCondition: tbmForm.weatherCondition || undefined,
      specialNotes: tbmForm.specialNotes || undefined,
    };

    try {
      await createTbmMutation.mutateAsync(payload);
      toast({ description: "TBM 기록이 등록되었습니다." });
      setTbmForm({
        date: "",
        topic: "",
        content: "",
        weatherCondition: "",
        specialNotes: "",
      });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">교육 관리</h1>
        <p className="text-sm text-muted-foreground">
          교육자료, 퀴즈, 법정교육, TBM을 한 곳에서 관리합니다.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {tabItems.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeTab === tab.id ? "default" : "outline"}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeTab === "contents" && (
        <ContentsTab
          currentSiteId={currentSiteId}
          contentForm={contentForm}
          setContentForm={setContentForm}
          onCreateContent={onCreateContent}
          createContentPending={createContentMutation.isPending}
          isContentsLoading={isContentsLoading}
          contents={contents}
          setDeleteContentId={setDeleteContentId}
          deleteContentPending={deleteContentMutation.isPending}
        />
      )}

      {activeTab === "quizzes" && (
        <QuizzesTab
          currentSiteId={currentSiteId}
          quizForm={quizForm}
          setQuizForm={setQuizForm}
          onCreateQuiz={onCreateQuiz}
          createQuizPending={createQuizMutation.isPending}
          isQuizzesLoading={isQuizzesLoading}
          quizzes={quizzes}
          expandedQuizId={expandedQuizId}
          setExpandedQuizId={setExpandedQuizId}
          resetQuestionForm={resetQuestionForm}
          quizDetail={typedQuizDetail}
          questionForm={questionForm}
          setQuestionForm={setQuestionForm}
          onSubmitQuestion={onSubmitQuestion}
          editingQuestionId={editingQuestionId}
          fillQuestionForm={fillQuestionForm}
          onDeleteQuestion={onDeleteQuestion}
          sortedQuizQuestions={sortedQuizQuestions}
        />
      )}

      {activeTab === "statutory" && (
        <StatutoryTab
          editingTrainingId={editingTrainingId}
          setEditingTrainingId={setEditingTrainingId}
          trainingForm={trainingForm}
          setTrainingForm={setTrainingForm}
          onSubmitTraining={onSubmitTraining}
          isTrainingsLoading={isTrainingsLoading}
          trainings={trainings}
          onEditTraining={onEditTraining}
        />
      )}

      {activeTab === "tbm" && (
        <TbmTab
          currentSiteId={currentSiteId}
          tbmForm={tbmForm}
          setTbmForm={setTbmForm}
          onCreateTbm={onCreateTbm}
          isTbmLoading={isTbmLoading}
          tbmRecords={tbmRecords}
          expandedTbmId={expandedTbmId}
          setExpandedTbmId={setExpandedTbmId}
          tbmDetail={typedTbmDetail}
        />
      )}

      <AlertDialog
        open={!!deleteContentId}
        onOpenChange={(open) => !open && setDeleteContentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>교육자료 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 교육자료를 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteContent}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
