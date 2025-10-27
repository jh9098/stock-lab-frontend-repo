import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import useAuth from "../useAuth";

const NAV_SECTIONS = [
  {
    label: "시장 인사이트",
    items: [
      { label: "인사이트 블로그", to: "/market-insights" },
      { label: "수급·인기·테마 대시보드", to: "/market-history" },
      { label: "테마 순위 히스토리", to: "/theme-rank-history" },
    ],
  },
  {
    label: "투자 전략",
    items: [
      { label: "종목 추천", to: "/recommendations" },
      { label: "(유료)포트폴리오", to: "/portfolio" },
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
  const { user, profile, signIn, logout, loading } = useAuth();

  const toggleMobile = () => {
    setMobileOpen((prev) => !prev);
    setOpenMenuIndex(null);
  };

  const handleMouseEnter = (index) => {
    if (!mobileOpen) {
      setOpenMenuIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (!mobileOpen) {
      setOpenMenuIndex(null);
    }
  };

  const toggleMenu = (index) => {
    setOpenMenuIndex((prev) => (prev === index ? null : index));
  };

  const handleItemClick = () => {
    setMobileOpen(false);
    setOpenMenuIndex(null);
  };

  const roleLabel = profile?.role === "admin"
    ? "관리자"
    : profile?.role === "member"
    ? "멤버"
    : "게스트";

  const renderAuthButton = () => {
    if (loading) {
      return (
        <span className="text-xs text-gray-400">권한 확인 중...</span>
      );
    }

    if (user) {
      return (
        <div className="flex flex-col items-end gap-1 text-xs text-gray-300">
          <span className="font-semibold text-white">
            {profile?.displayName || user.email || "로그인됨"}
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[0.7rem] text-teal-200">
              {roleLabel}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/20 px-2.5 py-1 text-[0.7rem] font-semibold text-gray-200 transition hover:bg-white/10"
            >
              로그아웃
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={signIn}
        className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-400"
      >
        Google 로그인
      </button>
    );
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

        <div className="hidden flex-1 justify-end md:flex">
          {renderAuthButton()}
        </div>

        <nav
          id="main-navigation"
          className={`${mobileOpen ? "mt-4 w-full" : "hidden"} md:mt-0 md:block md:w-auto`}
        >
          <div className="mb-3 md:hidden">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs">
              {user ? (
                <div className="space-y-1">
                  <p className="font-semibold text-white">
                    {profile?.displayName || user.email || "로그인됨"}
                  </p>
                  <p className="text-[0.7rem] text-teal-200">역할: {roleLabel}</p>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      handleItemClick();
                    }}
                    className="mt-2 w-full rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.7rem] font-semibold text-white transition hover:bg-white/20"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    signIn();
                    handleItemClick();
                  }}
                  className="w-full rounded-full bg-teal-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
                >
                  Google 로그인
                </button>
              )}
            </div>
          </div>

          <ul className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:gap-4 md:text-base">
            {NAV_SECTIONS.map((section, index) => {
              const isOpen = openMenuIndex === index;

              return (
                <li
                  key={section.label}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(index)}
                  onMouseLeave={handleMouseLeave}
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
                    } mt-2 rounded-lg border border-gray-700 bg-gray-800/95 p-3 shadow-lg transition md:absolute md:left-0 md:top-full md:z-20 md:mt-0 md:w-56 md:pt-3`}
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
