// START OF FILE frontend/src/AdminPage.jsx (수정: ReactQuill 'delta' 오류 해결)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './styles/custom-styles.css';

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
  const [editHtmlMode, setEditHtmlMode] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [existingPosts, setExistingPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);

  // AI 요약 글 작성/수정을 위한 상태값
  const [newAiSummaryTitle, setNewAiSummaryTitle] = useState('');
  const [newAiSummaryContent, setNewAiSummaryContent] = useState('');
  const [aiSummaryEditHtmlMode, setAiSummaryEditHtmlMode] = useState(false);
  const [editingAiSummaryId, setEditingAiSummaryId] = useState(null);
  const [existingAiSummaries, setExistingAiSummaries] = useState([]);
  const [aiSummariesLoading, setAiSummariesLoading] = useState(true);
  const [aiSummariesError, setAiSummariesError] = useState(null);

  // === 종목 분석 글 작성/수정을 위한 상태값 (종목 코드 제거, 상태/수익률 추가) ===
  const [newStockAnalysisName, setNewStockAnalysisName] = useState('');
  const [newStockAnalysisStrategy, setNewStockAnalysisStrategy] = useState(''); // 매매전략 설명
  const [newStockAnalysisDetail, setNewStockAnalysisDetail] = useState(''); // 종목설명
  const [newStockAnalysisStatus, setNewStockAnalysisStatus] = useState('진행중'); // 💡 상태 추가 (기본값 진행중)
  const [newStockAnalysisReturnRate, setNewStockAnalysisReturnRate] = useState(''); // 💡 수익률 추가
  const [editingStockAnalysisId, setEditingStockAnalysisId] = useState(null); // 수정 중인 종목 분석의 ID
  const [existingStockAnalyses, setExistingStockAnalyses] = useState([]); // 기존 종목 분석 목록
  const [stockAnalysesLoading, setStockAnalysesLoading] = useState(true);
  const [stockAnalysesError, setStockAnalysesError] = useState(null);

  const quillRef = useRef(null);
  const blogFormRef = useRef(null);
  const aiSummaryQuillRef = useRef(null);
  const aiSummaryFormRef = useRef(null);
  const stockAnalysisFormRef = useRef(null); // 종목 분석 폼 참조 추가

  // API 서버 주소 (Render 백엔드 앱의 URL)
  const API_BASE_URL = 'https://stock-lab-backend-repo.onrender.com'; // Render 배포 후 얻게 되는 실제 URL로 변경

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

  // 기존 AI 요약 글 목록 불러오기
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

  // === 기존 종목 분석 목록 불러오기 (추가) ===
  const fetchExistingStockAnalyses = useCallback(async () => {
    setStockAnalysesLoading(true);
    setStockAnalysesError(null);
    try {
      const stockAnalysesCollection = collection(db, "stocks"); // 'stocks' 컬렉션 사용
      const q = query(stockAnalysesCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const analyses = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExistingStockAnalyses(analyses);
    } catch (err) {
      console.error("기존 종목 분석 데이터를 불러오는 데 실패했습니다:", err);
      setStockAnalysesError("종목 분석 목록을 불러올 수 없습니다.");
    } finally {
      setStockAnalysesLoading(false);
    }
  }, []);


  useEffect(() => {
    if (loggedIn) {
      fetchExistingPosts();
      fetchExistingAiSummaries();
      fetchExistingStockAnalyses(); // 종목 분석 목록도 함께 불러오기
    }
  }, [loggedIn, fetchExistingPosts, fetchExistingAiSummaries, fetchExistingStockAnalyses]);

  // 관리자 로그인 핸들러 (백엔드 연동)
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('로그인 시도 중...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify({ password: password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLoggedIn(true);
          sessionStorage.setItem('adminLoggedIn', 'true');
          setMessage('로그인 성공! 데이터를 불러오는 중...');
        } else {
          setMessage(`로그인 실패: ${data.message || '비밀번호를 확인해주세요.'}`);
        }
      } else {
        const errorData = await response.json();
        setMessage(`로그인 실패: ${errorData.message || '서버 오류 발생'}`);
      }
    } catch (error) {
      console.error("로그인 API 호출 오류:", error);
      setMessage('로그인 중 네트워크 오류가 발생했습니다.');
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    sessionStorage.removeItem('adminLoggedIn');
    setMessage('로그아웃되었습니다.');
    setPassword('');
    setExistingPosts([]);
    setExistingAiSummaries([]);
    setExistingStockAnalyses([]); // 종목 분석 목록 초기화
  };

  // 이미지 업로드 핸들러 (기존과 동일)
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

  // ReactQuill 모듈 설정 (블로그용) - 기존과 동일
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
        image: imageHandler(quillRef)
      }
    }
  };

  // ReactQuill 모듈 설정 (AI 요약용) - 기존과 동일
  const aiSummaryQuillModules = {
    toolbar: {
      container: [
        [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
        [{ size: [] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imageHandler(aiSummaryQuillRef)
      }
    }
  };


  // 새 블로그 글 작성 또는 수정 완료 (기존과 동일)
  const handleSavePost = async () => {
    if (!newPostTitle || !newPostAuthor || !newPostSummary || !newPostContent) {
      setMessage('블로그 글: 모든 필드를 채워주세요.');
      return;
    }

    try {
      const postData = {
        title: newPostTitle,
        author: newPostAuthor,
        date: new Date().toISOString().split('T')[0],
        summary: newPostSummary,
        contentHtml: newPostContent,
        updatedAt: new Date(),
      };

      if (editingPostId) {
        const postRef = doc(db, "blogPosts", editingPostId);
        await updateDoc(postRef, postData);
        setMessage(`블로그 글이 성공적으로 수정되었습니다! ID: ${editingPostId}`);
      } else {
        const docRef = await addDoc(collection(db, "blogPosts"), {
          ...postData,
          createdAt: new Date(),
        });
        setMessage(`블로그 글이 성공적으로 게시되었습니다! ID: ${docRef.id}`);
      }

      setNewPostTitle('');
      setNewPostAuthor('');
      setNewPostSummary('');
      setNewPostContent('');
      setEditingPostId(null);
      setEditHtmlMode(false);
      await fetchExistingPosts();
    } catch (e) {
      console.error("Firestore 블로그 작업 실패:", e);
      setMessage(`블로그 글 ${editingPostId ? '수정' : '게시'} 실패.`);
    }
  };

  // "블로그 수정" 버튼 클릭 시 (ReactQuill 'delta' 오류 해결)
  const handleEditPost = (post) => {
    setEditingPostId(post.id);
    setNewPostTitle(post.title);
    setNewPostAuthor(post.author);
    setNewPostSummary(post.summary);
    // 💡 수정: String()을 사용하여 어떤 값이든 문자열로 강제 변환
    setNewPostContent(String(post.contentHtml || '')); 
    setEditHtmlMode(false);
    setMessage(`"${post.title}" 블로그 글을 수정 중입니다.`);
    blogFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // "블로그 삭제" 버튼 클릭 시 (기존과 동일)
  const handleDeletePost = async (postId, postTitle) => {
    if (window.confirm(`"${postTitle}" 블로그 글을 정말로 삭제하시겠습니까?`)) {
      try {
        await deleteDoc(doc(db, "blogPosts", postId));
        setMessage(`"${postTitle}" 블로그 글이 성공적으로 삭제되었습니다.`);
        await fetchExistingPosts();
        if (editingPostId === postId) {
          handleNewPost();
        }
      } catch (e) {
          console.error("Firestore 블로그 삭제 실패:", e);
          setMessage('블로그 글 삭제 실패.');
      }
    }
  };

  // "새 블로그 글 작성" 버튼 클릭 시 (기존과 동일)
  const handleNewPost = () => {
    setEditingPostId(null);
    setNewPostTitle('');
    setNewPostAuthor('');
    setNewPostSummary('');
    setNewPostContent('');
    setEditHtmlMode(false);
    setMessage('새 블로그 글을 작성합니다.');
    blogFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  // 새 AI 요약 글 작성 또는 수정 완료 (기존과 동일)
  const handleSaveAiSummary = async () => {
    if (!newAiSummaryTitle || !newAiSummaryContent) {
      setMessage('AI 요약: 제목과 내용을 채워주세요.');
      return;
    }

    try {
      const summaryData = {
        title: newAiSummaryTitle,
        contentHtml: newAiSummaryContent,
        date: new Date().toISOString().split('T')[0],
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
      setAiSummaryEditHtmlMode(false);
      await fetchExistingAiSummaries();
    } catch (e) {
      console.error("Firestore AI 요약 작업 실패:", e);
      setMessage(`AI 요약 ${editingAiSummaryId ? '수정' : '게시'} 실패.`);
    }
  };

  // "AI 요약 수정" 버튼 클릭 시 (ReactQuill 'delta' 오류 해결)
  const handleEditAiSummary = (summary) => {
    setEditingAiSummaryId(summary.id);
    setNewAiSummaryTitle(summary.title);
    // 💡 수정: String()을 사용하여 어떤 값이든 문자열로 강제 변환
    setNewAiSummaryContent(String(summary.contentHtml || '')); 
    setMessage(`"${summary.title}" AI 요약을 수정 중입니다.`);
    setAiSummaryEditHtmlMode(false);
    aiSummaryFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // "AI 요약 삭제" 버튼 클릭 시 (기존과 동일)
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

  // "새 AI 요약 작성" 버튼 클릭 시 (기존과 동일)
  const handleNewAiSummary = () => {
    setEditingAiSummaryId(null);
    setNewAiSummaryTitle('');
    setNewAiSummaryContent('');
    setMessage('새 AI 요약 글을 작성합니다.');
    setAiSummaryEditHtmlMode(false);
    aiSummaryFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // === 새 종목 분석 작성 또는 수정 완료 (종목 코드 제거, 상태/수익률 추가) ===
  const handleSaveStockAnalysis = async () => {
    // 💡 newStockAnalysisStatus 추가 검사
    if (!newStockAnalysisName || !newStockAnalysisStrategy || !newStockAnalysisDetail || !newStockAnalysisStatus) {
      setMessage('종목 분석: 모든 필수 필드를 채워주세요.');
      return;
    }

    try {
      const stockData = {
        name: newStockAnalysisName,
        strategy: newStockAnalysisStrategy,
        detail: newStockAnalysisDetail,
        status: newStockAnalysisStatus, // 💡 상태 저장
        returnRate: newStockAnalysisReturnRate, // 💡 수익률 저장
        date: new Date().toISOString().split('T')[0], // 오늘 날짜 YYYY-MM-DD
        updatedAt: new Date(),
      };

      if (editingStockAnalysisId) {
        const stockRef = doc(db, "stocks", editingStockAnalysisId);
        await updateDoc(stockRef, stockData);
        setMessage(`종목 분석이 성공적으로 수정되었습니다! ID: ${editingStockAnalysisId}`);
      } else {
        const docRef = await addDoc(collection(db, "stocks"), {
          ...stockData,
          createdAt: new Date(),
        });
        setMessage(`종목 분석이 성공적으로 게시되었습니다! ID: ${docRef.id}`);
      }

      // 폼 초기화 및 목록 새로고침
      setNewStockAnalysisName('');
      setNewStockAnalysisStrategy('');
      setNewStockAnalysisDetail('');
      setNewStockAnalysisStatus('진행중'); // 💡 상태 초기화
      setNewStockAnalysisReturnRate(''); // 💡 수익률 초기화
      setEditingStockAnalysisId(null);
      await fetchExistingStockAnalyses(); // 목록 다시 불러오기
    } catch (e) {
      console.error("Firestore 종목 분석 작업 실패:", e);
      setMessage(`종목 분석 ${editingStockAnalysisId ? '수정' : '게시'} 실패.`);
    }
  };

  // "종목 분석 수정" 버튼 클릭 시 (종목 코드 제거, 상태/수익률 추가)
  const handleEditStockAnalysis = (analysis) => {
    setEditingStockAnalysisId(analysis.id);
    setNewStockAnalysisName(analysis.name);
    setNewStockAnalysisStrategy(analysis.strategy);
    setNewStockAnalysisDetail(analysis.detail);
    setNewStockAnalysisStatus(analysis.status || '진행중'); // 💡 상태 불러오기
    setNewStockAnalysisReturnRate(analysis.returnRate || ''); // 💡 수익률 불러오기
    setMessage(`"${analysis.name}" 종목 분석을 수정 중입니다.`);
    stockAnalysisFormRef.current?.scrollIntoView({ behavior: 'smooth' }); // 폼으로 스크롤
  };

  // "종목 분석 삭제" 버튼 클릭 시 (추가)
  const handleDeleteStockAnalysis = async (analysisId, analysisName) => {
    if (window.confirm(`"${analysisName}" 종목 분석을 정말로 삭제하시겠습니까?`)) {
      try {
        await deleteDoc(doc(db, "stocks", analysisId)); // 'stocks' 컬렉션 사용
        setMessage(`"${analysisName}" 종목 분석이 성공적으로 삭제되었습니다.`);
        await fetchExistingStockAnalyses(); // 목록 다시 불러오기
        if (editingStockAnalysisId === analysisId) {
          handleNewStockAnalysis();
        }
      } catch (e) {
        console.error("Firestore 종목 분석 삭제 실패:", e);
        setMessage('종목 분석 삭제 실패.');
      }
    }
  };

  // "새 종목 분석 작성" 버튼 클릭 시 (종목 코드 제거, 상태/수익률 추가)
  const handleNewStockAnalysis = () => {
    setEditingStockAnalysisId(null);
    setNewStockAnalysisName('');
    setNewStockAnalysisStrategy('');
    setNewStockAnalysisDetail('');
    setNewStockAnalysisStatus('진행중'); // 💡 상태 초기화
    setNewStockAnalysisReturnRate(''); // 💡 수익률 초기화
    setMessage('새 종목 분석을 작성합니다.');
    stockAnalysisFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 💡 종목 분석 상태 변경 핸들러
  const handleStockAnalysisStatusChange = async (analysisId, currentStatus, currentReturnRate, analysisName) => {
    const statuses = ['진행중', '목표달성', '손절'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    let newReturnRate = currentReturnRate;

    // 목표달성/손절 상태로 변경 시 수익률 입력 프롬프트
    if (nextStatus === '목표달성' || nextStatus === '손절') {
      const input = prompt(`"${analysisName}" 종목의 상태를 "${nextStatus}"(으)로 변경합니다. 수익률을 입력해주세요 (예: +10.5%, -5%):`, currentReturnRate || '');
      if (input === null) { // 사용자가 취소한 경우
        return;
      }
      newReturnRate = input.trim();
    } else { // 진행중으로 변경 시 수익률 초기화
      newReturnRate = '';
    }

    try {
      const stockRef = doc(db, "stocks", analysisId);
      await updateDoc(stockRef, { 
        status: nextStatus,
        returnRate: newReturnRate,
        updatedAt: new Date(),
      });
      setMessage(`"${analysisName}" 종목의 상태가 "${nextStatus}"(으)로 변경되었습니다. 수익률: ${newReturnRate}`);
      await fetchExistingStockAnalyses(); // 목록 새로고침
    } catch (e) {
      console.error("종목 분석 상태 업데이트 실패:", e);
      setMessage('종목 분석 상태 업데이트 실패.');
    }
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
          <div className="space-y-8">
            <div className="flex justify-end mb-4">
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"
              >
                로그아웃
              </button>
            </div>
            {message && <p className="text-center text-sm text-yellow-400 mb-4">{message}</p>} {/* 로그인 후 메시지 */}

            {/* 블로그 글 작성/수정 섹션 */}
            <section ref={blogFormRef} className="space-y-6 pb-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white">
                  {editingPostId ? '블로그 글 수정' : '새 블로그 글 작성'}
                </h2>
                {editingPostId && (
                  <button
                    onClick={handleNewPost}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"
                  >
                    새 글 작성
                  </button>
                )}
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
                      modules={blogQuillModules}
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

            {/* AI 시장 이슈 요약 작성/수정 섹션 */}
            <section ref={aiSummaryFormRef} className="space-y-6 pt-6 pb-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white">
                  {editingAiSummaryId ? 'AI 시장 이슈 요약 수정' : '새 AI 시장 이슈 요약 작성'}
                </h2>
                {editingAiSummaryId && (
                  <button
                    onClick={handleNewAiSummary}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"
                  >
                    새 글 작성
                  </button>
                )}
              </div>

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
                <div>
                  <label htmlFor="aiSummaryContent" className="block text-gray-300 text-sm font-bold mb-2">내용:</label>
                  {aiSummaryEditHtmlMode ? (
                    <textarea
                      id="aiSummaryContentHtml"
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
                      modules={aiSummaryQuillModules}
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
                <button
                  onClick={handleSaveAiSummary}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
                >
                  {editingAiSummaryId ? '수정 완료 (Firebase에 저장)' : 'AI 요약 게시 (Firebase에 저장)'}
                </button>
              </div>
            </section>

            {/* AI 시장 이슈 요약 목록 섹션 */}
            <section className="space-y-4 pt-6 pb-6 border-b border-gray-700">
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

            {/* === 종목 분석 작성/수정 섹션 (종목 코드 제거, 상태/수익률 추가) === */}
            <section ref={stockAnalysisFormRef} className="space-y-6 pt-6 pb-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white">
                  {editingStockAnalysisId ? '종목 분석 수정' : '새 종목 분석 작성'}
                </h2>
                {editingStockAnalysisId && (
                  <button
                    onClick={handleNewStockAnalysis}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"
                  >
                    새 글 작성
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="stockName" className="block text-gray-300 text-sm font-bold mb-2">종목명:</label>
                  <input
                    type="text"
                    id="stockName"
                    value={newStockAnalysisName}
                    onChange={(e) => setNewStockAnalysisName(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
                    placeholder="예: 삼성전자"
                  />
                </div>
                <div>
                  <label htmlFor="stockStrategy" className="block text-gray-300 text-sm font-bold mb-2">매매전략 설명:</label>
                  <textarea
                    id="stockStrategy"
                    value={newStockAnalysisStrategy}
                    onChange={(e) => setNewStockAnalysisStrategy(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500 h-24"
                    placeholder="예: 매수 38000원, 목표 42000원, 손절 37000원. 주봉상 저항 돌파 후 지지 확인."
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="stockDetail" className="block text-gray-300 text-sm font-bold mb-2">종목 설명:</label>
                  <textarea
                    id="stockDetail"
                    value={newStockAnalysisDetail}
                    onChange={(e) => setNewStockAnalysisDetail(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500 h-32"
                    placeholder="예: AI 반도체 관련주로 최근 강한 상승세를 보였으며, 실적 기대감 유효."
                  ></textarea>
                </div>
                {/* 💡 상태 선택 필드 추가 */}
                <div>
                  <label htmlFor="stockStatus" className="block text-gray-300 text-sm font-bold mb-2">상태:</label>
                  <select
                    id="stockStatus"
                    value={newStockAnalysisStatus}
                    onChange={(e) => setNewStockAnalysisStatus(e.target.value)}
                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="진행중">진행중</option>
                    <option value="목표달성">목표달성</option>
                    <option value="손절">손절</option>
                  </select>
                </div>
                {/* 💡 수익률 입력 필드 추가 (상태가 목표달성 또는 손절일 때만 표시) */}
                {(newStockAnalysisStatus === '목표달성' || newStockAnalysisStatus === '손절') && (
                  <div>
                    <label htmlFor="stockReturnRate" className="block text-gray-300 text-sm font-bold mb-2">수익률:</label>
                    <input
                      type="text"
                      id="stockReturnRate"
                      value={newStockAnalysisReturnRate}
                      onChange={(e) => setNewStockAnalysisReturnRate(e.target.value)}
                      className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-blue-500"
                      placeholder="예: +10.5% 또는 -5%"
                    />
                  </div>
                )}
                <button
                  onClick={handleSaveStockAnalysis}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300"
                >
                  {editingStockAnalysisId ? '수정 완료 (Firebase에 저장)' : '종목 분석 게시 (Firebase에 저장)'}
                </button>
              </div>
            </section>

            {/* === 종목 분석 목록 섹션 (종목 코드 제거, 상태/수익률 표시 및 변경 버튼 추가) === */}
            <section className="space-y-4 pt-6">
              <h2 className="text-2xl font-semibold text-white border-b-2 border-gray-700 pb-2">종목 분석 목록</h2>
              {stockAnalysesLoading ? (
                <p className="text-gray-400 text-center">종목 목록을 불러오는 중...</p>
              ) : stockAnalysesError ? (
                <p className="text-red-400 text-center">{stockAnalysesError}</p>
              ) : existingStockAnalyses.length === 0 ? (
                <p className="text-gray-400 text-center">작성된 종목 분석이 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* lg:grid-cols-3 제거 (아이템당 공간 더 필요) */}
                  {existingStockAnalyses.map((analysis) => {
                    let statusBadgeClass = 'bg-blue-500 text-blue-100';
                    if (analysis.status === '목표달성') {
                      statusBadgeClass = 'bg-green-500 text-green-100';
                    } else if (analysis.status === '손절') {
                      statusBadgeClass = 'bg-red-500 text-red-100';
                    }
                    
                    return (
                      <div key={analysis.id} className="bg-gray-700 p-4 rounded-lg shadow-md flex flex-col justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">{analysis.name}</h3>
                          <p className="text-gray-400 text-sm mb-1">등록일: {analysis.date}</p>
                          <p className="text-gray-400 text-sm mb-1">전략: {analysis.strategy}</p>
                          <p className="text-gray-400 text-sm mb-1">설명: {analysis.detail}</p>
                          {/* 💡 상태 및 수익률 표시 */}
                          <p className="text-gray-400 text-sm mt-2">
                            상태: <span className={`${statusBadgeClass} text-xs font-semibold px-2.5 py-0.5 rounded-full`}>
                              {analysis.status || '진행중'}
                            </span>
                            {analysis.returnRate && <span className="ml-2">수익률: {analysis.returnRate}</span>}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end space-x-2 mt-4">
                          <button
                            onClick={() => handleStockAnalysisStatusChange(analysis.id, analysis.status, analysis.returnRate, analysis.name)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                          >
                            상태 변경
                          </button>
                          <button
                            onClick={() => handleEditStockAnalysis(analysis)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteStockAnalysis(analysis.id, analysis.name)}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md text-xs transition duration-300"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
