"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import {
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
} from "@safetywallet/ui";
import type { CreateQuizInput } from "@/hooks/use-api";
import { getQuizStatusLabel } from "../education-helpers";
import type {
  QuestionFormState,
  QuizDetail,
  QuizFormState,
  QuizItem,
  Setter,
} from "./education-types";

type QuizzesTabProps = {
  currentSiteId: string | null;
  quizForm: QuizFormState;
  setQuizForm: Setter<QuizFormState>;
  onCreateQuiz: () => void;
  createQuizPending: boolean;
  isQuizzesLoading: boolean;
  quizzes: QuizItem[];
  expandedQuizId: string | null;
  setExpandedQuizId: Setter<string | null>;
  resetQuestionForm: () => void;
  quizDetail?: QuizDetail;
  questionForm: QuestionFormState;
  setQuestionForm: Setter<QuestionFormState>;
  onSubmitQuestion: () => void;
  editingQuestionId: string | null;
  fillQuestionForm: (question: QuizDetail["questions"][number]) => void;
  onDeleteQuestion: (questionId: string) => void;
  sortedQuizQuestions: QuizDetail["questions"];
};

export function QuizzesTab({
  currentSiteId,
  quizForm,
  setQuizForm,
  onCreateQuiz,
  createQuizPending,
  isQuizzesLoading,
  quizzes,
  expandedQuizId,
  setExpandedQuizId,
  resetQuestionForm,
  quizDetail,
  questionForm,
  setQuestionForm,
  onSubmitQuestion,
  editingQuestionId,
  fillQuestionForm,
  onDeleteQuestion,
  sortedQuizQuestions,
}: QuizzesTabProps) {
  return (
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
            disabled={!currentSiteId || !quizForm.title || createQuizPending}
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
                              {getQuizStatusLabel(quiz.status ?? "DRAFT")}
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
                                setExpandedQuizId(isExpanded ? null : quiz.id);
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
  );
}
