import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import './styles/custom-styles.css'; // 변경된 CSS 파일 임포트

// Firebase import
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function BlogPostDetail() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBlogPost = async () => {
      try {
        const docRef = doc(db, "blogPosts", postId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPost({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("해당 블로그 글을 찾을 수 없습니다.");
        }
        setLoading(false);
      } catch (err) {
        console.error("블로그 데이터를 불러오는 데 실패했습니다:", err);
        setError("블로그 데이터를 불러올 수 없습니다.");
        setLoading(false);
      }
    };

    fetchBlogPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8 flex justify-center items-center">
        <p className="text-xl">블로그 글을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
        <p className="text-xl text-red-500 text-center">{error}</p>
        <div className="mt-12 text-center">
          <Link to="/blog" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            블로그 목록으로 돌아가기
          </Link>
          <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
        <p className="text-xl text-red-500 text-center">블로그 글을 찾을 수 없습니다.</p>
        <div className="mt-12 text-center">
          <Link to="/blog" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            블로그 목록으로 돌아가기
          </Link>
          <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

// src/BlogPostDetail.jsx (약 47번째 줄)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 py-8">
      <Helmet>
        <title>{post.title} - 지지저항 Lab</title>
        <meta name="description" content={post.summary} />
      </Helmet>

      {/* 블로그 글 전체를 감싸는 카드 형태의 div */}
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* 블로그 포스트 상세 제목 영역 (카드 상단 헤더) */}
        <div className="px-6 pt-6 pb-2 border-b-2 border-green-500">
          <h1 className="text-3xl font-bold text-white">블로그 포스트 상세</h1>
          {/* 원본 HTML의 제목 밑 저자/시간 정보가 원본 블로그 글 HTML 내부에 있으므로 여기서 다시 추가하지 않습니다. */}
        </div>

        {/* dangerouslySetInnerHTML을 사용하여 HTML 본문 렌더링 */}
        {/* 이 div는 이제 .blog-article 클래스를 가진 <article> 태그를 자식으로 가집니다. */}
        {/* .blog-article이 max-width, margin, padding을 모두 가집니다. */}
        <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

        {/* 하단 버튼들 */}
        <div className="mt-12 text-center px-6 pb-6 border-t border-gray-700"> {/* 하단 영역에 패딩 추가 */}
          <Link to="/blog" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            블로그 목록으로 돌아가기
          </Link>
          <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}