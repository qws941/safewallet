'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCreatePost } from '@/hooks/use-api';
import { Header } from '@/components/header';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@safetywallet/ui';
import { Category, RiskLevel, Visibility } from '@safetywallet/types';
import type { CreatePostDto } from '@safetywallet/types';

const categoryOptions = [
  { value: Category.HAZARD, label: '위험요소', icon: '⚠️' },
  { value: Category.UNSAFE_BEHAVIOR, label: '불안전행동', icon: '🚨' },
  { value: Category.INCONVENIENCE, label: '불편사항', icon: '🛠️' },
  { value: Category.SUGGESTION, label: '개선제안', icon: '💡' },
  { value: Category.BEST_PRACTICE, label: '우수사례', icon: '⭐' },
];

const riskOptions = [
  { value: RiskLevel.HIGH, label: '높음', color: 'bg-red-100 border-red-500 text-red-700' },
  { value: RiskLevel.MEDIUM, label: '중간', color: 'bg-yellow-100 border-yellow-500 text-yellow-700' },
  { value: RiskLevel.LOW, label: '낮음', color: 'bg-green-100 border-green-500 text-green-700' },
];

export default function NewPostPage() {
  const router = useRouter();
  const { currentSiteId } = useAuth();
  const createPost = useCreatePost();

  const [category, setCategory] = useState<Category | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [content, setContent] = useState('');
  const [locationFloor, setLocationFloor] = useState('');
  const [locationZone, setLocationZone] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !currentSiteId) return;

    const postData: CreatePostDto = {
      siteId: currentSiteId,
      category,
      riskLevel: riskLevel || undefined,
      content,
      locationFloor: locationFloor || undefined,
      locationZone: locationZone || undefined,
      visibility: Visibility.WORKER_PUBLIC,
      isAnonymous,
    };

    try {
      await createPost.mutateAsync(postData);
      router.replace('/posts');
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">제보 유형</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      category === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className="text-xs">{opt.label}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Level (for HAZARD and UNSAFE_BEHAVIOR) */}
          {(category === Category.HAZARD || category === Category.UNSAFE_BEHAVIOR) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">위험 수준</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {riskOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRiskLevel(opt.value)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 text-center transition-colors ${
                        riskLevel === opt.value ? opt.color : 'border-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">위치 (선택)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="층수 (예: B1, 3층)"
                value={locationFloor}
                onChange={(e) => setLocationFloor(e.target.value)}
              />
              <Input
                placeholder="구역 (예: A동, 주차장)"
                value={locationZone}
                onChange={(e) => setLocationZone(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">상세 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder="발견한 내용을 자세히 작성해주세요..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-[120px] p-3 rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </CardContent>
          </Card>

          {/* Photo Upload - Placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">사진 첨부 (선택)</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="w-full h-24">
                <span className="text-2xl mr-2">📷</span>
                사진 촬영/선택
              </Button>
            </CardContent>
          </Card>

          {/* Anonymous Toggle */}
          <Card>
            <CardContent className="py-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span>익명으로 제보하기</span>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </label>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={!category || !content || createPost.isPending}
          >
            {createPost.isPending ? '제보 중...' : '제보하기'}
          </Button>
        </form>
      </main>
    </div>
  );
}
