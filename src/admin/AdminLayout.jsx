import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Outlet } from "react-router-dom";
import AdminLogin from "./AdminLogin";
import AdminNav from "./AdminNav";
import { AdminContext } from "./AdminContext";
import useAuth from "../useAuth";

export default function AdminLayout() {
  const { user, profile, loading, signIn, logout, error } = useAuth();
  const [message, setMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [pending, setPending] = useState(false);

  const handleAdminLogin = async () => {
    setPending(true);
    setLoginMessage("");
    try {
      await signIn();
    } catch (signInError) {
      setLoginMessage("Google 로그인에 실패했습니다. 새로고침 후 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-800 border-t-teal-400" />
          <p className="text-sm text-gray-400">관리자 권한을 확인하는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Helmet>
          <title>관리자 로그인 - 지지저항 Lab</title>
        </Helmet>
        <AdminLogin
          onLogin={handleAdminLogin}
          message={loginMessage || error}
          pending={pending}
        />
      </>
    );
  }

  if (profile?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-gray-100">
        <div className="max-w-lg space-y-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <Helmet>
            <title>관리자 권한 필요 - 지지저항 Lab</title>
          </Helmet>
          <h1 className="text-2xl font-bold text-white">관리자 권한이 필요합니다</h1>
          <p className="text-sm text-gray-300">
            현재 계정({profile?.email || user.email})은 관리자 권한이 없습니다.
            권한을 부여받으려면 최고 관리자에게 문의해주세요.
          </p>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  const contextValue = useMemo(
    () => ({
      message,
      setMessage,
      logout,
      profile,
    }),
    [message, logout, profile]
  );

  return (
    <AdminContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Helmet>
          <title>관리자 센터 - 지지저항 Lab</title>
        </Helmet>
        <header className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">관리자 센터</h1>
              <p className="text-sm text-gray-400">콘텐츠, 회원 권한, 포트폴리오 데이터를 한 곳에서 관리하세요.</p>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <div className="text-xs text-gray-300">
                <p className="font-semibold text-white">
                  {profile.displayName || profile.email || "관리자"}
                </p>
                <p>역할: 관리자</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 sm:self-auto"
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <AdminNav />

        {(message || error) && (
          <div className="max-w-6xl mx-auto px-4 pt-4">
            <div className="bg-gray-900 border border-teal-700 text-teal-200 rounded-lg px-4 py-3 text-sm">
              {message || error}
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
