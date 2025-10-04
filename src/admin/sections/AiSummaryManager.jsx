import { useCallback, useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";
import useQuillImageModules from "../components/useQuillImageModules";

const TOOLBAR = [
  [{ header: [1, 2, false] }],
  ["bold", "italic", "underline", "blockquote"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image"],
  ["clean"],
];

export default function AiSummaryManager() {
  const { setMessage } = useAdminContext();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [quillKey, setQuillKey] = useState(0);
  const quillRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    contentHtml: "",
  });

  const modules = useQuillImageModules(quillRef, setMessage, TOOLBAR);

  const resetForm = useCallback(() => {
    setForm({ title: "", contentHtml: "" });
    setEditingId(null);
    setQuillKey((prev) => prev + 1);
  }, []);

  const fetchSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryQuery = query(collection(db, "aiSummaries"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(summaryQuery);
      const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setSummaries(docs);
    } catch (err) {
      console.error("AI 요약 목록 불러오기 실패", err);
      setError("AI 요약 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleSubmit = async () => {
    if (!form.title || !form.contentHtml) {
      setMessage("AI 요약의 제목과 내용을 입력해주세요.");
      return;
    }

    const payload = {
      title: form.title,
      contentHtml: form.contentHtml,
      date: new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "aiSummaries", editingId), payload);
        setMessage("AI 요약이 수정되었습니다.");
      } else {
        await addDoc(collection(db, "aiSummaries"), {
          ...payload,
          createdAt: new Date(),
        });
        setMessage("새 AI 요약이 등록되었습니다.");
      }
      await fetchSummaries();
      resetForm();
    } catch (error) {
      console.error("AI 요약 저장 실패", error);
      setMessage("AI 요약 저장에 실패했습니다.");
    }
  };

  const handleEdit = (summary) => {
    setEditingId(summary.id);
    setForm({
      title: summary.title ?? "",
      contentHtml: summary.contentHtml ?? "",
    });
    setQuillKey((prev) => prev + 1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말로 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "aiSummaries", id));
      setMessage("AI 요약이 삭제되었습니다.");
      await fetchSummaries();
      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error("AI 요약 삭제 실패", error);
      setMessage("AI 요약 삭제에 실패했습니다.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{editingId ? "AI 요약 수정" : "새 AI 요약 작성"}</h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-300 hover:text-white underline"
            >
              새 글 작성으로 전환
            </button>
          )}
        </div>
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            제목
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
            />
          </label>
          <div className="space-y-2 text-sm text-gray-300">
            <span>요약 본문</span>
            <ReactQuill
              key={quillKey}
              ref={quillRef}
              value={form.contentHtml}
              onChange={(value) => setForm((prev) => ({ ...prev, contentHtml: value }))}
              modules={modules}
              className="bg-gray-950 rounded-lg"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg"
            >
              {editingId ? "수정 저장" : "글 게시"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">등록된 AI 요약</h3>
          <span className="text-sm text-gray-400">총 {summaries.length}건</span>
        </div>
        <div className="divide-y divide-gray-800">
          {loading && <p className="px-6 py-4 text-sm text-gray-400">데이터를 불러오는 중입니다...</p>}
          {error && <p className="px-6 py-4 text-sm text-red-400">{error}</p>}
          {!loading && !summaries.length && !error && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 AI 요약이 없습니다.</p>
          )}
          {summaries.map((summary) => (
            <div key={summary.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{summary.title}</p>
                <p className="text-xs text-gray-400">{summary.date ?? "작성일 미정"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(summary)}
                  className="px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(summary.id)}
                  className="px-3 py-1 text-sm rounded-lg bg-red-600 hover:bg-red-500"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
