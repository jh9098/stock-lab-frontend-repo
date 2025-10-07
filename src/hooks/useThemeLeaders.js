import { useCallback, useState } from "react";
import fallbackData from "../data/themeLeadersFallback.json";

const normalizeItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    ...item,
    id: item.themeCode || `${item.name}-${index}`,
    leaders: Array.isArray(item.leaders) ? item.leaders : [],
  }));
};

export default function useThemeLeaders() {
  const [themes, setThemes] = useState(() => normalizeItems(fallbackData.items));
  const [updatedAt, setUpdatedAt] = useState(
    fallbackData.asOfLabel || fallbackData.asOf || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const fetchLatestThemes = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const response = await fetch("/.netlify/functions/theme-leaders");
      const rawText = await response.text();
      let payload = null;

      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (parseError) {
          console.error("[useThemeLeaders] JSON 파싱 실패", parseError);
        }
      }

      if (!response.ok) {
        const message =
          (payload && (payload.error || payload.message)) ||
          `테마 정보를 불러오지 못했습니다. (HTTP ${response.status})`;
        throw new Error(message);
      }

      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error("테마 데이터를 찾을 수 없습니다.");
      }

      setThemes(normalizeItems(payload.items));
      setUpdatedAt(payload.asOfLabel || payload.asOf || "");
      setInfoMessage("최신 테마 데이터를 불러왔습니다.");
    } catch (error) {
      console.error("[useThemeLeaders] fetchLatestThemes 실패", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "테마 데이터를 불러오는 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    themes,
    updatedAt,
    isLoading,
    errorMessage,
    infoMessage,
    fetchLatestThemes,
    setErrorMessage,
    setInfoMessage,
  };
}
