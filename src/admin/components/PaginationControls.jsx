import { useMemo } from "react";

const MAX_VISIBLE_PAGES = 5;

export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  className = "",
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);

  const visiblePages = useMemo(() => {
    if (totalPages <= MAX_VISIBLE_PAGES) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    let start = clampedPage - half;
    let end = clampedPage + half;

    if (start < 1) {
      end += 1 - start;
      start = 1;
    }
    if (end > totalPages) {
      start -= end - totalPages;
      end = totalPages;
    }

    start = Math.max(1, start);
    end = Math.min(totalPages, end);

    const pages = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }, [clampedPage, totalPages]);

  if (totalItems <= pageSize) {
    return null;
  }

  const goToPage = (page) => {
    if (page < 1 || page > totalPages || page === clampedPage) {
      return;
    }
    onPageChange(page);
  };

  const sharedButtonClass =
    "px-3 py-1 rounded-lg border text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-500/60 disabled:cursor-not-allowed";
  const inactiveButtonClass =
    "border-gray-700 bg-gray-900 text-gray-300 hover:border-teal-500 hover:text-white disabled:border-gray-800 disabled:text-gray-600 disabled:hover:border-gray-800 disabled:hover:text-gray-600";
  const activeButtonClass = "border-teal-400 bg-teal-500/20 text-teal-100";

  return (
    <div className={`flex flex-col gap-2 text-sm text-gray-300 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between text-xs text-gray-400">
        <span>총 {totalItems.toLocaleString()}건</span>
        <span>
          페이지 {clampedPage} / {totalPages}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => goToPage(1)}
          disabled={clampedPage === 1}
          className={`${sharedButtonClass} ${inactiveButtonClass}`}
          aria-label="첫 페이지"
        >
          처음
        </button>
        <button
          type="button"
          onClick={() => goToPage(clampedPage - 1)}
          disabled={clampedPage === 1}
          className={`${sharedButtonClass} ${inactiveButtonClass}`}
          aria-label="이전 페이지"
        >
          이전
        </button>
        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goToPage(page)}
            className={`${sharedButtonClass} ${
              page === clampedPage ? activeButtonClass : inactiveButtonClass
            }`}
            aria-current={page === clampedPage ? "page" : undefined}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => goToPage(clampedPage + 1)}
          disabled={clampedPage === totalPages}
          className={`${sharedButtonClass} ${inactiveButtonClass}`}
          aria-label="다음 페이지"
        >
          다음
        </button>
        <button
          type="button"
          onClick={() => goToPage(totalPages)}
          disabled={clampedPage === totalPages}
          className={`${sharedButtonClass} ${inactiveButtonClass}`}
          aria-label="마지막 페이지"
        >
          마지막
        </button>
      </div>
    </div>
  );
}
