import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStats } from '@/hooks/use-stats';
import { createWrapper } from '@/hooks/__tests__/test-utils';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe('use-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches global admin stats', async () => {
    mockApiFetch.mockResolvedValue({ stats: { totalUsers: 12 } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalUsers: 12 });
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/stats');
  });
});
