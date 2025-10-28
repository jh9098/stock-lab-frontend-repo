import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
  startAt,
  endAt,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";
import PaginationControls from "../components/PaginationControls";
import useLatestStockPrices from "../../hooks/useLatestStockPrices";
import {
  STOCK_PRICE_COLLECTION,
  formatPriceTimestamp,
  formatPriceValue,
} from "../../lib/stockPriceUtils";

const WATCHLIST_COLLECTION = "adminWatchlist";
const STOCKS_COLLECTION = "stocks";

const emptyForm = {
  name: "",
  ticker: "",
  analysisId: "",
  memo: "",
  supportLinesText: "",
  resistanceLinesText: "",
  alertThresholdPercent: "5",
  alertCooldownHours: "6",
  isPublic: true,
  alertEnabled: true,
  portfolioReady: true,
};

const numberFormatter = new Intl.NumberFormat("ko-KR");

const parseNumberArray = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(/[\n,\s]+/)
    .map((item) => Number.parseFloat(item.replace(/[^0-9.\-]/g, "")))
    .filter((num) => Number.isFinite(num));
};

const formatNumberArray = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }

  return value.join(", ");
};

export default function WatchlistManager() {
  const { setMessage } = useAdminContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [analysisOptions, setAnalysisOptions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [stockSuggestions, setStockSuggestions] = useState({
    open: false,
    loading: false,
    items: [],
    error: null,
  });
  const closeSuggestionsTimeoutRef = useRef(null);
  const autocompleteBypassRef = useRef(false);
  const lastEditedFieldRef = useRef(null);
  const lastTickerLookupRef = useRef(null);

  const ITEMS_PER_PAGE = 20;

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setStockSuggestions({ open: false, loading: false, items: [], error: null });
    autocompleteBypassRef.current = false;
    lastEditedFieldRef.current = null;
    lastTickerLookupRef.current = null;
  }, []);

  useEffect(() => {
    const stockQuery = query(collection(db, STOCKS_COLLECTION), orderBy("createdAt", "desc"));

    getDocs(stockQuery)
      .then((snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setAnalysisOptions(docs);
      })
      .catch((fetchError) => {
        console.error("종목 분석 불러오기 실패", fetchError);
      });
  }, []);

  useEffect(() => {
    const watchlistQuery = query(
      collection(db, WATCHLIST_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      watchlistQuery,
      (snapshot) => {
        setLoading(false);
        setError(null);
        const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setItems(docs);
      },
      (listenError) => {
        console.error("관심 종목 구독 실패", listenError);
        setLoading(false);
        setError("관심 종목 데이터를 불러오지 못했습니다.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setCurrentPage((prev) => {
      const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
      if (prev > totalPages) return totalPages;
      if (prev < 1) return 1;
      return prev;
    });
  }, [items]);

  const watchlistTickers = useMemo(
    () =>
      items
        .map((item) => (item.ticker ?? "").trim().toUpperCase())
        .filter((value) => value),
    [items]
  );

  const { priceMap } = useLatestStockPrices(watchlistTickers);

  useEffect(() => {
    return () => {
      if (closeSuggestionsTimeoutRef.current) {
        clearTimeout(closeSuggestionsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const trimmedName = form.name.trim();

    if (autocompleteBypassRef.current) {
      autocompleteBypassRef.current = false;
      return;
    }

    if (!trimmedName) {
      setStockSuggestions((prev) => ({
        ...prev,
        loading: false,
        items: [],
        error: null,
      }));
      return;
    }

    setStockSuggestions((prev) => ({ ...prev, loading: true, error: null }));

    let active = true;
    const debounceTimer = setTimeout(async () => {
      try {
        const keyword = trimmedName;
        const nameQuery = query(
          collection(db, STOCK_PRICE_COLLECTION),
          orderBy("name"),
          startAt(keyword),
          endAt(`${keyword}${String.fromCharCode(0xf8ff)}`),
          limit(15)
        );
        const snapshot = await getDocs(nameQuery);
        if (!active) {
          return;
        }

        const suggestionItems = snapshot.docs.map((docSnap) => ({
          ticker: docSnap.id,
          name: docSnap.data()?.name ?? docSnap.id,
        }));

        const normalize = (value) => value.replace(/\s+/g, "").toLowerCase();
        const normalizedInput = normalize(trimmedName);
        const exactMatchDoc = snapshot.docs.find((docSnap) => {
          const candidate = docSnap.data()?.name ?? docSnap.id;
          if (!candidate) return false;
          return (
            normalize(candidate).localeCompare(normalizedInput, undefined, {
              sensitivity: "base",
            }) === 0
          );
        });

        if (exactMatchDoc) {
          autocompleteBypassRef.current = true;
          lastEditedFieldRef.current = null;
          lastTickerLookupRef.current = exactMatchDoc.id.trim().toUpperCase();
          setForm((prev) => ({
            ...prev,
            ticker: exactMatchDoc.id,
          }));
        }

        setStockSuggestions((prev) => ({
          ...prev,
          loading: false,
          items: suggestionItems,
          error: null,
        }));
      } catch (fetchError) {
        console.error("종목 자동완성 조회 실패", fetchError);
        if (active) {
          setStockSuggestions((prev) => ({
            ...prev,
            loading: false,
            error: "자동완성 결과를 불러오지 못했습니다.",
          }));
          setMessage("종목 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [form.name, setMessage]);

  useEffect(() => {
    const trimmedTicker = form.ticker.trim().toUpperCase();
    const trimmedName = form.name.trim();

    if (
      lastTickerLookupRef.current === trimmedTicker &&
      lastEditedFieldRef.current === "name" &&
      trimmedName === ""
    ) {
      return;
    }

    if (!trimmedTicker || trimmedName) {
      return;
    }

    let cancelled = false;

    const fetchTickerName = async () => {
      try {
        const priceDocRef = doc(db, STOCK_PRICE_COLLECTION, trimmedTicker);
        const docSnap = await getDoc(priceDocRef);
        if (cancelled) return;
        if (!docSnap.exists()) {
          setMessage("종목 코드를 다시 확인해주세요.");
          setStockSuggestions((prev) => ({
            ...prev,
            error: "해당 종목을 찾을 수 없습니다.",
          }));
          return;
        }
        const fetchedName = docSnap.data()?.name ?? "";
        if (fetchedName) {
          autocompleteBypassRef.current = true;
          lastTickerLookupRef.current = trimmedTicker;
          lastEditedFieldRef.current = null;
          setForm((prev) => ({
            ...prev,
            ticker: trimmedTicker,
            name: fetchedName,
          }));
          setStockSuggestions((prev) => ({ ...prev, error: null }));
        }
      } catch (tickerError) {
        console.error("종목 단일 조회 실패", tickerError);
        if (!cancelled) {
          setMessage("종목 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
          setStockSuggestions((prev) => ({
            ...prev,
            error: "종목 정보를 불러오지 못했습니다.",
          }));
        }
      }
    };

    fetchTickerName();

    return () => {
      cancelled = true;
    };
  }, [form.ticker, form.name, setMessage]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [items, currentPage]);

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));

  const handleEdit = useCallback((item) => {
    autocompleteBypassRef.current = true;
    lastEditedFieldRef.current = null;
    lastTickerLookupRef.current = (item.ticker ?? "").trim().toUpperCase() || null;
    setStockSuggestions({ open: false, loading: false, items: [], error: null });
    setEditingId(item.id);
    setForm({
      name: item.name ?? "",
      ticker: item.ticker ?? "",
      analysisId: item.analysisId ?? "",
      memo: item.memo ?? "",
      supportLinesText: formatNumberArray(item.supportLines),
      resistanceLinesText: formatNumberArray(item.resistanceLines),
      alertThresholdPercent:
        item.alertThresholdPercent !== undefined && item.alertThresholdPercent !== null
          ? String(item.alertThresholdPercent)
          : "5",
      alertCooldownHours:
        item.alertCooldownHours !== undefined && item.alertCooldownHours !== null
          ? String(item.alertCooldownHours)
          : "6",
      isPublic: Boolean(item.isPublic ?? true),
      alertEnabled: Boolean(item.alertEnabled ?? true),
      portfolioReady: Boolean(item.portfolioReady ?? true),
    });
  }, []);

  const handleFieldChange = useCallback((field, value) => {
    if (field === "name" || field === "ticker") {
      lastEditedFieldRef.current = field;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectSuggestion = useCallback((item) => {
    if (closeSuggestionsTimeoutRef.current) {
      clearTimeout(closeSuggestionsTimeoutRef.current);
      closeSuggestionsTimeoutRef.current = null;
    }
    autocompleteBypassRef.current = true;
    lastEditedFieldRef.current = null;
    lastTickerLookupRef.current = (item.ticker ?? "").trim().toUpperCase() || null;
    setForm((prev) => ({
      ...prev,
      name: item.name ?? "",
      ticker: item.ticker ?? "",
    }));
    setStockSuggestions({ open: false, loading: false, items: [], error: null });
  }, []);

  const handleDelete = useCallback(
    async (itemId) => {
      if (!window.confirm("정말로 삭제하시겠습니까?")) {
        return;
      }
      try {
        await deleteDoc(doc(db, WATCHLIST_COLLECTION, itemId));
        setMessage("관심 종목이 삭제되었습니다.");
        if (editingId === itemId) {
          resetForm();
        }
      } catch (deleteError) {
        console.error("관심 종목 삭제 실패", deleteError);
        setMessage("관심 종목 삭제에 실패했습니다.");
      }
    },
    [editingId, resetForm, setMessage]
  );

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      setMessage("종목명을 입력해주세요.");
      return;
    }

    if (!form.ticker.trim()) {
      setMessage("티커(종목 코드)를 입력해주세요.");
      return;
    }

    const supportLines = parseNumberArray(form.supportLinesText);
    const resistanceLines = parseNumberArray(form.resistanceLinesText);
    const alertThresholdPercent = Number.parseFloat(form.alertThresholdPercent);
    const alertCooldownHours = Number.parseFloat(form.alertCooldownHours);

    const payload = {
      name: form.name.trim(),
      ticker: form.ticker.trim().toUpperCase(),
      analysisId: form.analysisId ? form.analysisId : null,
      memo: form.memo.trim(),
      supportLines,
      resistanceLines,
      alertThresholdPercent: Number.isFinite(alertThresholdPercent) ? alertThresholdPercent : null,
      alertCooldownHours: Number.isFinite(alertCooldownHours) ? alertCooldownHours : null,
      isPublic: Boolean(form.isPublic),
      alertEnabled: Boolean(form.alertEnabled),
      portfolioReady: Boolean(form.portfolioReady),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, WATCHLIST_COLLECTION, editingId), payload);
        setMessage("관심 종목이 수정되었습니다.");
      } else {
        await addDoc(collection(db, WATCHLIST_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setMessage("새 관심 종목이 등록되었습니다.");
      }
      resetForm();
    } catch (submitError) {
      console.error("관심 종목 저장 실패", submitError);
      setMessage("관심 종목 저장에 실패했습니다.");
    }
  }, [editingId, form, resetForm, setMessage]);

  const handleToggleField = useCallback(async (item, field) => {
    try {
      await updateDoc(doc(db, WATCHLIST_COLLECTION, item.id), {
        [field]: !item[field],
        updatedAt: serverTimestamp(),
      });
      setMessage(`${item.name}의 ${field === "isPublic" ? "공개 여부" : field === "alertEnabled" ? "알림" : "포트폴리오 연동"} 설정이 변경되었습니다.`);
    } catch (toggleError) {
      console.error("관심 종목 설정 변경 실패", toggleError);
      setMessage("설정을 변경하지 못했습니다.");
    }
  }, [setMessage]);

  const handleSyncPortfolioStatus = useCallback(
    async (item) => {
      if (!item?.linkedPortfolioId) {
        setMessage("포트폴리오와 연동된 정보가 없습니다.");
        return;
      }

      try {
        const portfolioDoc = await getDoc(doc(db, "portfolioStocks", item.linkedPortfolioId));
        if (!portfolioDoc.exists()) {
          setMessage("연결된 포트폴리오 종목을 찾을 수 없습니다.");
          return;
        }

        const data = portfolioDoc.data();
        await updateDoc(doc(db, WATCHLIST_COLLECTION, item.id), {
          supportLines: Array.isArray(data.supportLines) ? data.supportLines : [],
          resistanceLines: Array.isArray(data.resistanceLines) ? data.resistanceLines : [],
          portfolioReady: false,
          updatedAt: serverTimestamp(),
        });
        setMessage("포트폴리오 정보를 반영했습니다.");
      } catch (syncError) {
        console.error("포트폴리오 동기화 실패", syncError);
        setMessage("포트폴리오 동기화에 실패했습니다.");
      }
    },
    [setMessage]
  );

  const handleRunAlertCheck = useCallback(async () => {
    try {
      const response = await fetch("/.netlify/functions/support-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`알림 점검 요청 실패: ${response.status}`);
      }

      const result = await response.json();
      setMessage(`알림 점검이 완료되었습니다. 새 알림 ${result?.createdAlerts ?? 0}건.`);
    } catch (runError) {
      console.error("알림 점검 호출 실패", runError);
      setMessage("알림 점검을 실행하지 못했습니다.");
    }
  }, [setMessage]);

  return (
    <section className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {editingId ? "관심 종목 수정" : "새 관심 종목 등록"}
            </h2>
            <p className="text-sm text-gray-400">
              관심 종목을 등록하고 지지선·저항선 및 알림 조건을 설정하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-300 hover:text-white underline"
              >
                새 관심 종목 등록
              </button>
            )}
            <button
              type="button"
              onClick={handleRunAlertCheck}
              className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-semibold hover:bg-teal-400"
            >
              지지선 알림 즉시 점검
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="relative flex flex-col gap-2 text-sm text-gray-300">
            종목명
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleFieldChange("name", event.target.value)}
              onFocus={() => {
                if (closeSuggestionsTimeoutRef.current) {
                  clearTimeout(closeSuggestionsTimeoutRef.current);
                  closeSuggestionsTimeoutRef.current = null;
                }
                setStockSuggestions((prev) => ({ ...prev, open: true }));
              }}
              onBlur={() => {
                closeSuggestionsTimeoutRef.current = setTimeout(() => {
                  setStockSuggestions((prev) => ({ ...prev, open: false }));
                  closeSuggestionsTimeoutRef.current = null;
                }, 150);
              }}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              />
            {stockSuggestions.open && (
              <ul className="absolute z-10 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
                {stockSuggestions.loading && (
                  <li className="px-3 py-2 text-xs text-gray-400">검색 중...</li>
                )}
                {!stockSuggestions.loading && stockSuggestions.error && (
                  <li className="px-3 py-2 text-xs text-red-400">{stockSuggestions.error}</li>
                )}
                {!stockSuggestions.loading && !stockSuggestions.error && !stockSuggestions.items.length && (
                  <li className="px-3 py-2 text-xs text-gray-400">일치하는 종목이 없습니다.</li>
                )}
                {stockSuggestions.items.map((item) => (
                  <li key={item.ticker} className="border-t border-gray-800 first:border-t-0">
                    <button
                      type="button"
                      onMouseDown={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                    >
                      <span className="font-medium text-white">{item.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{item.ticker}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            티커 / 종목 코드
            <input
              type="text"
              value={form.ticker}
              onChange={(event) => handleFieldChange("ticker", event.target.value)}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              placeholder="예: 005930"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300 md:col-span-2">
            분석 글 연결 (선택)
            <select
              value={form.analysisId}
              onChange={(event) => setForm((prev) => ({ ...prev, analysisId: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
            >
              <option value="">선택 안 함</option>
              {analysisOptions.map((analysis) => (
                <option key={analysis.id} value={analysis.id}>
                  {analysis.name || analysis.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300 md:col-span-2">
            메모 / 코멘트
            <textarea
              rows={3}
              value={form.memo}
              onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              placeholder="관심 이유, 모니터링 포인트 등을 입력하세요."
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            지지선 (콤마 또는 줄바꿈 구분)
            <textarea
              rows={3}
              value={form.supportLinesText}
              onChange={(event) => setForm((prev) => ({ ...prev, supportLinesText: event.target.value }))}
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              placeholder="예: 72000, 68000"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            저항선 (콤마 또는 줄바꿈 구분)
            <textarea
              rows={3}
              value={form.resistanceLinesText}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, resistanceLinesText: event.target.value }))
              }
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              placeholder="예: 82000, 86000"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            알림 임계값 (%)
            <input
              type="number"
              step="0.1"
              value={form.alertThresholdPercent}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, alertThresholdPercent: event.target.value }))
              }
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              placeholder="예: 3"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            알림 쿨다운 (시간)
            <input
              type="number"
              step="1"
              value={form.alertCooldownHours}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, alertCooldownHours: event.target.value }))
              }
              className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
              placeholder="예: 6"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-200">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-700 bg-gray-950"
            />
            공개 상태
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.alertEnabled}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, alertEnabled: event.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-700 bg-gray-950"
            />
            지지선 알림 활성화
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.portfolioReady}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, portfolioReady: event.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-700 bg-gray-950"
            />
            포트폴리오 편입 후보
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg"
          >
            {editingId ? "관심 종목 수정" : "관심 종목 등록"}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">등록된 관심 종목</h3>
            <p className="text-xs text-gray-400">
              총 {items.length}건 · 페이지 {currentPage} / {totalPages}
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-800">
          {loading && <p className="px-6 py-4 text-sm text-gray-400">데이터를 불러오는 중입니다...</p>}
          {error && <p className="px-6 py-4 text-sm text-red-400">{error}</p>}
          {!loading && !items.length && !error && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 관심 종목이 없습니다.</p>
          )}
          {paginatedItems.map((item) => {
            const supportText = Array.isArray(item.supportLines)
              ? item.supportLines.map((value) => `${numberFormatter.format(value)}원`).join(", ")
              : "-";
            const resistanceText = Array.isArray(item.resistanceLines)
              ? item.resistanceLines.map((value) => `${numberFormatter.format(value)}원`).join(", ")
              : "-";
            const tickerKey = (item.ticker ?? "").trim().toUpperCase();
            const priceInfo = tickerKey ? priceMap.get(tickerKey) ?? null : null;
            const priceValueText = formatPriceValue(priceInfo?.price) ?? "확인 불가";
            const priceTimestampText = priceInfo?.priceDate ? formatPriceTimestamp(priceInfo.priceDate) : null;

            return (
              <div key={item.id} className="px-6 py-4 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-lg font-semibold text-white">{item.name}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300">
                        {item.ticker}
                      </span>
                      {item.analysisId && (
                        <span className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-xs text-teal-200">
                          분석 연결됨
                        </span>
                      )}
                      {item.linkedPortfolioId && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                          포트폴리오 편입 완료
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      지지선: {supportText || "-"} · 저항선: {resistanceText || "-"}
                    </p>
                    <p className="text-xs text-gray-400">
                      현재가: <span className="text-gray-100">{priceValueText}</span>
                      {priceTimestampText && (
                        <span className="ml-2 text-[11px] text-gray-500">기준 {priceTimestampText}</span>
                      )}
                    </p>
                    {item.memo && <p className="text-sm text-gray-300">{item.memo}</p>}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      <span>알림 임계값: {item.alertThresholdPercent ?? "-"}%</span>
                      <span>쿨다운: {item.alertCooldownHours ?? "-"}시간</span>
                      {item.lastAlertAt && (
                        <span>
                          마지막 알림: {(() => {
                            try {
                              const date = item.lastAlertAt.toDate();
                              return date.toLocaleString("ko-KR");
                            } catch (err) {
                              return "-";
                            }
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="px-3 py-1 text-sm rounded-lg bg-red-600 hover:bg-red-500"
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleField(item, "isPublic")}
                      className="px-3 py-1 text-sm rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                    >
                      {item.isPublic ? "비공개" : "공개"} 전환
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleField(item, "alertEnabled")}
                      className="px-3 py-1 text-sm rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                    >
                      알림 {item.alertEnabled ? "중지" : "활성화"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleField(item, "portfolioReady")}
                      className="px-3 py-1 text-sm rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
                    >
                      {item.portfolioReady ? "후보 제외" : "후보 지정"}
                    </button>
                    {item.linkedPortfolioId && (
                      <button
                        type="button"
                        onClick={() => handleSyncPortfolioStatus(item)}
                        className="px-3 py-1 text-sm rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                      >
                        포트폴리오 동기화
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalItems={items.length}
          pageSize={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          className="rounded-b-xl border-t border-gray-800 bg-gray-950/60 px-6 py-4"
        />
      </div>
    </section>
  );
}
