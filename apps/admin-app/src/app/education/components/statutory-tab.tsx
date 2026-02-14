"use client";

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
import type { CreateStatutoryTrainingInput } from "@/hooks/use-api";
import {
  getTrainingStatusLabel,
  getTrainingTypeLabel,
} from "../education-helpers";
import type {
  Setter,
  TrainingFormState,
  TrainingItem,
} from "./education-types";

type StatutoryTabProps = {
  editingTrainingId: string | null;
  setEditingTrainingId: Setter<string | null>;
  trainingForm: TrainingFormState;
  setTrainingForm: Setter<TrainingFormState>;
  onSubmitTraining: () => void;
  isTrainingsLoading: boolean;
  trainings: TrainingItem[];
  onEditTraining: (item: TrainingItem) => void;
};

export function StatutoryTab({
  editingTrainingId,
  setEditingTrainingId,
  trainingForm,
  setTrainingForm,
  onSubmitTraining,
  isTrainingsLoading,
  trainings,
  onEditTraining,
}: StatutoryTabProps) {
  return (
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
                          {getTrainingStatusLabel(
                            item.training.status ?? "SCHEDULED",
                          )}
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
  );
}
