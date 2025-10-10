// START OF FILE App.jsx (수정)

import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import BlogPostDetail from "./BlogPostDetail";
import RecommendationsPage from "./RecommendationsPage";
import ThemesPage from "./ThemesPage";
import ForumPage from "./ForumPage";
import ForumWritePage from "./ForumWritePage";
import ForumDetailPage from "./ForumDetailPage";
import PortfolioPage from "./PortfolioPage";
import CausalInference from "./pages/CausalInference";
import PopularStocksHistory from "./pages/PopularStocksHistory";
import ForeignNetBuyHistory from "./pages/ForeignNetBuyHistory";
import InstitutionNetBuyHistory from "./pages/InstitutionNetBuyHistory";
import MarketHistoryDashboard from "./pages/MarketHistoryDashboard";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/sections/AdminDashboard";
import BlogManager from "./admin/sections/BlogManager";
import StockAnalysisManager from "./admin/sections/StockAnalysisManager";
import ConsultManager from "./admin/sections/ConsultManager";
import PortfolioManager from "./admin/sections/PortfolioManager";
import MarketInsightsPage from "./MarketInsightsPage";
import ContentCommunityPage from "./ContentCommunityPage";
import CustomFeaturesPage from "./CustomFeaturesPage";
import SiteLayout from "./components/SiteLayout";
// NewsDetailPage는 이제 필요 없으므로 제거

function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/blog" element={<MarketInsightsPage />} />
        <Route path="/market-insights" element={<MarketInsightsPage />} />
        <Route path="/blog/:postId" element={<BlogPostDetail />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/themes" element={<ThemesPage />} />
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/forum/write" element={<ForumWritePage />} />
        <Route path="/forum/:postId" element={<ForumDetailPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/market-history" element={<MarketHistoryDashboard />} />
        <Route path="/popular-history" element={<PopularStocksHistory />} />
        <Route path="/foreign-net-buy-history" element={<ForeignNetBuyHistory />} />
        <Route path="/institution-net-buy-history" element={<InstitutionNetBuyHistory />} />
        <Route path="/content-community" element={<ContentCommunityPage />} />
        <Route path="/custom-features" element={<CustomFeaturesPage />} />
        <Route path="/causal" element={<CausalInference />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="blog" element={<BlogManager />} />
        <Route path="stocks" element={<StockAnalysisManager />} />
        <Route path="forum" element={<ConsultManager />} />
        <Route path="portfolio" element={<PortfolioManager />} />
      </Route>

      {/* NewsDetailPage 라우트는 이제 필요 없으므로 제거됩니다. */}
    </Routes>
  );
}

export default App;
// END OF FILE App.jsx