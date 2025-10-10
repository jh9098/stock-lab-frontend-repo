import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const NAV_SECTIONS = [
  {
    label: "시장 인사이트",
    items: [
      { label: "시장 인사이트 허브", to: "/market-insights" },
      { label: "수급 히스토리", to: "/market-history" },
      { label: "인기 종목 히스토리", to: "/popular-history" },
    ],
  },
  {
    label: "투자 전략",
    items: [
      { label: "종목 추천", to: "/recommendations" },
      { label: "테마 리더보드", to: "/themes" },
      { label: "포트폴리오", to: "/portfolio" },
    ],
  },
  {
    label: "커뮤니티 & 미디어",
    items: [
      { label: "종목 상담 포럼", to: "/forum" },
      { label: "콘텐츠 & 커뮤니티 허브", to: "/content-community" },
    ],
  },
  {
    label: "데이터 실험실",
    items: [
      { label: "연쇄효과 추론", to: "/causal" },
      { label: "AI 시장 요약", to: "/ai-summaries" },
    ],
  },
  {
    label: "부가 기능",
    items: [
      { label: "맞춤 기능 가이드", to: "/custom-features" },
    ],
  },
];

export default function MainNavigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenuIndex, setOpenMenuIndex] = useState(null);

  const toggleMobile = () => {
    setMobileOpen((prev) => !prev);
    setOpenMenuIndex(null);
  };

  const toggleMenu = (index) => {
    setOpenMenuIndex((prev) => (prev === index ? null : index));
  };

  const handleItemClick = () => {
    setMobileOpen(false);
    setOpenMenuIndex(null);
  };

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto flex flex-wrap items-center justify-between px-4 py-4">
        <Link
          to="/"
          className="text-2xl font-bold text-white transition hover:text-teal-200"
          onClick={handleItemClick}
        >
          지지저항랩
        </Link>

        <button
          type="button"
          className="text-gray-200 md:hidden"
          onClick={toggleMobile}
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
        >
          <span className="sr-only">메뉴 열기</span>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>

        <nav
          id="main-navigation"
          className={`${mobileOpen ? "mt-4 w-full" : "hidden"} md:mt-0 md:block md:w-auto`}
        >
          <ul className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:gap-4 md:text-base">
            {NAV_SECTIONS.map((section, index) => {
              const isOpen = openMenuIndex === index;

              return (
                <li
                  key={section.label}
                  className="relative"
                  onMouseEnter={() => setOpenMenuIndex(index)}
                  onMouseLeave={() => setOpenMenuIndex(null)}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-1 rounded-md px-3 py-2 text-gray-200 transition hover:bg-gray-700 md:justify-start"
                    onClick={() => toggleMenu(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{section.label}</span>
                    <svg
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div
                    className={`${
                      isOpen
                        ? "block md:visible md:opacity-100"
                        : "hidden md:invisible md:opacity-0"
                    } mt-2 rounded-lg border border-gray-700 bg-gray-800/95 p-3 shadow-lg transition md:absolute md:left-0 md:z-20 md:mt-3 md:w-56`}
                  >
                    <ul className="space-y-1 text-sm">
                      {section.items.map((item) => (
                        <li key={`${section.label}-${item.to}`}>
                          <NavLink
                            to={item.to}
                            onClick={handleItemClick}
                            className={({ isActive }) =>
                              `block rounded-md px-3 py-2 transition hover:bg-gray-700 hover:text-white ${
                                isActive ? "bg-teal-600/20 text-teal-200" : "text-gray-200"
                              }`
                            }
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
