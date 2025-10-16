import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../useAuth';
import { matchPathPattern, normalizePath, PUBLIC_PATHS } from '../lib/pageAccessConfig';

function LoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gray-900 text-gray-200">
      <div className="space-y-2 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-teal-400 mx-auto" />
        <p className="text-sm text-gray-400">접근 권한을 확인하는 중입니다...</p>
      </div>
    </div>
  );
}

function LoginPrompt({ onLogin }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gray-900 px-4 text-gray-100">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center shadow-xl">
        <h2 className="text-xl font-semibold text-white">로그인이 필요한 서비스입니다</h2>
        <p className="mt-3 text-sm text-gray-400">
          Google 계정으로 로그인하면 개인화된 서비스와 권한이 적용됩니다.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-6 w-full rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
        >
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

function NoAccessNotice({ onHome }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gray-900 px-4 text-gray-100">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center shadow-xl">
        <h2 className="text-xl font-semibold text-white">접근 권한이 없습니다</h2>
        <p className="mt-3 text-sm text-gray-300">
          관리자에게 문의하여 권한을 부여받거나 다른 계정으로 로그인해주세요.
        </p>
        <button
          type="button"
          onClick={onHome}
          className="mt-6 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          메인 페이지로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default function AccessGuard({
  pathKey,
  children,
  requiresAuth = false,
  allowedRoles = [],
}) {
  const { user, profile, loading, signIn, hasAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const actualPath = normalizePath(location.pathname);
  const guardPath = pathKey ? normalizePath(pathKey) : actualPath;

  const isPublicPath = useMemo(() => {
    return PUBLIC_PATHS.some(
      (pattern) =>
        matchPathPattern(pattern, guardPath) || matchPathPattern(pattern, actualPath)
    );
  }, [guardPath, actualPath]);

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    if (!requiresAuth && isPublicPath) {
      return children;
    }
    return <LoginPrompt onLogin={signIn} />;
  }

  if (allowedRoles.length > 0 && (!profile || !allowedRoles.includes(profile.role))) {
    return <NoAccessNotice onHome={() => navigate('/', { replace: true })} />;
  }

  if (requiresAuth || !isPublicPath) {
    const accessible = hasAccess(actualPath);
    if (!accessible) {
      return <NoAccessNotice onHome={() => navigate('/', { replace: true })} />;
    }
  }

  return children;
}
