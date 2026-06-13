import { useState, useEffect } from 'react';

/**
 * 检测当前视口是否为移动端
 * @param breakpoint - 断点宽度，默认 900px
 * @returns boolean
 */
export function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // 初始化
    handler(mq);

    // 监听变化
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * 通用媒体查询 hook
 * @param query - 媒体查询字符串
 * @returns boolean
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(query);

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setMatches(e.matches);
    };

    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
