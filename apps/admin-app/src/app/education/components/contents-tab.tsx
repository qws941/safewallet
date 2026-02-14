"use client";

import { Plus, Trash2 } from "lucide-react";
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
import type { CreateEducationContentInput } from "@/hooks/use-api";
import { getContentTypeLabel } from "../education-helpers";
import type {
  ContentFormState,
  EducationContentItem,
  Setter,
} from "./education-types";

type ContentsTabProps = {
  currentSiteId: string | null;
  contentForm: ContentFormState;
  setContentForm: Setter<ContentFormState>;
  onCreateContent: () => void;
  createContentPending: boolean;
  isContentsLoading: boolean;
  contents: EducationContentItem[];
  setDeleteContentId: Setter<string | null>;
  deleteContentPending: boolean;
};

export function ContentsTab({
  currentSiteId,
  contentForm,
  setContentForm,
  onCreateContent,
  createContentPending,
  isContentsLoading,
  contents,
  setDeleteContentId,
  deleteContentPending,
}: ContentsTabProps) {
  return (
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
              !currentSiteId || !contentForm.title || createContentPending
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
                      <td className="px-2 py-2 font-medium">{item.title}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">
                          {getContentTypeLabel(item.contentType)}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {item.description || "-"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteContentId(item.id)}
                          disabled={deleteContentPending}
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
  );
}
