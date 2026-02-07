"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

const tabItems = [
  { id: "contents", label: "교육자료" },
  { id: "quizzes", label: "퀴즈" },
  { id: "statutory", label: "법정교육" },
  { id: "tbm", label: "TBM" },
] as const;

type TabId = (typeof tabItems)[number]["id"];

function getContentTypeLabel(type: "VIDEO" | "IMAGE" | "TEXT" | "DOCUMENT") {
  switch (type) {
    case "VIDEO":
      return "동영상";
    case "IMAGE":
      return "이미지";
    case "TEXT":
      return "텍스트";
    default:
      return "문서";
  }
}

function getQuizStatusLabel(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  switch (status) {
    case "DRAFT":
      return "초안";
    case "PUBLISHED":
      return "게시";
    default:
      return "보관";
  }
}

function getTrainingTypeLabel(
  type: "NEW_WORKER" | "SPECIAL" | "REGULAR" | "CHANGE_OF_WORK",
) {
  switch (type) {
    case "NEW_WORKER":
      return "신규채용";
    case "SPECIAL":
      return "특별교육";
    case "REGULAR":
      return "정기교육";
    default:
      return "작업변경";
  }
}

function getTrainingStatusLabel(status: "SCHEDULED" | "COMPLETED" | "EXPIRED") {
  switch (status) {
    case "SCHEDULED":
      return "예정";
    case "COMPLETED":
      return "완료";
    default:
      return "만료";
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "요청 처리 중 오류가 발생했습니다.";
}

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

  const contents = contentsData?.contents ?? [];
  const quizzes = quizzesData?.quizzes ?? [];
  const trainings = trainingsData?.trainings ?? [];
  const tbmRecords = tbmData?.records ?? [];

  const sortedQuizQuestions = useMemo(() => {
    if (!quizDetail?.questions) return [];
    return [...quizDetail.questions].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
  }, [quizDetail?.questions]);

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

  const onEditTraining = (
    item: NonNullable<typeof trainingsData>["trainings"][number],
  ) => {
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
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>교육자료 등록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="제목"
                  value={contentForm.title}
                  onChange={(e) =>
                    setContentForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                />
                <Select
                  value={contentForm.contentType}
                  onValueChange={(value) =>
                    setContentForm((prev) => ({
                      ...prev,
                      contentType:
                        value as CreateEducationContentInput["contentType"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIDEO">동영상</SelectItem>
                    <SelectItem value="IMAGE">이미지</SelectItem>
                    <SelectItem value="TEXT">텍스트</SelectItem>
                    <SelectItem value="DOCUMENT">문서</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="설명"
                value={contentForm.description}
                onChange={(e) =>
                  setContentForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="콘텐츠 URL"
                  value={contentForm.contentUrl}
                  onChange={(e) =>
                    setContentForm((prev) => ({
                      ...prev,
                      contentUrl: e.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="썸네일 URL"
                  value={contentForm.thumbnailUrl}
                  onChange={(e) =>
                    setContentForm((prev) => ({
                      ...prev,
                      thumbnailUrl: e.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="재생 시간(분)"
                  value={contentForm.durationMinutes}
                  onChange={(e) =>
                    setContentForm((prev) => ({
                      ...prev,
                      durationMinutes: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                type="button"
                onClick={onCreateContent}
                disabled={
                  !currentSiteId ||
                  !contentForm.title ||
                  createContentMutation.isPending
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                교육자료 등록
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>교육자료 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {isContentsLoading ? (
                <p className="text-sm text-muted-foreground">로딩 중...</p>
              ) : contents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  등록된 교육자료가 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2">제목</th>
                        <th className="px-2 py-2">유형</th>
                        <th className="px-2 py-2">설명</th>
                        <th className="px-2 py-2">등록일</th>
                        <th className="px-2 py-2">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contents.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="px-2 py-2 font-medium">
                            {item.title}
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant="outline">
                              {getContentTypeLabel(item.contentType)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {item.description || "-"}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString(
                              "ko-KR",
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteContentId(item.id)}
                              disabled={deleteContentMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "quizzes" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>퀴즈 등록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="퀴즈 제목"
                value={quizForm.title}
                onChange={(e) =>
                  setQuizForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
              <textarea
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="설명"
                value={quizForm.description}
                onChange={(e) =>
                  setQuizForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <div className="grid gap-3 md:grid-cols-4">
                <Select
                  value={quizForm.status}
                  onValueChange={(value) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      status: value as CreateQuizInput["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">초안</SelectItem>
                    <SelectItem value="PUBLISHED">게시</SelectItem>
                    <SelectItem value="ARCHIVED">보관</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="보상 포인트"
                  value={quizForm.pointsReward}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      pointsReward: e.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="통과 점수"
                  value={quizForm.passingScore}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      passingScore: e.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="제한 시간(분)"
                  value={quizForm.timeLimitMinutes}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      timeLimitMinutes: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                type="button"
                onClick={onCreateQuiz}
                disabled={
                  !currentSiteId ||
                  !quizForm.title ||
                  createQuizMutation.isPending
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                퀴즈 등록
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>퀴즈 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {isQuizzesLoading ? (
                <p className="text-sm text-muted-foreground">로딩 중...</p>
              ) : quizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  등록된 퀴즈가 없습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">제목</th>
                          <th className="px-2 py-2">상태</th>
                          <th className="px-2 py-2">통과점수</th>
                          <th className="px-2 py-2">제한시간</th>
                          <th className="px-2 py-2">등록일</th>
                          <th className="px-2 py-2">문항</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((quiz) => {
                          const isExpanded = expandedQuizId === quiz.id;
                          return (
                            <tr key={quiz.id} className="border-b">
                              <td className="px-2 py-2 font-medium">
                                {quiz.title}
                              </td>
                              <td className="px-2 py-2">
                                <Badge variant="secondary">
                                  {getQuizStatusLabel(quiz.status)}
                                </Badge>
                              </td>
                              <td className="px-2 py-2">{quiz.passingScore}</td>
                              <td className="px-2 py-2">
                                {quiz.timeLimitMinutes
                                  ? `${quiz.timeLimitMinutes}분`
                                  : "-"}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">
                                {new Date(quiz.createdAt).toLocaleDateString(
                                  "ko-KR",
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setExpandedQuizId(
                                      isExpanded ? null : quiz.id,
                                    );
                                    resetQuestionForm();
                                  }}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="mr-1 h-4 w-4" />
                                      접기
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="mr-1 h-4 w-4" />
                                      문항 관리
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {expandedQuizId && quizDetail && (
                    <Card className="border-dashed">
                      <CardHeader>
                        <CardTitle className="text-base">
                          문항 관리 - {quizDetail.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <textarea
                          className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="문항"
                          value={questionForm.question}
                          onChange={(e) =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              question: e.target.value,
                            }))
                          }
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                          {["option1", "option2", "option3", "option4"].map(
                            (key, idx) => (
                              <Input
                                key={key}
                                placeholder={`선택지 ${idx + 1}`}
                                value={
                                  questionForm[
                                    key as keyof typeof questionForm
                                  ] as string
                                }
                                onChange={(e) =>
                                  setQuestionForm((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            ),
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Select
                            value={questionForm.correctAnswer}
                            onValueChange={(value) =>
                              setQuestionForm((prev) => ({
                                ...prev,
                                correctAnswer: value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="정답 번호" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">1번</SelectItem>
                              <SelectItem value="1">2번</SelectItem>
                              <SelectItem value="2">3번</SelectItem>
                              <SelectItem value="3">4번</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="해설"
                            value={questionForm.explanation}
                            onChange={(e) =>
                              setQuestionForm((prev) => ({
                                ...prev,
                                explanation: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" onClick={onSubmitQuestion}>
                            {editingQuestionId ? "문항 수정" : "문항 추가"}
                          </Button>
                          {editingQuestionId && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={resetQuestionForm}
                            >
                              취소
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {sortedQuizQuestions.map((item, idx) => (
                            <div
                              key={item.id}
                              className="rounded-md border p-3 text-sm"
                            >
                              <div className="mb-1 font-medium">
                                {idx + 1}. {item.question}
                              </div>
                              <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
                                {item.options.map((opt, optionIdx) => (
                                  <li
                                    key={`${item.id}-${optionIdx}`}
                                    className={
                                      optionIdx === item.correctAnswer
                                        ? "font-semibold text-foreground"
                                        : ""
                                    }
                                  >
                                    {opt}
                                  </li>
                                ))}
                              </ol>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => fillQuestionForm(item)}
                                >
                                  수정
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => onDeleteQuestion(item.id)}
                                >
                                  삭제
                                </Button>
                              </div>
                            </div>
                          ))}
                          {sortedQuizQuestions.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              등록된 문항이 없습니다.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "statutory" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {editingTrainingId ? "법정교육 수정" : "법정교육 등록"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="대상자 사용자 ID"
                  value={trainingForm.userId}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      userId: e.target.value,
                    }))
                  }
                  disabled={!!editingTrainingId}
                />
                <Select
                  value={trainingForm.trainingType}
                  onValueChange={(value) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      trainingType:
                        value as CreateStatutoryTrainingInput["trainingType"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="교육 유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_WORKER">신규채용</SelectItem>
                    <SelectItem value="SPECIAL">특별교육</SelectItem>
                    <SelectItem value="REGULAR">정기교육</SelectItem>
                    <SelectItem value="CHANGE_OF_WORK">작업변경</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="교육명"
                value={trainingForm.trainingName}
                onChange={(e) =>
                  setTrainingForm((prev) => ({
                    ...prev,
                    trainingName: e.target.value,
                  }))
                }
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  type="date"
                  value={trainingForm.trainingDate}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      trainingDate: e.target.value,
                    }))
                  }
                />
                <Input
                  type="date"
                  value={trainingForm.expirationDate}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      expirationDate: e.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="이수시간"
                  value={trainingForm.hoursCompleted}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      hoursCompleted: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="교육기관"
                  value={trainingForm.provider}
                  onChange={(e) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      provider: e.target.value,
                    }))
                  }
                />
                <Select
                  value={trainingForm.status}
                  onValueChange={(value) =>
                    setTrainingForm((prev) => ({
                      ...prev,
                      status: value as CreateStatutoryTrainingInput["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">예정</SelectItem>
                    <SelectItem value="COMPLETED">완료</SelectItem>
                    <SelectItem value="EXPIRED">만료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="비고"
                value={trainingForm.notes}
                onChange={(e) =>
                  setTrainingForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
              <div className="flex gap-2">
                <Button type="button" onClick={onSubmitTraining}>
                  {editingTrainingId ? "수정 저장" : "법정교육 등록"}
                </Button>
                {editingTrainingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
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
                    }}
                  >
                    취소
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>법정교육 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {isTrainingsLoading ? (
                <p className="text-sm text-muted-foreground">로딩 중...</p>
              ) : trainings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  등록된 법정교육이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2">교육명</th>
                        <th className="px-2 py-2">교육유형</th>
                        <th className="px-2 py-2">대상자</th>
                        <th className="px-2 py-2">교육일</th>
                        <th className="px-2 py-2">상태</th>
                        <th className="px-2 py-2">유효기간</th>
                        <th className="px-2 py-2">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainings.map((item) => (
                        <tr key={item.training.id} className="border-b">
                          <td className="px-2 py-2 font-medium">
                            {item.training.trainingName}
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant="outline">
                              {getTrainingTypeLabel(item.training.trainingType)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">{item.userName || "-"}</td>
                          <td className="px-2 py-2">
                            {item.training.trainingDate}
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant="secondary">
                              {getTrainingStatusLabel(item.training.status)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            {item.training.expirationDate || "-"}
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onEditTraining(item)}
                            >
                              수정
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "tbm" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>TBM 등록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  type="date"
                  value={tbmForm.date}
                  onChange={(e) =>
                    setTbmForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
                <Input
                  placeholder="주제"
                  value={tbmForm.topic}
                  onChange={(e) =>
                    setTbmForm((prev) => ({ ...prev, topic: e.target.value }))
                  }
                />
              </div>
              <textarea
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="내용"
                value={tbmForm.content}
                onChange={(e) =>
                  setTbmForm((prev) => ({ ...prev, content: e.target.value }))
                }
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="날씨"
                  value={tbmForm.weatherCondition}
                  onChange={(e) =>
                    setTbmForm((prev) => ({
                      ...prev,
                      weatherCondition: e.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="특이사항"
                  value={tbmForm.specialNotes}
                  onChange={(e) =>
                    setTbmForm((prev) => ({
                      ...prev,
                      specialNotes: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                type="button"
                onClick={onCreateTbm}
                disabled={!currentSiteId || !tbmForm.date || !tbmForm.topic}
              >
                <Plus className="mr-2 h-4 w-4" />
                TBM 등록
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>TBM 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {isTbmLoading ? (
                <p className="text-sm text-muted-foreground">로딩 중...</p>
              ) : tbmRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  등록된 TBM이 없습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">일자</th>
                          <th className="px-2 py-2">주제</th>
                          <th className="px-2 py-2">인솔자</th>
                          <th className="px-2 py-2">참석자수</th>
                          <th className="px-2 py-2">날씨</th>
                          <th className="px-2 py-2">상세</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tbmRecords.map((item) => {
                          const isExpanded = expandedTbmId === item.tbm.id;
                          return (
                            <tr key={item.tbm.id} className="border-b">
                              <td className="px-2 py-2">{item.tbm.date}</td>
                              <td className="px-2 py-2 font-medium">
                                {item.tbm.topic}
                              </td>
                              <td className="px-2 py-2">
                                {item.leaderName || "-"}
                              </td>
                              <td className="px-2 py-2">-</td>
                              <td className="px-2 py-2">
                                {item.tbm.weatherCondition || "-"}
                              </td>
                              <td className="px-2 py-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setExpandedTbmId(
                                      isExpanded ? null : item.tbm.id,
                                    )
                                  }
                                >
                                  {isExpanded ? "접기" : "참석자 보기"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {expandedTbmId && tbmDetail && (
                    <Card className="border-dashed">
                      <CardHeader>
                        <CardTitle className="text-base">
                          참석자 목록 ({tbmDetail.attendeeCount}명)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {tbmDetail.attendees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            참석자가 없습니다.
                          </p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {tbmDetail.attendees.map((attendee) => (
                              <li
                                key={attendee.attendee.id}
                                className="flex items-center justify-between rounded-md border px-3 py-2"
                              >
                                <span>{attendee.userName || "이름 없음"}</span>
                                <span className="text-muted-foreground">
                                  {new Date(
                                    attendee.attendee.attendedAt,
                                  ).toLocaleString("ko-KR")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
