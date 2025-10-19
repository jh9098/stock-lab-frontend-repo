import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";
import PaginationControls from "../components/PaginationControls";
import {
  DEFAULT_ALLOWED_PATHS,
  PAGE_OPTIONS,
  matchPathPattern,
  normalizePath,
} from "../../lib/pageAccessConfig";

const MANAGEABLE_PAGES = PAGE_OPTIONS.filter((option) => !option.adminOnly);

function resolveRolePolicyPaths(rolePolicies, role) {
  const storedPaths = rolePolicies?.[role]?.allowedPaths;
  const sanitized = sanitizeAllowedPaths(storedPaths);
  return ensurePortfolioPath(sanitized.length > 0 ? sanitized : [...DEFAULT_ALLOWED_PATHS], role);
}

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
  const { setMessage, profile } = useAdminContext();
  const [users, setUsers] = useState([]);
  const [rolePolicies, setRolePolicies] = useState(() => ({
    guest: { allowedPaths: ensurePortfolioPath([...DEFAULT_ALLOWED_PATHS], "guest") },
    member: { allowedPaths: ensurePortfolioPath([...DEFAULT_ALLOWED_PATHS], "member") },
    admin: { allowedPaths: ensurePortfolioPath([...DEFAULT_ALLOWED_PATHS], "admin") },
  }));
  const [savingRole, setSavingRole] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

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

  useEffect(() => {
    const rolePoliciesQuery = collection(db, "rolePolicies");
    const unsubscribe = onSnapshot(rolePoliciesQuery, (snapshot) => {
      setRolePolicies((prev) => {
        const next = { ...prev };
        snapshot.forEach((docSnap) => {
          const roleKey = docSnap.id;
          next[roleKey] = {
            ...(next[roleKey] || {}),
            allowedPaths: resolveRolePolicyPaths({ [roleKey]: docSnap.data() }, roleKey),
          };
        });
        return next;
      });
    });

    return () => unsubscribe();
  }, []);

  const totalPages = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev > totalPages) {
        return totalPages;
      }
      if (prev < 1) {
        return 1;
      }
      return prev;
    });
  }, [totalPages]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return users.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [users, currentPage]);

  const roleOptions = useMemo(
    () => [
      { value: "guest", label: "게스트" },
      { value: "member", label: "멤버" },
      { value: "admin", label: "관리자" },
    ],
    []
  );

  const handleRolePolicyToggle = async (role, pathValue, checked) => {
    const normalizedPath = normalizePath(pathValue);
    const currentPaths = resolveRolePolicyPaths(rolePolicies, role);
    const nextPaths = new Set(currentPaths.map(normalizePath));

    if (checked) {
      nextPaths.add(normalizedPath);
    } else {
      nextPaths.delete(normalizedPath);
    }

    const ensured = ensurePortfolioPath(Array.from(nextPaths), role);

    setRolePolicies((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        allowedPaths: ensured,
      },
    }));
    setSavingRole(role);
    try {
      await setDoc(
        doc(db, "rolePolicies", role),
        {
          allowedPaths: ensured,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMessage(`${roleOptions.find((option) => option.value === role)?.label || role} 역할의 기본 권한을 저장했습니다.`);
    } catch (error) {
      console.error("역할 기본 권한 저장 실패", error);
      setMessage("역할별 기본 권한을 저장하는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingRole("");
    }
  };

  const handleApplyRolePolicy = async (role) => {
    const targetUsers = users.filter((user) => user.role === role);
    if (targetUsers.length === 0) {
      setMessage(`${roleOptions.find((option) => option.value === role)?.label || role} 역할의 계정이 없습니다.`);
      return;
    }

    const ensuredPaths = resolveRolePolicyPaths(rolePolicies, role);

    setSavingRole(role);
    try {
      const batch = writeBatch(db);
      targetUsers.forEach((user) => {
        batch.update(doc(db, "users", user.id), {
          allowedPaths: ensuredPaths,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setMessage(
        `${roleOptions.find((option) => option.value === role)?.label || role} 역할의 ${targetUsers.length}명에게 기본 권한을 적용했습니다.`
      );
    } catch (error) {
      console.error("역할 기본 권한 일괄 적용 실패", error);
      setMessage("역할별 기본 권한을 적용하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingRole("");
    }
  };

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
    if (profile?.uid === user.id) {
      setMessage("현재 로그인한 관리자 계정은 역할을 변경할 수 없습니다. 다른 관리자에게 요청해주세요.");
      return;
    }

    const normalizedPaths = resolveRolePolicyPaths(rolePolicies, nextRole);
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
    const basePaths = resolveRolePolicyPaths(rolePolicies, user.role);
    await updateUserDocument(
      user.id,
      {
        allowedPaths: basePaths,
      },
      `${user.email || user.displayName} 님의 권한이 기본값으로 초기화되었습니다.`
    );
  };

  const configurableRoles = useMemo(
    () => roleOptions.filter((option) => option.value !== "admin"),
    [roleOptions]
  );
  const adminRoleLabel = roleOptions.find((option) => option.value === "admin")?.label;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">회원 및 권한 관리</h2>
        <p className="text-sm text-gray-400">
          각 회원별로 역할과 페이지 접근 범위를 설정할 수 있습니다. 멤버 또는 관리자 역할은 자동으로 포트폴리오 페이지 접근 권한이 추가됩니다.
        </p>
        <p className="text-xs text-gray-500">
          현재 페이지 {currentPage} / {totalPages} · 총 {users.length}명
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-white">역할별 기본 접근 권한</h3>
          <p className="text-sm text-gray-400">
            역할마다 기본으로 허용할 페이지를 설정할 수 있습니다. 저장 후에는 아래 버튼으로 해당 역할의 모든 사용자에게 일괄 적용할 수 있습니다.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {configurableRoles.map((roleOption) => {
            const rolePaths = resolveRolePolicyPaths(rolePolicies, roleOption.value);
            const rolePathSet = new Set(rolePaths.map(normalizePath));
            return (
              <article
                key={`role-policy-${roleOption.value}`}
                className="space-y-4 rounded-xl border border-gray-800 bg-gray-950/60 p-5"
              >
                <header className="space-y-1">
                  <h4 className="text-base font-semibold text-teal-200">{roleOption.label} 기본 권한</h4>
                  <p className="text-xs text-gray-400">
                    체크된 페이지는 {roleOption.label} 역할을 부여받은 계정에 기본으로 허용됩니다.
                  </p>
                </header>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MANAGEABLE_PAGES.map((page) => (
                    <label
                      key={`${roleOption.value}-${page.value}`}
                      className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/80 px-3 py-2 text-xs text-gray-200"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-teal-500 focus:ring-teal-500"
                        checked={rolePathSet.has(normalizePath(page.value))}
                        onChange={(event) =>
                          handleRolePolicyToggle(roleOption.value, page.value, event.target.checked)
                        }
                        disabled={savingRole === roleOption.value}
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
                <button
                  type="button"
                  onClick={() => handleApplyRolePolicy(roleOption.value)}
                  className="w-full rounded-lg border border-teal-500/60 bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-200 transition hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={savingRole === roleOption.value}
                >
                  {roleOption.label} 역할 계정에 기본 권한 적용
                </button>
              </article>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          {adminRoleLabel || "관리자"} 역할은 모든 페이지에 접근할 수 있도록 고정되어 있습니다.
        </p>
      </section>

      {users.length === 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-300">
          <p className="font-semibold text-white">아직 등록된 계정이 없습니다.</p>
          <p className="mt-2 text-gray-400">사용자가 Google 계정으로 로그인하면 자동으로 목록에 추가됩니다.</p>
        </div>
      )}

      {paginatedUsers.map((user) => {
        const isCurrentAdmin = profile?.uid === user.id;
        return (
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
                  disabled={updatingId === user.id || isCurrentAdmin}
                  title={
                    isCurrentAdmin
                      ? "현재 로그인한 관리자 계정은 여기에서 역할을 바꿀 수 없습니다."
                      : undefined
                  }
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {isCurrentAdmin && (
                  <p className="mt-2 text-[0.7rem] text-amber-300">
                    현재 로그인한 관리자 계정입니다. 역할 변경은 다른 관리자에게 요청해주세요.
                  </p>
                )}
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
        );
      })}

      {users.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalItems={users.length}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3"
        />
      )}
    </section>
  );
}
