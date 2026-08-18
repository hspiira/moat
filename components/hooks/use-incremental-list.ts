"use client";

import { useEffect, useRef, useState } from "react";

export const DEFAULT_PAGE_SIZE = 40;

export function nextPageCount(current: number, total: number, pageSize: number): number {
  return Math.min(Math.max(current, 0) + Math.max(pageSize, 1), total);
}

export function useIncrementalList<T>(
  items: T[],
  { pageSize = DEFAULT_PAGE_SIZE, resetKey = "" }: { pageSize?: number; resetKey?: string } = {},
) {
  const [state, setState] = useState({ resetKey, count: pageSize });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  if (state.resetKey !== resetKey) {
    setState({ resetKey, count: pageSize });
  }

  const count = Math.min(state.count, items.length);
  const hasMore = count < items.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setState((current) => ({
          ...current,
          count: nextPageCount(current.count, items.length, pageSize),
        }));
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, items.length, pageSize]);

  return {
    visible: items.slice(0, count),
    hasMore,
    shownCount: count,
    totalCount: items.length,
    sentinelRef,
    showMore: () =>
      setState((current) => ({
        ...current,
        count: nextPageCount(current.count, items.length, pageSize),
      })),
  };
}
