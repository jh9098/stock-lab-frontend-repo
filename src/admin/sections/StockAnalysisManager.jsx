import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";

const STATUS_OPTIONS = [
  { value: "진행중", label: "진행중" },
  { value: "목표달성", label: "목표 달성" },
  { value: "손절", label: "손절" },
];

export default function StockAnalysisManager() {
  const { setMessage } = useAdminContext();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    strategy: "",
    detail: "",
    status: "진행중",
    returnRate: "",
  });

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stockQuery = query(collection(db, "stocks"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(stockQuery);
      const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setAnalyses(docs);
    } catch (err) {
      console.error("종목 분석 목록 불러오기 실패", err);
      setError("종목 분석 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const resetForm = useCallback(() => {
    setForm({ name: "", strategy: "", detail: "", status: "진행중", returnRate: "" });
    setEditingId(null);
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.strategy || !form.detail) {
      setMessage("종목명, 전략, 상세 설명을 모두 입력해주세요.");
      return;
    }

    const payload = {
      name: form.name,
      strategy: form.strategy,
      detail: form.detail,
      status: form.status,
      returnRate: form.returnRate,
      updatedAt: new Date(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "stocks", editingId), payload);
        setMessage("종목 분석이 수정되었습니다.");
      } else {
        await addDoc(collection(db, "stocks"), {
          ...payload,
          createdAt: new Date(),
        });
        setMessage("새 종목 분석이 등록되었습니다.");
      }
      await fetchAnalyses();
      resetForm();
    } catch (error) {
      console.error("종목 분석 저장 실패", error);
      setMessage("종목 분석 저장에 실패했습니다.");
    }
  };

  const handleEdit = (analysis) => {
    setEditingId(analysis.id);
    setForm({
      name: analysis.name ?? "",
      strategy: analysis.strategy ?? "",
      detail: analysis.detail ?? "",
      status: analysis.status ?? "진행중",
      returnRate: analysis.returnRate ?? "",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말로 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "stocks", id));
      setMessage("종목 분석이 삭제되었습니다.");
      await fetchAnalyses();
      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error("종목 분석 삭제 실패", error);
      setMessage("종목 분석 삭제에 실패했습니다.");
    }
  };

  const handleStatusChange = async (analysis, nextStatus) => {
    try {
      await updateDoc(doc(db, "stocks", analysis.id), {
        status: nextStatus,
        updatedAt: new Date(),
      });
      setMessage(`${analysis.name}의 상태가 "${nextStatus}"(으)로 변경되었습니다.`);
      await fetchAnalyses();
    } catch (error) {
      console.error("종목 분석 상태 변경 실패", error);
      setMessage("상태 변경에 실패했습니다.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{editingId ? "종목 분석 수정" : "새 종목 분석 작성"}</h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-300 hover:text-white underline"
            >
              새 분석 작성으로 전환
            </button>
          )}
        </div>
        <div className="grid gap-4">
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            종목명
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            전략 요약
            <textarea
              rows={3}
              value={form.strategy}
              onChange={(event) => setForm((prev) => ({ ...prev, strategy: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            상세 설명
            <textarea
              rows={6}
              value={form.detail}
              onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
            />
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 text-sm text-gray-300">
              상태
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
              누적 수익률 (%)
              <input
                type="number"
                step="0.1"
                value={form.returnRate}
                onChange={(event) => setForm((prev) => ({ ...prev, returnRate: event.target.value }))}
                className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                placeholder="예: 12.5"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg"
            >
              {editingId ? "수정 저장" : "분석 게시"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">등록된 종목 분석</h3>
          <span className="text-sm text-gray-400">총 {analyses.length}건</span>
        </div>
        <div className="divide-y divide-gray-800">
          {loading && <p className="px-6 py-4 text-sm text-gray-400">데이터를 불러오는 중입니다...</p>}
          {error && <p className="px-6 py-4 text-sm text-red-400">{error}</p>}
          {!loading && !analyses.length && !error && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 종목 분석이 없습니다.</p>
          )}
          {analyses.map((analysis) => (
            <div key={analysis.id} className="px-6 py-4 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-white font-semibold">{analysis.name}</p>
                  <p className="text-xs text-gray-400">상태: {analysis.status ?? "진행중"}</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={analysis.status ?? "진행중"}
                    onChange={(event) => handleStatusChange(analysis, event.target.value)}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-1 text-sm text-white"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleEdit(analysis)}
                    className="px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(analysis.id)}
                    className="px-3 py-1 text-sm rounded-lg bg-red-600 hover:bg-red-500"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-300">{analysis.strategy}</p>
              <p className="text-sm text-gray-400">{analysis.detail}</p>
              {analysis.returnRate && (
                <p className="text-xs text-teal-300">누적 수익률: {analysis.returnRate}%</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
