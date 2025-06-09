import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function ForumPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchPosts = async () => {
      const q = query(collection(db, 'consultRequests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(p);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const postsPerPage = 10;
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const paginated = posts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);

  if (loading) {
    return <div className="p-4 text-center text-gray-100">불러오는 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-5xl mx-auto py-8">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">종목 상담 게시판</h1>
        <Link to="/forum/write" className="bg-pink-600 px-3 py-1 rounded">새 글 작성</Link>
      </div>
      <div className="space-y-4">
        {paginated.map(post => (
          <div key={post.id} className="bg-gray-800 p-4 rounded">
            <Link to={`/forum/${post.id}`} className="text-lg text-pink-400 font-semibold">
              {post.title}
            </Link>
            {post.expertComment && <span className="ml-2 text-xs text-green-400">전문가 코멘트 완료</span>}
            <p className="text-sm text-gray-400">작성자: {post.author}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center space-x-2 mt-6">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
          <button
            key={num}
            onClick={() => setCurrentPage(num)}
            className={`px-3 py-1 rounded ${currentPage === num ? 'bg-pink-600' : 'bg-gray-700'}`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}
