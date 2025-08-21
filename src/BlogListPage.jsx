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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const location = useLocation();

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        const blogPostsCollection = collection(db, "blogPosts");
        const q = query(blogPostsCollection, orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);
        const posts = querySnapshot.docs.map(doc => ({
          id: doc.id,
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  /* 광고 코드 주석 처리
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        if (window.adsbygoogle.length > 0) {
           window.adsbygoogle.length = 0;
        }
        const adElements = document.querySelectorAll('ins.adsbygoogle');
        adElements.forEach(adElement => {
            (window.adsbygoogle || []).push({});
        });
      } catch (e) {
        console.error("AdSense push error in BlogListPage:", e);
      }
    }
  }, [location.pathname]);
  */

  const postsPerPage = 10;

  const filteredPosts = blogPosts.filter(post => {
    const t = searchTerm.toLowerCase();
    return (
      post.title.toLowerCase().includes(t) ||
      (post.summary && post.summary.toLowerCase().includes(t))
    );
  });

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage) || 1;
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

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

      {/**
      <div className="text-center my-8" key={location.pathname}>
        <ins className="adsbygoogle"
             style={{ display: "block" }}
             data-ad-client="ca-pub-1861160469675223"
             data-ad-slot="5922871900"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      */}

      <div className="mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="검색어를 입력하세요"
          className="w-full md:w-1/2 p-2 rounded bg-gray-800 text-gray-100 border border-gray-700"
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedPosts.length > 0 ? (
          paginatedPosts.map((post) => (
            <div key={post.id} className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h2 className="text-xl font-semibold text-white mb-2">{post.title}</h2>
              <p className="text-gray-400 text-sm mb-3">작성일: {post.date} | 저자: {post.author}</p>
              <p className="text-gray-300 text-sm">{post.summary}</p>
              <Link to={`/blog/${post.id}`} className="text-green-400 hover:text-green-300 mt-4 inline-block">전체 내용 보기 →</Link>
            </div>
          ))
        ) : (
          <p className="text-gray-400 col-span-full text-center">검색 결과가 없습니다.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`px-3 py-1 rounded ${currentPage === num ? 'bg-green-600' : 'bg-gray-700'}`}
            >
              {num}
            </button>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
