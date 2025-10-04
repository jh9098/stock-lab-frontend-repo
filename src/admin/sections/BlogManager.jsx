import { useCallback, useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";
import useQuillImageModules from "../components/useQuillImageModules";

export default function BlogManager() {
  const { setMessage } = useAdminContext();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [quillKey, setQuillKey] = useState(0);
  const quillRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    author: "",
    summary: "",
    contentHtml: "",
  });

  const modules = useQuillImageModules(quillRef, setMessage);

  const resetForm = useCallback(() => {
    setForm({ title: "", author: "", summary: "", contentHtml: "" });
    setEditingId(null);
    setQuillKey((prev) => prev + 1);
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blogQuery = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(blogQuery);
      const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setPosts(docs);
    } catch (err) {
      console.error("블로그 목록 불러오기 실패", err);
      setError("블로그 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmit = async () => {
    if (!form.title || !form.author || !form.summary || !form.contentHtml) {
      setMessage("블로그 글의 모든 필드를 채워주세요.");
      return;
    }

    const payload = {
      title: form.title,
      author: form.author,
      summary: form.summary,
      contentHtml: form.contentHtml,
      updatedAt: new Date(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "blogPosts", editingId), payload);
        setMessage("블로그 글이 수정되었습니다.");
      } else {
        await addDoc(collection(db, "blogPosts"), {
          ...payload,
          createdAt: new Date(),
        });
        setMessage("새 블로그 글이 등록되었습니다.");
      }
      await fetchPosts();
      resetForm();
    } catch (error) {
      console.error("블로그 글 저장 실패", error);
      setMessage("블로그 글 저장에 실패했습니다.");
    }
  };

  const handleEdit = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title ?? "",
      author: post.author ?? "",
      summary: post.summary ?? "",
      contentHtml: post.contentHtml ?? "",
    });
    setQuillKey((prev) => prev + 1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("정말로 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "blogPosts", id));
      setMessage("블로그 글이 삭제되었습니다.");
      await fetchPosts();
      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error("블로그 글 삭제 실패", error);
      setMessage("블로그 글 삭제에 실패했습니다.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{editingId ? "블로그 글 수정" : "새 블로그 글 작성"}</h2>
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
        <div className="grid gap-4">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 text-sm text-gray-300">
              제목
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
              작성자
              <input
                type="text"
                value={form.author}
                onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
                className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            요약
            <textarea
              rows={3}
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
            />
          </label>
          <div className="space-y-2 text-sm text-gray-300">
            <span>본문</span>
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
          <h3 className="text-lg font-semibold text-white">등록된 블로그 글</h3>
          <span className="text-sm text-gray-400">총 {posts.length}건</span>
        </div>
        <div className="divide-y divide-gray-800">
          {loading && <p className="px-6 py-4 text-sm text-gray-400">데이터를 불러오는 중입니다...</p>}
          {error && <p className="px-6 py-4 text-sm text-red-400">{error}</p>}
          {!loading && !posts.length && !error && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 블로그 글이 없습니다.</p>
          )}
          {posts.map((post) => (
            <div key={post.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{post.title}</p>
                <p className="text-xs text-gray-400">{post.author} · {post.date ?? "작성일 미정"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(post)}
                  className="px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(post.id)}
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
