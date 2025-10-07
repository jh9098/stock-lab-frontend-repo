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
import AiSummaryListPage from "./AiSummaryListPage";
import AiSummaryDetailPage from "./AiSummaryDetailPage";
import PortfolioPage from "./PortfolioPage";
import CausalInference from "./pages/CausalInference";
import PopularStocksHistory from "./pages/PopularStocksHistory";
import ForeignNetBuyHistory from "./pages/ForeignNetBuyHistory";
import InstitutionNetBuyHistory from "./pages/InstitutionNetBuyHistory";
import MarketHistoryDashboard from "./pages/MarketHistoryDashboard";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/sections/AdminDashboard";
import BlogManager from "./admin/sections/BlogManager";
import AiSummaryManager from "./admin/sections/AiSummaryManager";
import StockAnalysisManager from "./admin/sections/StockAnalysisManager";
import ConsultManager from "./admin/sections/ConsultManager";
import PortfolioManager from "./admin/sections/PortfolioManager";
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
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="blog" element={<BlogManager />} />
        <Route path="ai-summaries" element={<AiSummaryManager />} />
        <Route path="stocks" element={<StockAnalysisManager />} />
        <Route path="forum" element={<ConsultManager />} />
        <Route path="portfolio" element={<PortfolioManager />} />
      </Route>
      <Route path="/causal" element={<CausalInference />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/market-history" element={<MarketHistoryDashboard />} />
      <Route path="/popular-history" element={<PopularStocksHistory />} />
      <Route path="/foreign-net-buy-history" element={<ForeignNetBuyHistory />} />
      <Route path="/institution-net-buy-history" element={<InstitutionNetBuyHistory />} />

      {/* AI 시장 이슈 요약 관련 라우트 */}
      <Route path="/ai-summaries" element={<AiSummaryListPage />} />
      <Route path="/ai-summaries/:summaryId" element={<AiSummaryDetailPage />} />

      {/* NewsDetailPage 라우트는 이제 필요 없으므로 제거됩니다. */}
    </Routes>
  );
}

export default App;
// END OF FILE App.jsx