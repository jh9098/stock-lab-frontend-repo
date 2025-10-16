import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";
import PaginationControls from "../components/PaginationControls";

function formatDate(timestamp) {
  if (!timestamp) return "-";
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString("ko-KR");
  }
  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleString("ko-KR");
  }
  return String(timestamp);
}

export default function ConsultManager() {
  const { setMessage } = useAdminContext();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(posts.length / ITEMS_PER_PAGE));

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

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return posts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [posts, currentPage]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const consultQuery = query(collection(db, "consultRequests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(consultQuery);
      const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setPosts(docs);
      setCommentDrafts(
        docs.reduce((acc, current) => {
          acc[current.id] = current.expertComment ?? "";
          return acc;
        }, {})
      );
    } catch (err) {
      console.error("상담 게시글 불러오기 실패", err);
      setError("상담 게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDraftChange = (postId, value) => {
    setCommentDrafts((prev) => ({ ...prev, [postId]: value }));
  };

  const handleSaveComment = async (postId) => {
    const draft = commentDrafts[postId]?.trim();
    if (!draft) {
      setMessage("코멘트를 입력해주세요.");
      return;
    }
    try {
      await updateDoc(doc(db, "consultRequests", postId), {
        expertComment: draft,
        commentedAt: new Date(),
      });
      setMessage("코멘트가 저장되었습니다.");
      await fetchPosts();
    } catch (error) {
      console.error("코멘트 저장 실패", error);
      setMessage("코멘트를 저장하지 못했습니다.");
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("정말로 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "consultRequests", postId));
      setMessage("상담 요청이 삭제되었습니다.");
      await fetchPosts();
    } catch (error) {
      console.error("상담 요청 삭제 실패", error);
      setMessage("상담 요청 삭제에 실패했습니다.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">상담 게시판 관리</h2>
          <span className="text-sm text-gray-400">
            총 {posts.length}건 · 페이지 {currentPage} / {totalPages}
          </span>
        </div>
        <div className="divide-y divide-gray-800">
          {loading && <p className="px-6 py-4 text-sm text-gray-400">데이터를 불러오는 중입니다...</p>}
          {error && <p className="px-6 py-4 text-sm text-red-400">{error}</p>}
          {!loading && !posts.length && !error && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 상담 요청이 없습니다.</p>
          )}
          {paginatedPosts.map((post) => (
            <div key={post.id} className="px-6 py-4 space-y-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <h3 className="text-white font-semibold">{post.title}</h3>
                  <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500">작성자: {post.author ?? "익명"}</p>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                {post.content}
              </p>
              <div className="space-y-2">
                <label className="text-sm text-gray-300 font-medium">관리자 코멘트</label>
                <textarea
                  rows={3}
                  value={commentDrafts[post.id] ?? ""}
                  onChange={(event) => handleDraftChange(post.id, event.target.value)}
                  className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white"
                  placeholder="답변을 입력하세요"
                />
                {post.expertComment && (
                  <p className="text-xs text-teal-300">
                    마지막 저장: {formatDate(post.commentedAt)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveComment(post.id)}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm rounded-lg"
                  >
                    코멘트 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg"
                  >
                    요청 삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalItems={posts.length}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          className="rounded-b-xl border-t border-gray-800 bg-gray-950/60 px-6 py-4"
        />
      </div>
    </section>
  );
}
