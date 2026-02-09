// Review status values (matches schema reviewStatusEnum)
type ReviewStatus =
  | "RECEIVED"
  | "IN_REVIEW"
  | "NEED_INFO"
  | "APPROVED"
  | "REJECTED";

// Action status values (matches schema actionStatusEnum)
type ActionStatus =
  | "NONE"
  | "REQUIRED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DONE"
  | "REOPENED";

// Review action values (matches schema reviewActionEnum)
type ReviewAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_MORE"
  | "MARK_URGENT"
  | "ASSIGN"
  | "CLOSE";

// User role values (matches schema userRoleEnum)
type UserRole = "WORKER" | "SITE_ADMIN" | "SUPER_ADMIN" | "SYSTEM";

export interface TransitionResult {
  valid: boolean;
  newReviewStatus?: ReviewStatus;
  newActionStatus?: ActionStatus;
  error?: string;
}

const REVIEW_TRANSITIONS: Record<ReviewAction, readonly ReviewStatus[]> = {
  APPROVE: ["RECEIVED", "IN_REVIEW", "NEED_INFO"],
  REJECT: ["RECEIVED", "IN_REVIEW", "NEED_INFO"],
  REQUEST_MORE: ["RECEIVED", "IN_REVIEW"],
  MARK_URGENT: ["RECEIVED", "IN_REVIEW", "NEED_INFO"],
  ASSIGN: ["RECEIVED", "IN_REVIEW", "APPROVED"],
  CLOSE: ["IN_REVIEW", "APPROVED"],
};

type ActionTransitionType = "ASSIGN" | "START" | "COMPLETE" | "REOPEN";

const ACTION_TRANSITIONS: Record<
  ActionTransitionType,
  readonly ActionStatus[]
> = {
  ASSIGN: ["NONE", "REQUIRED", "REOPENED"],
  START: ["ASSIGNED", "REOPENED"],
  COMPLETE: ["IN_PROGRESS"],
  REOPEN: ["DONE"],
};

const ADMIN_ONLY_ACTIONS: readonly ReviewAction[] = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
];

export function validateReviewTransition(
  action: ReviewAction,
  currentReviewStatus: ReviewStatus,
  currentActionStatus: ActionStatus,
  userRole: UserRole,
): TransitionResult {
  if (ADMIN_ONLY_ACTIONS.includes(action) && userRole === "WORKER") {
    return {
      valid: false,
      error: `권한이 없습니다. 관리자만 ${action} 액션을 수행할 수 있습니다`,
    };
  }

  const allowedFrom = REVIEW_TRANSITIONS[action];
  if (!allowedFrom) {
    return { valid: false, error: `알 수 없는 액션: ${action}` };
  }

  if (!allowedFrom.includes(currentReviewStatus)) {
    return {
      valid: false,
      error: `현재 상태(${currentReviewStatus})에서 ${action} 액션을 수행할 수 없습니다`,
    };
  }

  const result = determineNewStatuses(action, currentActionStatus);

  return {
    valid: true,
    newReviewStatus: result.newReviewStatus,
    newActionStatus: result.newActionStatus,
  };
}

export function validateActionTransition(
  actionType: ActionTransitionType,
  currentActionStatus: ActionStatus,
): TransitionResult {
  const allowedFrom = ACTION_TRANSITIONS[actionType];
  if (!allowedFrom) {
    return { valid: false, error: `알 수 없는 액션 타입: ${actionType}` };
  }

  if (!allowedFrom.includes(currentActionStatus)) {
    return {
      valid: false,
      error: `현재 상태(${currentActionStatus})에서 ${actionType}을(를) 수행할 수 없습니다`,
    };
  }

  const statusMap: Record<ActionTransitionType, ActionStatus> = {
    ASSIGN: "ASSIGNED",
    START: "IN_PROGRESS",
    COMPLETE: "DONE",
    REOPEN: "REOPENED",
  };

  return {
    valid: true,
    newActionStatus: statusMap[actionType],
  };
}

function determineNewStatuses(
  action: ReviewAction,
  currentActionStatus: ActionStatus,
): { newReviewStatus: ReviewStatus; newActionStatus?: ActionStatus } {
  switch (action) {
    case "APPROVE":
      return {
        newReviewStatus: "APPROVED",
        newActionStatus: currentActionStatus === "NONE" ? "DONE" : undefined,
      };
    case "REJECT":
      return { newReviewStatus: "REJECTED" };
    case "REQUEST_MORE":
      return { newReviewStatus: "NEED_INFO" };
    case "MARK_URGENT":
      return { newReviewStatus: "IN_REVIEW" };
    case "ASSIGN":
      return {
        newReviewStatus: "IN_REVIEW",
        newActionStatus: "ASSIGNED",
      };
    case "CLOSE":
      return {
        newReviewStatus: "APPROVED",
        newActionStatus: "DONE",
      };
    default:
      return { newReviewStatus: "IN_REVIEW" };
  }
}

export function canResubmit(currentReviewStatus: ReviewStatus): boolean {
  return (
    currentReviewStatus === "NEED_INFO" || currentReviewStatus === "REJECTED"
  );
}

export function isTerminalReviewStatus(status: ReviewStatus): boolean {
  return status === "APPROVED" || status === "REJECTED";
}

export function isTerminalActionStatus(status: ActionStatus): boolean {
  return status === "DONE";
}
