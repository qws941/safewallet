'use client';

import { useState } from 'react';
import { Check, X, HelpCircle } from 'lucide-react';
import { Button, Card, Input } from '@safetywallet/ui';
import { ReviewAction, RejectReason } from '@safetywallet/types';
import { useReviewPost } from '@/hooks/use-api';

const rejectReasons: { value: RejectReason; label: string }[] = [
  { value: RejectReason.DUPLICATE, label: '중복 제보' },
  { value: RejectReason.UNCLEAR_PHOTO, label: '사진 불명확' },
  { value: RejectReason.INSUFFICIENT, label: '정보 부족' },
  { value: RejectReason.FALSE, label: '허위 제보' },
  { value: RejectReason.IRRELEVANT, label: '관련 없음' },
  { value: RejectReason.OTHER, label: '기타' },
];

interface ReviewActionsProps {
  postId: string;
  onComplete?: () => void;
}

export function ReviewActions({ postId, onComplete }: ReviewActionsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showInfoRequest, setShowInfoRequest] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState('');

  const reviewMutation = useReviewPost();

  const handleApprove = () => {
    reviewMutation.mutate(
      { postId, action: ReviewAction.APPROVE },
      { onSuccess: onComplete }
    );
  };

  const handleReject = () => {
    if (!rejectReason) return;
    reviewMutation.mutate(
      { postId, action: ReviewAction.REJECT, reason: rejectReason, note },
      {
        onSuccess: () => {
          setShowRejectForm(false);
          setRejectReason(null);
          setNote('');
          onComplete?.();
        },
      }
    );
  };

  const handleRequestInfo = () => {
    if (!note.trim()) return;
    reviewMutation.mutate(
      { postId, action: ReviewAction.REQUEST_MORE, note },
      {
        onSuccess: () => {
          setShowInfoRequest(false);
          setNote('');
          onComplete?.();
        },
      }
    );
  };

  if (showRejectForm) {
    return (
      <Card className="p-4">
        <h3 className="mb-3 font-medium">거절 사유 선택</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {rejectReasons.map((r) => (
            <Button
              key={r.value}
              variant={rejectReason === r.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRejectReason(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Input
          placeholder="추가 설명 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mb-3"
        />
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!rejectReason || reviewMutation.isPending}
          >
            거절
          </Button>
          <Button variant="outline" onClick={() => setShowRejectForm(false)}>
            취소
          </Button>
        </div>
      </Card>
    );
  }

  if (showInfoRequest) {
    return (
      <Card className="p-4">
        <h3 className="mb-3 font-medium">추가 정보 요청</h3>
        <Input
          placeholder="필요한 정보를 입력하세요"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mb-3"
        />
        <div className="flex gap-2">
          <Button
            onClick={handleRequestInfo}
            disabled={!note.trim() || reviewMutation.isPending}
          >
            요청 보내기
          </Button>
          <Button variant="outline" onClick={() => setShowInfoRequest(false)}>
            취소
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleApprove}
        disabled={reviewMutation.isPending}
        className="gap-1"
      >
        <Check size={16} />
        승인
      </Button>
      <Button
        variant="destructive"
        onClick={() => setShowRejectForm(true)}
        disabled={reviewMutation.isPending}
        className="gap-1"
      >
        <X size={16} />
        거절
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowInfoRequest(true)}
        disabled={reviewMutation.isPending}
        className="gap-1"
      >
        <HelpCircle size={16} />
        추가 정보 요청
      </Button>
    </div>
  );
}
