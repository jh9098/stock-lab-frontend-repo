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

// src/BlogPostDetail.jsx (약 90번째 줄 return 부분을 교체하세요)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 py-8">
      <Helmet>
        <title>{post.title} - 지지저항 Lab</title>
        <meta name="description" content={post.summary} />
      </Helmet>

      {/* 
        이제 post.contentHtml이 직접 페이지의 메인 콘텐츠가 됩니다.
        HTML 내부에 포함된 반응형 스타일(<style> 태그)이 
        화면 너비에 따라 레이아웃을 자동으로 조정합니다.
      */}
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

      {/* 하단 버튼들은 글 내용과 분리하여 페이지 하단에 배치합니다. */}
      <div className="max-w-5xl mx-auto mt-12 text-center px-4 sm:px-6 pb-6">
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
