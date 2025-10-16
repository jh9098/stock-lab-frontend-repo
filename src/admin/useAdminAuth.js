import { useCallback, useEffect, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { API_BASE_URL } from "../lib/apiConfig";
const buildAdminApiUrl = (path = "") => {
  const trimmedPath = path.replace(/^\//, "");
  const normalizedBase = (API_BASE_URL || "").replace(/\/$/, "");

  let baseWithApi;
  if (!normalizedBase) {
    baseWithApi = "/api";
  } else if (/\/api$/i.test(normalizedBase)) {
    baseWithApi = normalizedBase;
  } else {
    baseWithApi = `${normalizedBase}/api`;
  }

  if (!trimmedPath) {
    return baseWithApi;
  }

  return `${baseWithApi}/${trimmedPath}`;
};


const SESSION_KEY = "adminLoggedIn";

export default function useAdminAuth() {
  const [loggedIn, setLoggedIn] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    } catch (error) {
      console.error("세션 저장소 접근에 실패했습니다.", error);
      return false;
    }
  });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      if (loggedIn) {
        sessionStorage.setItem(SESSION_KEY, "true");
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (error) {
      console.error("세션 저장소 갱신 실패", error);
    }
  }, [loggedIn]);

  const login = useCallback(
    async (password) => {
      if (!password) {
        setMessage("비밀번호를 입력해주세요.");
        return false;
      }

      setPending(true);
      setMessage("로그인 시도 중...");
      try {
        const response = await fetch(buildAdminApiUrl("admin/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
          setMessage(data?.message ? `로그인 실패: ${data.message}` : "로그인에 실패했습니다. 다시 시도해주세요.");
          return false;
        }

        try {
          await signInAnonymously(auth);
        } catch (authError) {
          console.error("Firebase 익명 로그인 실패", authError);
        }

        setLoggedIn(true);
        setMessage("로그인에 성공했습니다. 원하는 메뉴를 선택하세요.");
        return true;
      } catch (error) {
        console.error("관리자 로그인 오류", error);
        setMessage("로그인 중 문제가 발생했습니다. 네트워크 상태를 확인해주세요.");
        return false;
      } finally {
        setPending(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    setLoggedIn(false);
    setMessage("로그아웃되었습니다.");
  }, []);

  return { loggedIn, login, logout, message, setMessage, pending };
}
