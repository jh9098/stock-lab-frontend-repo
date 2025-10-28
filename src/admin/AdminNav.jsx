import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/admin", label: "대시보드" },
  { to: "/admin/users", label: "회원 및 권한" },
  { to: "/admin/blog", label: "블로그 관리" },
  { to: "/admin/stocks", label: "종목 분석" },
  { to: "/admin/forum", label: "상담 게시판" },
  { to: "/admin/portfolio", label: "포트폴리오" },
  { to: "/admin/watchlist", label: "관심 종목" },
];

export default function AdminNav() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <ul className="flex flex-wrap gap-3 py-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? "bg-teal-500 text-white shadow"
                      : "text-gray-300 hover:text-white hover:bg-gray-800"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
