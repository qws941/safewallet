"use client";

export const tabItems = [
  { id: "contents", label: "교육자료" },
  { id: "quizzes", label: "퀴즈" },
  { id: "statutory", label: "법정교육" },
  { id: "tbm", label: "TBM" },
] as const;

export type TabId = (typeof tabItems)[number]["id"];

export function getContentTypeLabel(
  type: "VIDEO" | "IMAGE" | "TEXT" | "DOCUMENT",
) {
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

export function getQuizStatusLabel(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  switch (status) {
    case "DRAFT":
      return "초안";
    case "PUBLISHED":
      return "게시";
    default:
      return "보관";
  }
}

export function getTrainingTypeLabel(
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

export function getTrainingStatusLabel(
  status: "SCHEDULED" | "COMPLETED" | "EXPIRED",
) {
  switch (status) {
    case "SCHEDULED":
      return "예정";
    case "COMPLETED":
      return "완료";
    default:
      return "만료";
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "요청 처리 중 오류가 발생했습니다.";
}
