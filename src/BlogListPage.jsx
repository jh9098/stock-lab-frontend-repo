import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';

// Firebase import
import { db } from './firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

export default function BlogListPage() {
  const [blogPosts, setBlogPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        const blogPostsCollection = collection(db, "blogPosts");
        // 날짜 최신순으로 정렬
        const q = query(blogPostsCollection, orderBy("createdAt", "desc")); // AdminPage에서 createdAt 필드 사용

        const querySnapshot = await getDocs(q);
        const posts = querySnapshot.docs.map(doc => ({
          id: doc.id, // Firestore 문서 ID를 글 ID로 사용
          ...doc.data()
        }));
        setBlogPosts(posts);
        setLoading(false);
      } catch (err) {
        console.error("블로그 데이터를 불러오는 데 실패했습니다:", err);
        setError("블로그 데이터를 불러올 수 없습니다.");
        setLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  // ✅ Google AdSense 광고 단위 로드 로직 (수정된 부분)
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        // 🚨 중요: AdSense 큐를 명시적으로 비워주는 코드 추가
        // 이전에 푸시된 광고 요청을 초기화하여 중복 로딩 오류 방지
        window.adsbygoogle = window.adsbygoogle || [];
        if (window.adsbygoogle.length > 0) {
          window.adsbygoogle.length = 0; // 큐를 비웁니다.
        }

        // 현재 컴포넌트 내의 모든 'adsbygoogle' 클래스를 가진 <ins> 요소를 찾아 처리합니다.
        // 큐를 비웠기 때문에 data-ad-status="done" 조건은 덜 중요해지지만, 여전히 좋은 습관입니다.
        const adElements = document.querySelectorAll('ins.adsbygoogle:not([data-ad-status="done"])');
        adElements.forEach(adElement => {
            (window.adsbygoogle || []).push({}); // 비워진 큐에 새로운 요청 추가
        });
      } catch (e) {
        console.error("AdSense push error in BlogListPage:", e);
      }
    }
  }, [location.pathname]); // React Router 경로가 변경될 때마다 다시 시도 (SPA에서 중요)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8 flex justify-center items-center">
        <p className="text-xl">블로그 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
        <p className="text-xl text-red-500 text-center">{error}</p>
        <div className="mt-12 text-center">
          <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
      <Helmet>
        <title>블로그 목록 - 지지저항 Lab</title>
        <meta name="description" content="지지저항 Lab의 최신 블로그 포스트들을 확인하세요." />
      </Helmet>
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-green-500 pb-2">최신 블로그 포스트</h1>
      <p className="text-gray-300 mb-8">실전 투자 전략, 시장 분석 팁, 그리고 투자 심리 관리에 대한 심도 깊은 블로그 포스트들을 확인하세요.</p>

      {/* ✅ Google AdSense 인스트림 광고 단위 (추가된 부분) */}
      <div className="text-center my-8">
        <ins className="adsbygoogle"
             style={{ display: "block" }}
             data-ad-client="ca-pub-1861160469675223"
             data-ad-slot="5922871900" // BlogListPage용 슬롯 ID
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      {/* 광고 끝 */}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogPosts.map((post) => (
          <div key={post.id} className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-semibold text-white mb-2">{post.title}</h2>
            <p className="text-gray-400 text-sm mb-3">작성일: {post.date} | 저자: {post.author}</p>
            <p className="text-gray-300 text-sm">{post.summary}</p>
            <Link to={`/blog/${post.id}`} className="text-green-400 hover:text-green-300 mt-4 inline-block">전체 내용 보기 →</Link>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
