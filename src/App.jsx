// START OF FILE App.jsx (수정)

import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import BlogListPage from "./BlogListPage";
import BlogPostDetail from "./BlogPostDetail";
import NewsPage from "./NewsPage";
import RecommendationsPage from "./RecommendationsPage";
import ThemesPage from "./ThemesPage";
import ForumPage from "./ForumPage";
import ForumWritePage from "./ForumWritePage";
import ForumDetailPage from "./ForumDetailPage";
import AdminPage from "./AdminPage";
import AiSummaryListPage from "./AiSummaryListPage";
import AiSummaryDetailPage from "./AiSummaryDetailPage";
// NewsDetailPage는 이제 필요 없으므로 제거

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/blog" element={<BlogListPage />} />
      <Route path="/blog/:postId" element={<BlogPostDetail />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/recommendations" element={<RecommendationsPage />} />
      <Route path="/themes" element={<ThemesPage />} />
      <Route path="/forum" element={<ForumPage />} />
      <Route path="/forum/write" element={<ForumWritePage />} />
      <Route path="/forum/:postId" element={<ForumDetailPage />} />
      <Route path="/admin" element={<AdminPage />} />

      {/* AI 시장 이슈 요약 관련 라우트 */}
      <Route path="/ai-summaries" element={<AiSummaryListPage />} />
      <Route path="/ai-summaries/:summaryId" element={<AiSummaryDetailPage />} />

      {/* NewsDetailPage 라우트는 이제 필요 없으므로 제거됩니다. */}
    </Routes>
  );
}

export default App;
// END OF FILE App.jsx