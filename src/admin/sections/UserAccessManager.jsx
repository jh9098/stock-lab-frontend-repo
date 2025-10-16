import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";
import {
  DEFAULT_ALLOWED_PATHS,
  PAGE_OPTIONS,
  matchPathPattern,
  normalizePath,
} from "../../lib/pageAccessConfig";

const MANAGEABLE_PAGES = PAGE_OPTIONS.filter((option) => !option.adminOnly);

function formatTimestamp(value) {
  if (!value) return "-";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString();
    }
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    return new Date(value).toLocaleString();
  } catch (error) {
    return "-";
  }
}

function ensurePortfolioPath(paths, role) {
  const normalized = Array.from(new Set(paths.map(normalizePath)));
  const hasPortfolio = normalized.some((path) => matchPathPattern(path, "/portfolio"));
  if ((role === "member" || role === "admin") && !hasPortfolio) {
    normalized.push("/portfolio");
  }
  if (role === "guest") {
    return normalized.filter((path) => !matchPathPattern(path, "/portfolio"));
  }
  return normalized;
}

function sanitizeAllowedPaths(paths = []) {
  if (!Array.isArray(paths)) {
    return [...DEFAULT_ALLOWED_PATHS];
  }
  return Array.from(new Set(paths.map(normalizePath)));
}

export default function UserAccessManager() {
  const { setMessage } = useAdminContext();
  const [users, setUsers] = useState([]);
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const role = data.role || "guest";
        const allowedPaths = ensurePortfolioPath(
          sanitizeAllowedPaths(data.allowedPaths),
          role
        );
        return {
          id: docSnap.id,
          email: data.email || "",
          displayName: data.displayName || "",
          role,
          allowedPaths,
          allowedPathSet: new Set(allowedPaths),
          lastLoginAt: data.lastLoginAt,
          createdAt: data.createdAt,
        };
      });
      setUsers(mapped);
    });

    return () => unsubscribe();
  }, []);

  const roleOptions = useMemo(
    () => [
      { value: "guest", label: "게스트" },
      { value: "member", label: "멤버" },
      { value: "admin", label: "관리자" },
    ],
    []
  );

  const updateUserDocument = async (userId, payload, successMessage) => {
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      setMessage(successMessage);
    } catch (error) {
      console.error("회원 정보 갱신 실패", error);
      setMessage("회원 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setUpdatingId("");
    }
  };

  const handleRoleChange = async (user, nextRole) => {
    const normalizedPaths = ensurePortfolioPath(user.allowedPaths, nextRole);
    const roleLabel =
      roleOptions.find((option) => option.value === nextRole)?.label || nextRole;

    await updateUserDocument(
      user.id,
      {
        role: nextRole,
        allowedPaths: normalizedPaths,
      },
      `${user.email || user.displayName} 님의 역할이 ${roleLabel}(으)로 변경되었습니다.`
    );
  };

  const handlePageToggle = async (user, pathValue, checked) => {
    const normalizedPath = normalizePath(pathValue);
    const nextPaths = new Set(user.allowedPaths.map(normalizePath));
    if (checked) {
      nextPaths.add(normalizedPath);
    } else {
      nextPaths.delete(normalizedPath);
      if (
        normalizedPath === "/portfolio" &&
        (user.role === "member" || user.role === "admin")
      ) {
        nextPaths.add("/portfolio");
      }
    }
    await updateUserDocument(
      user.id,
      {
        allowedPaths: Array.from(nextPaths),
      },
      `${user.email || user.displayName} 님의 페이지 접근 권한이 업데이트되었습니다.`
    );
  };

  const handleReset = async (user) => {
    const basePaths = ensurePortfolioPath([...DEFAULT_ALLOWED_PATHS], user.role);
    await updateUserDocument(
      user.id,
      {
        allowedPaths: basePaths,
      },
      `${user.email || user.displayName} 님의 권한이 기본값으로 초기화되었습니다.`
    );
  };

  if (users.length === 0) {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-300">
        <h2 className="text-lg font-semibold text-white">회원 및 권한 관리</h2>
        <p className="mt-3 text-gray-400">
          아직 Google 로그인 이력이 없습니다. 사용자가 로그인하면 자동으로 목록에 추가됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">회원 및 권한 관리</h2>
        <p className="text-sm text-gray-400">
          각 회원별로 역할과 페이지 접근 범위를 설정할 수 있습니다. 멤버 또는 관리자 역할은 자동으로 포트폴리오 페이지 접근 권한이 추가됩니다.
        </p>
      </header>

      {users.map((user) => (
        <article
          key={user.id}
          className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-lg"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-300">
                {user.displayName || "이름 미등록"}
              </p>
              <p className="text-xs text-gray-400">{user.email || "이메일 미등록"}</p>
            </div>
            <div className="text-xs text-gray-500 text-right">
              <p>최근 로그인: {formatTimestamp(user.lastLoginAt)}</p>
              <p>등록일: {formatTimestamp(user.createdAt)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[200px,1fr]">
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                역할 지정
              </label>
              <select
                value={user.role}
                onChange={(event) => handleRoleChange(user, event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                disabled={updatingId === user.id}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleReset(user)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                disabled={updatingId === user.id}
              >
                기본 권한으로 초기화
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-400">페이지 접근 권한</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MANAGEABLE_PAGES.map((page) => (
                  <label
                    key={`${user.id}-${page.value}`}
                    className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs text-gray-200"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-teal-500 focus:ring-teal-500"
                      checked={user.allowedPathSet.has(normalizePath(page.value))}
                      onChange={(event) =>
                        handlePageToggle(user, page.value, event.target.checked)
                      }
                      disabled={updatingId === user.id}
                    />
                    <span>
                      {page.label}
                      {page.value === "/portfolio" && (
                        <span className="ml-1 text-[0.65rem] text-teal-300">(멤버 전용)</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
