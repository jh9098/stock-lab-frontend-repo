// START OF FILE App.jsx (수정)

import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import BlogPostDetail from "./BlogPostDetail";
import RecommendationsPage from "./RecommendationsPage";
import ForumPage from "./ForumPage";
import ForumWritePage from "./ForumWritePage";
import ForumDetailPage from "./ForumDetailPage";
import PortfolioPage from "./PortfolioPage";
import CausalInference from "./pages/CausalInference";
import PopularStocksHistory from "./pages/PopularStocksHistory";
import ForeignNetBuyHistory from "./pages/ForeignNetBuyHistory";
import InstitutionNetBuyHistory from "./pages/InstitutionNetBuyHistory";
import MarketHistoryDashboard from "./pages/MarketHistoryDashboard";
import ThemeRankHistoryPage from "./pages/ThemeRankHistoryPage";
import PublicWatchlistPage from "./pages/PublicWatchlistPage";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/sections/AdminDashboard";
import BlogManager from "./admin/sections/BlogManager";
import StockAnalysisManager from "./admin/sections/StockAnalysisManager";
import ConsultManager from "./admin/sections/ConsultManager";
import PortfolioManager from "./admin/sections/PortfolioManager";
import WatchlistManager from "./admin/sections/WatchlistManager";
import MarketInsightsPage from "./MarketInsightsPage";
import ContentCommunityPage from "./ContentCommunityPage";
import CustomFeaturesPage from "./CustomFeaturesPage";
import SiteLayout from "./components/SiteLayout";
import AccessGuard from "./components/AccessGuard";
import UserAccessManager from "./admin/sections/UserAccessManager";
// NewsDetailPage는 이제 필요 없으므로 제거

function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route
          path="/"
          element={
            <AccessGuard pathKey="/">
              <Home />
            </AccessGuard>
          }
        />
        <Route
          path="/blog"
          element={
            <AccessGuard pathKey="/blog">
              <MarketInsightsPage />
            </AccessGuard>
          }
        />
        <Route
          path="/market-insights"
          element={
            <AccessGuard pathKey="/market-insights">
              <MarketInsightsPage />
            </AccessGuard>
          }
        />
        <Route
          path="/blog/:postId"
          element={
            <AccessGuard pathKey="/blog/*">
              <BlogPostDetail />
            </AccessGuard>
          }
        />
        <Route
          path="/recommendations"
          element={
            <AccessGuard pathKey="/recommendations">
              <RecommendationsPage />
            </AccessGuard>
          }
        />
        <Route
          path="/watchlist"
          element={
            <AccessGuard pathKey="/watchlist" requiresAuth>
              <PublicWatchlistPage />
            </AccessGuard>
          }
        />
        <Route
          path="/forum"
          element={
            <AccessGuard pathKey="/forum">
              <ForumPage />
            </AccessGuard>
          }
        />
        <Route
          path="/forum/write"
          element={
            <AccessGuard pathKey="/forum/write">
              <ForumWritePage />
            </AccessGuard>
          }
        />
        <Route
          path="/forum/:postId"
          element={
            <AccessGuard pathKey="/forum/*">
              <ForumDetailPage />
            </AccessGuard>
          }
        />
        <Route
          path="/portfolio"
          element={
            <AccessGuard pathKey="/portfolio" requiresAuth>
              <PortfolioPage />
            </AccessGuard>
          }
        />
        <Route
          path="/market-history"
          element={
            <AccessGuard pathKey="/market-history">
              <MarketHistoryDashboard />
            </AccessGuard>
          }
        />
        <Route
          path="/theme-rank-history"
          element={
            <AccessGuard pathKey="/theme-rank-history">
              <ThemeRankHistoryPage />
            </AccessGuard>
          }
        />
        <Route
          path="/popular-history"
          element={
            <AccessGuard pathKey="/popular-history">
              <PopularStocksHistory />
            </AccessGuard>
          }
        />
        <Route
          path="/foreign-net-buy-history"
          element={
            <AccessGuard pathKey="/foreign-net-buy-history">
              <ForeignNetBuyHistory />
            </AccessGuard>
          }
        />
        <Route
          path="/institution-net-buy-history"
          element={
            <AccessGuard pathKey="/institution-net-buy-history">
              <InstitutionNetBuyHistory />
            </AccessGuard>
          }
        />
        <Route
          path="/content-community"
          element={
            <AccessGuard pathKey="/content-community">
              <ContentCommunityPage />
            </AccessGuard>
          }
        />
        <Route
          path="/custom-features"
          element={
            <AccessGuard pathKey="/custom-features">
              <CustomFeaturesPage />
            </AccessGuard>
          }
        />
        <Route
          path="/causal"
          element={
            <AccessGuard pathKey="/causal">
              <CausalInference />
            </AccessGuard>
          }
        />
      </Route>

      <Route
        path="/admin"
        element={
          <AccessGuard pathKey="/admin" requiresAuth allowedRoles={["admin"]}>
            <AdminLayout />
          </AccessGuard>
        }
      >
        <Route
          index
          element={
            <AccessGuard pathKey="/admin" requiresAuth allowedRoles={["admin"]}>
              <AdminDashboard />
            </AccessGuard>
          }
        />
        <Route
          path="users"
          element={
            <AccessGuard pathKey="/admin/*" requiresAuth allowedRoles={["admin"]}>
              <UserAccessManager />
            </AccessGuard>
          }
        />
        <Route
          path="blog"
          element={
            <AccessGuard pathKey="/admin/*" requiresAuth allowedRoles={["admin"]}>
              <BlogManager />
            </AccessGuard>
          }
        />
        <Route
          path="stocks"
          element={
            <AccessGuard pathKey="/admin/*" requiresAuth allowedRoles={["admin"]}>
              <StockAnalysisManager />
            </AccessGuard>
          }
        />
        <Route
          path="forum"
          element={
            <AccessGuard pathKey="/admin/*" requiresAuth allowedRoles={["admin"]}>
              <ConsultManager />
            </AccessGuard>
          }
        />
        <Route
          path="portfolio"
          element={
            <AccessGuard pathKey="/admin/*" requiresAuth allowedRoles={["admin"]}>
              <PortfolioManager />
            </AccessGuard>
          }
        />
        <Route
          path="watchlist"
          element={
            <AccessGuard pathKey="/admin/*" requiresAuth allowedRoles={["admin"]}>
              <WatchlistManager />
            </AccessGuard>
          }
        />
      </Route>

      {/* NewsDetailPage 라우트는 이제 필요 없으므로 제거됩니다. */}
    </Routes>
  );
}

export default App;
// END OF FILE App.jsx