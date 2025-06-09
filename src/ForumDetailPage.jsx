import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function ForumDetailPage() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      const snap = await getDoc(doc(db, 'consultRequests', postId));
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };
    fetchPost();
  }, [postId]);

  if (loading) {
    return <div className="p-4 text-center text-gray-100">불러오는 중...</div>;
  }
  if (!post) {
    return <div className="p-4 text-center text-red-500">글을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
      <p className="text-sm text-gray-400 mb-6">작성자: {post.author}</p>
      <p className="whitespace-pre-wrap mb-8">{post.content}</p>
      {post.expertComment && (
        <div className="bg-gray-800 p-4 rounded mb-8">
          <h2 className="font-semibold mb-2">전문가 코멘트</h2>
          <p className="whitespace-pre-wrap">{post.expertComment}</p>
        </div>
      )}
      <Link to="/forum" className="px-4 py-2 bg-gray-600 rounded">목록으로</Link>
    </div>
  );
}
