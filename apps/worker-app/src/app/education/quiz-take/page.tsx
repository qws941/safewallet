"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useQuiz,
  useSubmitQuizAttempt,
  useMyQuizAttempts,
} from "@/hooks/use-api";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Button,
  useToast,
} from "@safetywallet/ui";
import { AlertCircle, CheckCircle2, Clock, RotateCcw } from "lucide-react";

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />
      <main className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
      <BottomNav />
    </div>
  );
}

function QuizTakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("id") || "";
  const { data: quiz, isLoading: isQuizLoading } = useQuiz(quizId);
  const { data: attempts, isLoading: isAttemptsLoading } =
    useMyQuizAttempts(quizId);
  const { mutate: submitAttempt, isPending: isSubmitting } =
    useSubmitQuizAttempt();
  const { toast } = useToast();

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);

  // If already passed, show result state by default
  useEffect(() => {
    if (attempts && attempts.length > 0) {
      const passedAttempt = attempts.find((a) => a.passed);
      if (passedAttempt) {
        setShowResult(true);
        setLastResult({ score: passedAttempt.score, passed: true });
      }
    }
  }, [attempts]);

  if (isQuizLoading || isAttemptsLoading) {
    return <LoadingState />;
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4 text-center py-12">
          <p className="text-4xl mb-4">❌</p>
          <p className="text-muted-foreground">퀴즈를 찾을 수 없습니다.</p>
          <Button className="mt-4" onClick={() => router.back()}>
            돌아가기
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < quiz.questions.length) {
      toast({
        title: "모든 문제를 풀어주세요.",
        variant: "destructive",
      });
      return;
    }

    submitAttempt(
      { quizId, answers },
      {
        onSuccess: (data) => {
          setLastResult({
            score: data.attempt.score,
            passed: data.attempt.passed,
          });
          setShowResult(true);
          toast({
            title: data.attempt.passed
              ? "축하합니다! 합격입니다."
              : "불합격입니다.",
            description: `점수: ${data.attempt.score}점`,
            variant: data.attempt.passed ? "default" : "destructive",
          });
        },
        onError: () => {
          toast({
            title: "제출에 실패했습니다.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResult(false);
    setLastResult(null);
  };

  if (showResult && lastResult) {
    return (
      <div className="min-h-screen bg-gray-50 pb-nav">
        <Header />
        <main className="p-4 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="text-6xl mb-2">{lastResult.passed ? "🎉" : "😢"}</div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">
              {lastResult.passed ? "합격입니다!" : "아쉽게도 불합격입니다."}
            </h2>
            <p className="text-muted-foreground">
              점수:{" "}
              <span className="font-bold text-primary text-xl">
                {lastResult.score}
              </span>
              점 (합격기준: {quiz.passingScore}점)
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            {!lastResult.passed && (
              <Button className="w-full gap-2" size="lg" onClick={resetQuiz}>
                <RotateCcw className="w-4 h-4" />
                다시 풀기
              </Button>
            )}
            <Button
              className="w-full"
              variant={lastResult.passed ? "default" : "outline"}
              onClick={() => router.push("/education")}
            >
              목록으로 돌아가기
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4 space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">{quiz.title}</h1>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              합격 {quiz.passingScore}점
            </Badge>
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              최대 {quiz.maxAttempts}회
            </Badge>
            {quiz.timeLimitMinutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {quiz.timeLimitMinutes}분
              </Badge>
            )}
          </div>
          {quiz.description && (
            <p className="text-sm text-gray-600">{quiz.description}</p>
          )}
        </div>

        <div className="space-y-6">
          {quiz.questions.map((q, idx) => {
            const options =
              typeof q.options === "string" ? JSON.parse(q.options) : q.options;

            return (
              <Card key={q.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex gap-2">
                    <span className="text-primary">Q{idx + 1}.</span>
                    {q.question}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.isArray(options) &&
                    options.map((option: string, optIdx: number) => (
                      <label
                        key={optIdx}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          answers[q.id] === optIdx
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            answers[q.id] === optIdx
                              ? "border-primary"
                              : "border-gray-400"
                          }`}
                        >
                          {answers[q.id] === optIdx && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="text-sm">{option}</span>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          className="hidden"
                          checked={answers[q.id] === optIdx}
                          onChange={() => handleAnswerSelect(q.id, optIdx)}
                        />
                      </label>
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button
          className="w-full py-6 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "제출 중..." : "제출하기"}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

export default function QuizTakePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <QuizTakeContent />
    </Suspense>
  );
}
