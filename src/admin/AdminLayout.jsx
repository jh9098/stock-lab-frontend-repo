import { Helmet } from "react-helmet";
import { Outlet } from "react-router-dom";
import AdminLogin from "./AdminLogin";
import AdminNav from "./AdminNav";
import { AdminContext } from "./AdminContext";
import useAdminAuth from "./useAdminAuth";

export default function AdminLayout() {
  const auth = useAdminAuth();
  if (!auth.loggedIn) {
    return (
      <>
        <Helmet>
          <title>관리자 로그인 - 지지저항 Lab</title>
        </Helmet>
        <AdminLogin onLogin={auth.login} message={auth.message} pending={auth.pending} />
      </>
    );
  }

  return (
    <AdminContext.Provider value={auth}>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Helmet>
          <title>관리자 센터 - 지지저항 Lab</title>
        </Helmet>
        <header className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">관리자 센터</h1>
              <p className="text-sm text-gray-400">콘텐츠와 회원 포트폴리오를 한 곳에서 관리하세요.</p>
            </div>
            <button
              type="button"
              onClick={auth.logout}
              className="self-start sm:self-auto bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg border border-gray-700"
            >
              로그아웃
            </button>
          </div>
        </header>

        <AdminNav />

        {auth.message && (
          <div className="max-w-6xl mx-auto px-4 pt-4">
            <div className="bg-gray-900 border border-teal-700 text-teal-200 rounded-lg px-4 py-3 text-sm">
              {auth.message}
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <Outlet />
        </main>
      </div>
    </AdminContext.Provider>
  );
}
