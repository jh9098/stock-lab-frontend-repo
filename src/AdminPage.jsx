// START OF FILE AdminPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './styles/custom-styles.css'; // 블로그 콘텐츠 스타일 재사용

// Firebase import
import { db, storage } from './firebaseConfig';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function AdminPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [message, setMessage] = useState('');

  // 블로그 글 작성/수정을 위한 상태값
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostAuthor, setNewPostAuthor] = useState('');
  const [newPostSummary, setNewPostSummary] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [editHtmlMode, setEditHtmlMode] = useState(false); // HTML 소스 코드 편집 모드 토글 (블로그용)
  const [editingPostId, setEditingPostId] = useState(null); // 수정 중인 글의 ID (null이면 새 글 작성)
  const [existingPosts, setExistingPosts] = useState([]); // 기존 블로그 글 목록
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);

  // === AI 요약 글 작성/수정을 위한 상태값 (추가 및 수정) ===
  const [newAiSummaryTitle, setNewAiSummaryTitle] = useState('');
  const [newAiSummaryContent, setNewAiSummaryContent] = useState('');
  const [aiSummaryEditHtmlMode, setAiSummaryEditHtmlMode] = useState(false); // HTML 소스 코드 편집 모드 토글 (AI 요약용)
  const [editingAiSummaryId, setEditingAiSummaryId] = useState(null); // 수정 중인 AI 요약의 ID
  const [existingAiSummaries, setExistingAiSummaries] = useState([]); // 기존 AI 요약 글 목록
  const [aiSummariesLoading, setAiSummariesLoading] = useState(true);
  const [aiSummariesError, setAiSummariesError] = useState(null);
  const aiSummaryQuillRef = useRef(null); // AI 요약 Quill 인스턴스 참조
  const aiSummaryFormRef = useRef(null); // AI 요약 폼으로 스크롤하기 위한 참조

  const quillRef = useRef(null); // 블로그 Quill 인스턴스 참조
  const blogFormRef = useRef(null); // 블로그 폼으로 스크롤하기 위한 참조 (이전 formRef 이름을 변경)

  // 간단한 관리자 비밀번호 (⚠️ 실제 서비스에서는 Firebase Authentication을 사용해야 합니다! 매우 중요!)
  const ADMIN_PASSWORD = '12345'; // <-- 여기에 당신의 실제 비밀번호 설정

  useEffect(() => {
    const savedLogin = sessionStorage.getItem('adminLoggedIn');
    if (savedLogin === 'true') {
      setLoggedIn(true);
    }
  }, []);

  // 기존 블로그 글 목록 불러오기
  const fetchExistingPosts = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const blogPostsCollection = collection(db, "blogPosts");
      const q = query(blogPostsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const posts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExistingPosts(posts);
    } catch (err) {
      console.error("기존 블로그 데이터를 불러오는 데 실패했습니다:", err);
      setPostsError("블로그 목록을 불러올 수 없습니다.");
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // === 기존 AI 요약 글 목록 불러오기 (추가) ===
  const fetchExistingAiSummaries = useCallback(async () => {
    setAiSummariesLoading(true);
    setAiSummariesError(null);
    try {
      const aiSummariesCollection = collection(db, "aiSummaries");
      const q = query(aiSummariesCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const summaries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExistingAiSummaries(summaries);
    } catch (err) {
      console.error("기존 AI 요약 데이터를 불러오는 데 실패했습니다:", err);
      setAiSummariesError("AI 요약 목록을 불러올 수 없습니다.");
    } finally {
      setAiSummariesLoading(false);
    }
  }, []);


  useEffect(() => {
    if (loggedIn) {
      fetchExistingPosts();
      fetchExistingAiSummaries(); // AI 요약 글도 함께 불러오기
    }
  }, [loggedIn, fetchExistingPosts, fetchExistingAiSummaries]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setLoggedIn(true);
      sessionStorage.setItem('adminLoggedIn', 'true');
      setMessage('로그인 성공! 데이터를 불러오는 중...');
    } else {
      setMessage('로그인 실패: 비밀번호를 확인해주세요.');
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    sessionStorage.removeItem('adminLoggedIn');
    setMessage('로그아웃되었습니다.');
    setPassword('');
    setExistingPosts([]); // 목록 초기화
    setExistingAiSummaries([]); // AI 요약 목록 초기화
  };

  // 이미지 업로드 핸들러 (ReactQuill 커스텀) - 블로그와 AI 요약 모두 사용 가능
  const imageHandler = useCallback((quillInstanceRef) => {
    return () => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();

      input.onchange = async () => {
        const file = input.files[0];
        if (file) {
          setMessage('이미지 업로드 중...');
          try {
            const storageRef = ref(storage, `content_images/${file.name}_${Date.now()}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setMessage(`업로드 진행률: ${progress.toFixed(2)}%`);
              },
              (error) => {
                console.error("이미지 업로드 실패:", error);
                setMessage('이미지 업로드 실패!');
              },
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const quillEditor = quillInstanceRef.current.getEditor();
                const range = quillEditor.getSelection();

                if (range) {
                  quillEditor.insertEmbed(range.index, 'image', downloadURL);
                  quillEditor.setSelection(range.index + 1);
                }
                setMessage('이미지 업로드 및 삽입 완료!');
              }
            );
          } catch (error) {
            console.error("파일 선택 또는 업로드 오류:", error);
            setMessage('이미지 업로드 오류 발생.');
          }
        }
      };
    }
  }, []);

  // ReactQuill 모듈 설정 (블로그용)
  const blogQuillModules = {
    toolbar: {
      container: [
        [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
        [{ size: [] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image', 'video'],
        ['clean']
      ],
      handlers: {
        image: imageHandler(quillRef) // 블로그용 QuillRef 전달
      }
    }
  };

  // ReactQuill 모듈 설정 (AI 요약용)
  const aiSummaryQuillModules = {
    toolbar: {
      container: [
        [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
        [{ size: [] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'], // AI 요약에는 비디오는 제외
        ['clean']
      ],
      handlers: {
        image: imageHandler(aiSummaryQuillRef) // AI 요약용 QuillRef 전달
      }
    }
  };


  // 새 블로그 글 작성 또는 수정 완료
  const handleSavePost = async () => {
    if (!newPostTitle || !newPostAuthor || !newPostSummary || !newPostContent) {
      setMessage('블로그 글: 모든 필드를 채워주세요.');
      return;
    }

    try {
      const postData = {
        title: newPostTitle,
        author: newPostAuthor,
        date: new Date().toISOString().split('T')[0], // 오늘 날짜 YYYY-MM-DD
        summary: newPostSummary,
        contentHtml: newPostContent,
        updatedAt: new Date(), // 업데이트 시간
      };

      if (editingPostId) {
        // 기존 글 수정
        const postRef = doc(db, "blogPosts", editingPostId);
        await updateDoc(postRef, postData);
        setMessage(`블로그 글이 성공적으로 수정되었습니다! ID: ${editingPostId}`);
      } else {
        // 새 글 생성
        const docRef = await addDoc(collection(db, "blogPosts"), {
          ...postData,
          createdAt: new Date(), // 생성 시간 (새 글에만)
        });
        setMessage(`블로그 글이 성공적으로 게시되었습니다! ID: ${docRef.id}`);
      }

      // 폼 초기화 및 목록 새로고침
      setNewPostTitle('');
      setNewPostAuthor('');
      setNewPostSummary('');
      setNewPostContent('');
      setEditingPostId(null);
      setEditHtmlMode(false); // 일반 에디터 모드로 전환
      await fetchExistingPosts(); // 목록 다시 불러오기
      // navigate('/blog'); // 블로그 목록 페이지로 이동 (선택 사항, 관리자 페이지에 머무는 것이 더 일반적)
    } catch (e) {
      console.error("Firestore 블로그 작업 실패:", e);
      setMessage(`블로그 글 ${editingPostId ? '수정' : '게시'} 실패.`);
    }
  };

  // "블로그 수정" 버튼 클릭 시
  const handleEditPost = (post) => {
    setEditingPostId(post.id);
    setNewPostTitle(post.title);
    setNewPostAuthor(post.author);
    setNewPostSummary(post.summary);
    setNewPostContent(post.contentHtml);
    setEditHtmlMode(false); // 항상 WYSIWYG 모드로 시작
    setMessage(`"${post.title}" 블로그 글을 수정 중입니다.`);
    blogFormRef.current?.scrollIntoView({ behavior: 'smooth' }); // 폼으로 스크롤
  };

  // "블로그 삭제" 버튼 클릭 시
  const handleDeletePost = async (postId, postTitle) => {
    if (window.confirm(`"${postTitle}" 블로그 글을 정말로 삭제하시겠습니까?`)) {
      try {
        await deleteDoc(doc(db, "blogPosts", postId));
        setMessage(`"${postTitle}" 블로그 글이 성공적으로 삭제되었습니다.`);
        await fetchExistingPosts(); // 목록 다시 불러오기
        // 만약 삭제된 글이 현재 수정 중인 글이라면 폼 초기화
        if (editingPostId === postId) {
          handleNewPost();
        }
      } catch (e) {
        console.error("Firestore 블로그 삭제 실패:", e);
        setMessage('블로그 글 삭제 실패.');
      }
    }
  };

  // "새 블로그 글 작성" 버튼 클릭 시
  const handleNewPost = () => {
    setEditingPostId(null);
    setNewPostTitle('');
    setNewPostAuthor('');
    setNewPostSummary('');
    setNewPostContent('');
    setEditHtmlMode(false);
    setMessage('새 블로그 글을 작성합니다.');
    blogFormRef.current?.scrollIntoView({ behavior: 'smooth' }); // 폼으로 스크롤
  };


  // === 새 AI 요약 글 작성 또는 수정 완료 (수정) ===
  const handleSaveAiSummary = async () => {
    if (!newAiSummaryTitle || !newAiSummaryContent) {
      setMessage('AI 요약: 제목과 내용을 채워주세요.');
      return;
    }

    try {
      const summaryData = {
        title: newAiSummaryTitle,
        contentHtml: newAiSummaryContent,
        date: new Date().toISOString().split('T')[0], // 오늘 날짜 YYYY-MM-DD
        updatedAt: new Date(),
      };

      if (editingAiSummaryId) {
        const summaryRef = doc(db, "aiSummaries", editingAiSummaryId);
        await updateDoc(summaryRef, summaryData);
        setMessage(`AI 요약이 성공적으로 수정되었습니다! ID: ${editingAiSummaryId}`);
      } else {
        const docRef = await addDoc(collection(db, "aiSummaries"), {
          ...summaryData,
          createdAt: new Date(),
        });
        setMessage(`AI 요약이 성공적으로 게시되었습니다! ID: ${docRef.id}`);
      }

      setNewAiSummaryTitle('');
      setNewAiSummaryContent('');
      setEditingAiSummaryId(null);
      setAiSummaryEditHtmlMode(false); // 일반 에디터 모드로 전환
      await fetchExistingAiSummaries(); // 목록 새로고침
      // navigate('/ai-summaries'); // AI 요약 목록 페이지로 이동 (선택 사항)
    } catch (e) {
      console.error("Firestore AI 요약 작업 실패:", e);
      setMessage(`AI 요약 ${editingAiSummaryId ? '수정' : '게시'} 실패.`);
    }
  };

  // "AI 요약 수정" 버튼 클릭 시
  const handleEditAiSummary = (summary) => {
    setEditingAiSummaryId(summary.id);
    setNewAiSummaryTitle(summary.title);
    setNewAiSummaryContent(summary.contentHtml);
    setMessage(`"${summary.title}" AI 요약을 수정 중입니다.`);
    setAiSummaryEditHtmlMode(false); // 항상 WYSIWYG 모드로 시작
    aiSummaryFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // "AI 요약 삭제" 버튼 클릭 시
  const handleDeleteAiSummary = async (summaryId, summaryTitle) => {
    if (window.confirm(`"${summaryTitle}" AI 요약을 정말로 삭제하시겠습니까?`)) {
      try {
        await deleteDoc(doc(db, "aiSummaries", summaryId));
        setMessage(`"${summaryTitle}" AI 요약이 성공적으로 삭제되었습니다.`);
        await fetchExistingAiSummaries();
        if (editingAiSummaryId === summaryId) {
          handleNewAiSummary();
        }
      } catch (e) {
        console.error("Firestore AI 요약 삭제 실패:", e);
        setMessage('AI 요약 삭제 실패.');
      }
    }
  };

  // "새 AI 요약 작성" 버튼 클릭 시
  const handleNewAiSummary = () => {
    setEditingAiSummaryId(null);
    setNewAiSummaryTitle('');
    setNewAiSummaryContent('');
    setMessage('새 AI 요약 글을 작성합니다.');
    setAiSummaryEditHtmlMode(false); // 일반 에디터 모드로 전환
    aiSummaryFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 py-8">
      <Helmet>
        <title>관리자 페이지 - 지지저항 Lab</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-blue-500 pb-2">관리자 페이지</h1>

        {!loggedIn ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-gray-300">관리자 비밀번호를 입력하세요.</p>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              로그인
            </button>
            {message && <p className="text-center text-sm text-red-400">{message}</p>}
          </form>
        ) : (
          <div className="space-y-8"> {/* 전체 공간 간격 조정 */}
            {/* 블로그 글 작성/수정 섹션 */}
            <section ref={blogFormRef} className="space-y-6 pb-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white">
                  {editingPostId ? '블로그 글 수정' : '새 블로그 글 작성'}
                </h2>
                <div className="flex space-x-2">
                  {editingPostId && (
                    <button
                      onClick={handleNewPost}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"
                    >
                      새 글 작성
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"
                  >
                    로그아웃
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-gray-300 text-sm font-bold mb-2">제목:</label>
                  <input
                    type="text"
                    id="title"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
                    placeholder="블로그 글 제목"
                  />
                </div>
                <div>
                  <label htmlFor="author" className="block text-gray-300 text-sm font-bold mb-2">작성자:</label>
                  <input
                    type="text"
                    id="author"
                    value={newPostAuthor}
                    onChange={(e) => setNewPostAuthor(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
                    placeholder="작성자 이름"
                  />
                </div>
                <div>
                  <label htmlFor="summary" className="block text-gray-300 text-sm font-bold mb-2">요약 (메타 설명용):</label>
                  <textarea
                    id="summary"
                    value={newPostSummary}
                    onChange={(e) => setNewPostSummary(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500 h-24"
                    placeholder="블로그 글을 요약해주세요 (검색엔진 노출 및 목록에서 사용)"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="content" className="block text-gray-300 text-sm font-bold mb-2">내용:</label>
                  {editHtmlMode ? (
                    <textarea
                      id="content"
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="w-full p-4 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500 h-96 font-mono resize-y"
                      placeholder="여기에 블로그 글의 HTML 소스 코드를 직접 입력하세요. (예: <h1>제목</h1><p>내용</p>)"
                    ></textarea>
                  ) : (
                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      value={newPostContent}
                      onChange={setNewPostContent}
                      modules={blogQuillModules} // 블로그용 모듈 사용
                      className="bg-gray-700 text-gray-100 quill-dark-theme"
                      placeholder="여기에 블로그 글 내용을 작성하세요. 이미지 버튼으로 파일을 업로드할 수 있습니다."
                    />
                  )}
                  <button
                      onClick={() => setEditHtmlMode(!editHtmlMode)}
                      className="mt-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded-md text-sm transition duration-300"
                  >
                      {editHtmlMode ? 'WYSIWYG 에디터로 전환' : 'HTML 소스 코드 편집'}
                  </button>
                  <p className="text-gray-500 text-xs mt-2">
                      이미지는 WYSIWYG 에디터 모드에서 이미지 버튼을 클릭하여 직접 업로드하면 Firebase Storage에 저장됩니다.<br/>
                  </p>
                </div>
                <button
                  onClick={handleSavePost}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
                >
                  {editingPostId ? '수정 완료 (Firebase에 저장)' : '블로그 글 게시 (Firebase에 저장)'}
                </button>
                {message && !message.startsWith('AI 요약') && <p className="text-center text-sm text-yellow-400 mt-2">{message}</p>}
              </div>
            </section>

            {/* 블로그 글 목록 섹션 */}
            <section className="space-y-4 pt-6 pb-6 border-b border-gray-700">
              <h2 className="text-2xl font-semibold text-white border-b-2 border-gray-700 pb-2">블로그 글 목록</h2>
              {postsLoading ? (
                <p className="text-gray-400 text-center">글 목록을 불러오는 중...</p>
              ) : postsError ? (
                <p className="text-red-400 text-center">{postsError}</p>
              ) : existingPosts.length === 0 ? (
                <p className="text-gray-400 text-center">작성된 블로그 글이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {existingPosts.map((post) => (
                    <div key={post.id} className="bg-gray-700 p-4 rounded-lg shadow-md flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-2">{post.title}</h3>
                        <p className="text-gray-400 text-sm mb-1">작성자: {post.author}</p>
                        <p className="text-gray-400 text-xs">작성일: {post.date}</p>
                      </div>
                      <div className="flex justify-end space-x-2 mt-4">
                        <Link to={`/blog/${post.id}`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300">
                          보기
                        </Link>
                        <button
                          onClick={() => handleEditPost(post)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* === AI 시장 이슈 요약 작성/수정 섹션 (수정) === */}
            <section ref={aiSummaryFormRef} className="space-y-6 pt-6 pb-6 border-b border-gray-700">
              <h2 className="text-2xl font-semibold text-white">
                {editingAiSummaryId ? 'AI 시장 이슈 요약 수정' : '새 AI 시장 이슈 요약 작성'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="aiSummaryTitle" className="block text-gray-300 text-sm font-bold mb-2">제목:</label>
                  <input
                    type="text"
                    id="aiSummaryTitle"
                    value={newAiSummaryTitle}
                    onChange={(e) => setNewAiSummaryTitle(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
                    placeholder="AI 요약 제목 (예: 2025-05-29 AI 시장 이슈 요약)"
                  />
                </div>
                {/* === AI 요약 내용 입력 필드 및 토글 버튼 추가 === */}
                <div>
                  <label htmlFor="aiSummaryContent" className="block text-gray-300 text-sm font-bold mb-2">내용:</label>
                  {aiSummaryEditHtmlMode ? (
                    <textarea
                      id="aiSummaryContentHtml" // ID 변경
                      value={newAiSummaryContent}
                      onChange={(e) => setNewAiSummaryContent(e.target.value)}
                      className="w-full p-4 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500 h-96 font-mono resize-y"
                      placeholder="여기에 AI 시장 이슈 요약의 HTML 소스 코드를 직접 입력하세요."
                    ></textarea>
                  ) : (
                    <ReactQuill
                      ref={aiSummaryQuillRef}
                      theme="snow"
                      value={newAiSummaryContent}
                      onChange={setNewAiSummaryContent}
                      modules={aiSummaryQuillModules} // AI 요약용 모듈 사용
                      className="bg-gray-700 text-gray-100 quill-dark-theme"
                      placeholder="여기에 AI 시장 이슈 요약 내용을 작성하세요. 차트 이미지 등을 포함할 수 있습니다."
                    />
                  )}
                  <button
                      onClick={() => setAiSummaryEditHtmlMode(!aiSummaryEditHtmlMode)}
                      className="mt-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded-md text-sm transition duration-300"
                  >
                      {aiSummaryEditHtmlMode ? 'WYSIWYG 에디터로 전환' : 'HTML 소스 코드 편집'}
                  </button>
                  <p className="text-gray-500 text-xs mt-2">
                    여기에 작성된 내용은 홈 화면의 'AI 기반 시장 이슈 요약' 섹션에 표시됩니다.
                  </p>
                </div>
                {/* === AI 요약 내용 입력 필드 및 토글 버튼 끝 === */}
                <button
                  onClick={handleSaveAiSummary}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
                >
                  {editingAiSummaryId ? '수정 완료 (Firebase에 저장)' : 'AI 요약 게시 (Firebase에 저장)'}
                </button>
                {message && message.startsWith('AI 요약') && <p className="text-center text-sm text-yellow-400 mt-2">{message}</p>}
              </div>
            </section>

            {/* === AI 시장 이슈 요약 목록 섹션 (추가) === */}
            <section className="space-y-4 pt-6">
              <h2 className="text-2xl font-semibold text-white border-b-2 border-gray-700 pb-2">AI 시장 이슈 요약 목록</h2>
              {aiSummariesLoading ? (
                <p className="text-gray-400 text-center">AI 요약 목록을 불러오는 중...</p>
              ) : aiSummariesError ? (
                <p className="text-red-400 text-center">{aiSummariesError}</p>
              ) : existingAiSummaries.length === 0 ? (
                <p className="text-gray-400 text-center">작성된 AI 요약 글이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {existingAiSummaries.map((summary) => (
                    <div key={summary.id} className="bg-gray-700 p-4 rounded-lg shadow-md flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-2">{summary.title}</h3>
                        <p className="text-gray-400 text-xs">작성일: {summary.date}</p>
                      </div>
                      <div className="flex justify-end space-x-2 mt-4">
                        <Link to={`/ai-summaries/${summary.id}`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300">
                          보기
                        </Link>
                        <button
                          onClick={() => handleEditAiSummary(summary)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteAiSummary(summary.id, summary.title)}
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>


            <div className="mt-8 text-center">
              <Link to="/blog" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
                블로그 목록 보기
              </Link>
              <Link to="/ai-summaries" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
                AI 요약 목록 보기
              </Link>
              <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// END OF FILE AdminPage.jsx