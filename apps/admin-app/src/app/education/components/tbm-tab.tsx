"use client";

import { Plus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@safetywallet/ui";
import type {
  Setter,
  TbmDetail,
  TbmFormState,
  TbmRecordItem,
} from "./education-types";

type TbmTabProps = {
  currentSiteId: string | null;
  tbmForm: TbmFormState;
  setTbmForm: Setter<TbmFormState>;
  onCreateTbm: () => void;
  isTbmLoading: boolean;
  tbmRecords: TbmRecordItem[];
  expandedTbmId: string | null;
  setExpandedTbmId: Setter<string | null>;
  tbmDetail?: TbmDetail;
};

export function TbmTab({
  currentSiteId,
  tbmForm,
  setTbmForm,
  onCreateTbm,
  isTbmLoading,
  tbmRecords,
  expandedTbmId,
  setExpandedTbmId,
  tbmDetail,
}: TbmTabProps) {
  return (
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
  );
}
