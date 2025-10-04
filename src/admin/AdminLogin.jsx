import { useState } from "react";

export default function AdminLogin({ onLogin, message, pending }) {
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await onLogin(password);
    if (success) {
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">지지저항 Lab 관리자</h1>
          <p className="text-gray-400 text-sm">
            관리자 비밀번호를 입력해 내부 관리 도구에 접속하세요.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-300 mb-2">
              관리자 비밀번호
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="비밀번호를 입력하세요"
              disabled={pending}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white font-semibold py-2 rounded-lg transition"
          >
            {pending ? "로그인 중..." : "관리자 로그인"}
          </button>
        </form>
        {message && (
          <p className="text-center text-sm text-teal-300 bg-gray-900/80 border border-teal-700 rounded-lg px-4 py-2">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
