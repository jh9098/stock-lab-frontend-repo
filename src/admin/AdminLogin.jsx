export default function AdminLogin({ onLogin, message, pending }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">지지저항 Lab 관리자</h1>
          <p className="text-gray-400 text-sm">
            관리자 전용 도구입니다. Google 계정으로 로그인하여 접근하세요.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogin}
          disabled={pending}
          className="w-full rounded-lg bg-teal-500 py-3 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:opacity-60"
        >
          {pending ? "Google 로그인 중..." : "Google 계정으로 로그인"}
        </button>

        <p className="text-xs text-gray-400">
          최초 로그인 시 자동으로 계정이 등록되며, 최고 관리자가 권한을 부여해야 관리자 페이지에 접근할 수 있습니다.
        </p>

        {message && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-sm text-red-200">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
