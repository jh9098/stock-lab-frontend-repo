export const PAGE_OPTIONS = [
  { value: '/', label: '홈' },
  { value: '/market-insights', label: '시장 인사이트 블로그' },
  { value: '/blog', label: '블로그 목록' },
  { value: '/blog/*', label: '블로그 상세' },
  { value: '/recommendations', label: '종목 추천' },
  { value: '/forum', label: '상담 포럼 목록' },
  { value: '/forum/write', label: '상담 글쓰기' },
  { value: '/forum/*', label: '상담 상세' },
  { value: '/portfolio', label: '프리미엄 포트폴리오', membersOnly: true },
  { value: '/market-history', label: '시장 수급·인기 대시보드' },
  { value: '/theme-rank-history', label: '테마 순위 히스토리' },
  { value: '/popular-history', label: '인기 종목 히스토리' },
  { value: '/foreign-net-buy-history', label: '외국인 순매수 히스토리' },
  { value: '/institution-net-buy-history', label: '기관 순매수 히스토리' },
  { value: '/content-community', label: '콘텐츠 & 커뮤니티 허브' },
  { value: '/custom-features', label: '맞춤 기능 가이드' },
  { value: '/causal', label: '연쇄효과 추론 실험실' },
  { value: '/admin', label: '관리자 대시보드', adminOnly: true },
  { value: '/admin/*', label: '관리자 하위 페이지', adminOnly: true },
];

export const DEFAULT_ALLOWED_PATHS = PAGE_OPTIONS.filter(
  (option) => !option.adminOnly && option.value !== '/portfolio'
).map((option) => option.value);

export const PUBLIC_PATHS = DEFAULT_ALLOWED_PATHS;

export function normalizePath(path = '/') {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    return path.replace(/\/+$/, '');
  }
  return path;
}

export function matchPathPattern(pattern, targetPath) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedTarget = normalizePath(targetPath);

  if (normalizedPattern === '*') {
    return true;
  }

  if (normalizedPattern.endsWith('*')) {
    const prefix = normalizedPattern.slice(0, -1);
    return normalizedTarget.startsWith(prefix);
  }

  return normalizedPattern === normalizedTarget;
}
