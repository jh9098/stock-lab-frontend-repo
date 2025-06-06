import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom'; // ✅ useLocation 추가

// Firebase import
import { db } from './firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

export default function BlogListPage() {
  const [blogPosts, setBlogPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation(); // ✅ useLocation 훅 사용

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
  }, []); // 이펙트는 컴포넌트 마운트 시 한 번만 실행

  // ✅ Google AdSense 광고 단위 로드 로직 추가
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        // 현재 컴포넌트 내의 모든 'adsbygoogle' 클래스를 가진 <ins> 요소를 찾아 처리합니다.
        // data-ad-status="done" 속성이 없는 광고만 처리하여 중복 로드를 방지합니다.
        const adElements = document.querySelectorAll('ins.adsbygoogle:not([data-ad-status="done"])');
        adElements.forEach(adElement => {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
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
      {/* 원하는 위치에 이 div를 추가하세요. */}
      <div className="text-center my-8"> {/* 광고 상하 여백 및 중앙 정렬을 위해 div로 감쌈 */}
        <ins className="adsbygoogle"
             style={{ display: "block" }} // JSX 스타일 객체
             data-ad-client="ca-pub-1861160469675223"
             data-ad-slot="5922871900"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      {/* 광고 끝 */}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogPosts.map((post) => (
          <div key={post.id} className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300">
            <h2 className="text-xl font-semibold text-white mb-2">{post.title}</h2>
            <p className="text-gray-400 text-sm mb-3">작성일: {post.date} | 저자: {post.author}</p>
            <p className="text-300 text-sm">{post.summary}</p> {/* ⚠️ 여기 text-gray-300으로 변경 권장 */}
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
