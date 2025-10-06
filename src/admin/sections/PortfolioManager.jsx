import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  limit,
  startAt,
  endAt,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAdminContext } from "../AdminContext";

const STOCK_PRICE_COLLECTION = "stock_prices";

const STATUS_OPTIONS = [
  { value: "진행중", label: "진행중" },
  { value: "관망", label: "관망" },
  { value: "완료", label: "완료" },
];

const LEG_TYPE_OPTIONS = [
  { value: "BUY", label: "매수" },
  { value: "SELL", label: "매도" },
];

const emptyStockForm = {
  ticker: "",
  name: "",
  status: "진행중",
  targetWeight: "",
  aggregatedReturn: "",
  strategyNote: "",
  orderIndex: "",
};

const emptyLegForm = {
  type: "BUY",
  sequence: "",
  targetPrice: "",
  weightPercent: "",
  filled: false,
};

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export default function PortfolioManager() {
  const { setMessage } = useAdminContext();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [legForm, setLegForm] = useState(emptyLegForm);
  const [editingLegId, setEditingLegId] = useState(null);
  const autocompleteBypassRef = useRef(false);
  const closeSuggestionsTimeoutRef = useRef(null);
  const [stockSuggestions, setStockSuggestions] = useState({
    open: false,
    loading: false,
    items: [],
    error: null,
  });

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stockQuery = query(collection(db, "portfolioStocks"), orderBy("orderIndex", "asc"));
      const snapshot = await getDocs(stockQuery);
      const items = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const legsSnap = await getDocs(collection(docSnap.ref, "legs"));
          const legs = legsSnap.docs.map((legSnap) => ({ id: legSnap.id, ...legSnap.data() }));
          return { id: docSnap.id, ...docSnap.data(), legs };
        })
      );
      setStocks(items);
    } catch (err) {
      console.error("포트폴리오 데이터 불러오기 실패", err);
      setError("포트폴리오 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  useEffect(() => {
    autocompleteBypassRef.current = true;
    setStockSuggestions({ open: false, loading: false, items: [], error: null });
    if (!selectedId) {
      setStockForm((prev) => ({ ...emptyStockForm, orderIndex: stocks.length + 1 }));
      setLegForm(emptyLegForm);
      setEditingLegId(null);
      return;
    }
    const current = stocks.find((stock) => stock.id === selectedId);
    if (!current) {
      setSelectedId(null);
      return;
    }
    setStockForm({
      ticker: current.ticker ?? "",
      name: current.name ?? "",
      status: current.status ?? "진행중",
      targetWeight: current.targetWeight ?? "",
      aggregatedReturn: current.aggregatedReturn ?? "",
      strategyNote: current.strategyNote ?? "",
      orderIndex: current.orderIndex ?? "",
    });
    setLegForm(emptyLegForm);
    setEditingLegId(null);
  }, [selectedId, stocks]);

  useEffect(() => {
    return () => {
      if (closeSuggestionsTimeoutRef.current) {
        clearTimeout(closeSuggestionsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const trimmedName = stockForm.name.trim();

    if (autocompleteBypassRef.current) {
      autocompleteBypassRef.current = false;
      return;
    }

    if (!trimmedName) {
      setStockSuggestions((prev) => ({ ...prev, loading: false, items: [], error: null }));
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
          name: docSnap.data().name ?? docSnap.id,
        }));

        const normalize = (value) => value.replace(/\s+/g, "").toLowerCase();
        const normalizedInput = normalize(trimmedName);
        const exactMatchDoc = snapshot.docs.find((docSnap) => {
          const candidate = docSnap.data().name ?? docSnap.id;
          if (!candidate) return false;
          return (
            normalize(candidate).localeCompare(normalizedInput, undefined, { sensitivity: "base" }) === 0
          );
        });

        if (exactMatchDoc) {
          autocompleteBypassRef.current = true;
          setStockForm((prev) => ({
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
  }, [stockForm.name, setMessage]);

  useEffect(() => {
    const trimmedTicker = stockForm.ticker.trim().toUpperCase();
    if (!trimmedTicker || stockForm.name.trim()) {
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
          setStockSuggestions((prev) => ({ ...prev, error: "해당 종목을 찾을 수 없습니다." }));
          return;
        }
        const fetchedName = docSnap.data()?.name ?? "";
        if (fetchedName) {
          autocompleteBypassRef.current = true;
          setStockForm((prev) => ({
            ...prev,
            ticker: trimmedTicker,
            name: fetchedName,
          }));
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
  }, [stockForm.ticker, stockForm.name, setMessage]);

  const selectedStock = useMemo(
    () => stocks.find((stock) => stock.id === selectedId) ?? null,
    [stocks, selectedId]
  );

  const handleStockFormChange = (field, value) => {
    setStockForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectSuggestion = (item) => {
    if (closeSuggestionsTimeoutRef.current) {
      clearTimeout(closeSuggestionsTimeoutRef.current);
      closeSuggestionsTimeoutRef.current = null;
    }
    autocompleteBypassRef.current = true;
    setStockForm((prev) => ({
      ...prev,
      name: item.name,
      ticker: item.ticker,
    }));
    setStockSuggestions({ open: false, loading: false, items: [], error: null });
  };

  const handleSaveStock = async () => {
    if (!stockForm.ticker || !stockForm.name) {
      setMessage("종목 코드와 종목명을 입력해주세요.");
      return;
    }

    const payload = {
      ticker: stockForm.ticker.trim().toUpperCase(),
      name: stockForm.name.trim(),
      status: stockForm.status,
      targetWeight: toNumber(stockForm.targetWeight),
      aggregatedReturn: toNumber(stockForm.aggregatedReturn),
      strategyNote: stockForm.strategyNote,
      orderIndex: toNumber(stockForm.orderIndex) ?? stocks.length + 1,
      updatedAt: new Date(),
    };

    try {
      if (selectedId) {
        await updateDoc(doc(db, "portfolioStocks", selectedId), payload);
        setMessage("포트폴리오 종목이 수정되었습니다.");
      } else {
        const docRef = await addDoc(collection(db, "portfolioStocks"), {
          ...payload,
          createdAt: new Date(),
        });
        setSelectedId(docRef.id);
        setMessage("새 포트폴리오 종목이 등록되었습니다.");
      }
      await fetchStocks();
    } catch (error) {
      console.error("포트폴리오 종목 저장 실패", error);
      setMessage("포트폴리오 종목 저장에 실패했습니다.");
    }
  };

  const handleDeleteStock = async () => {
    if (!selectedId) return;
    if (!window.confirm("이 종목을 삭제하면 관련 전략 데이터도 모두 삭제됩니다. 계속하시겠습니까?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "portfolioStocks", selectedId));
      setMessage("포트폴리오 종목이 삭제되었습니다.");
      setSelectedId(null);
      await fetchStocks();
    } catch (error) {
      console.error("포트폴리오 종목 삭제 실패", error);
      setMessage("포트폴리오 종목 삭제에 실패했습니다.");
    }
  };

  const handleEditLeg = (leg) => {
    setEditingLegId(leg.id);
    setLegForm({
      type: leg.type ?? "BUY",
      sequence: leg.sequence ?? "",
      targetPrice: leg.targetPrice ?? "",
      weightPercent: leg.weight ? Number(leg.weight) * 100 : "",
      filled: Boolean(leg.filled),
    });
  };

  const resetLegForm = () => {
    setEditingLegId(null);
    setLegForm(emptyLegForm);
  };

  const handleSaveLeg = async () => {
    if (!selectedId) {
      setMessage("먼저 포트폴리오 종목을 저장한 뒤 전략 단계를 추가하세요.");
      return;
    }
    if (!legForm.sequence || !legForm.targetPrice || !legForm.weightPercent) {
      setMessage("차수, 목표가, 비중을 모두 입력해주세요.");
      return;
    }

    const legData = {
      type: legForm.type,
      sequence: Number(legForm.sequence),
      targetPrice: Number(legForm.targetPrice),
      weight: Number(legForm.weightPercent) / 100,
      filled: Boolean(legForm.filled),
      updatedAt: new Date(),
    };

    try {
      const legsCollection = collection(doc(db, "portfolioStocks", selectedId), "legs");
      if (editingLegId) {
        await updateDoc(doc(legsCollection, editingLegId), legData);
        setMessage("전략 단계가 수정되었습니다.");
      } else {
        await addDoc(legsCollection, {
          ...legData,
          createdAt: new Date(),
        });
        setMessage("새 전략 단계가 추가되었습니다.");
      }
      await fetchStocks();
      resetLegForm();
    } catch (error) {
      console.error("전략 단계 저장 실패", error);
      setMessage("전략 단계를 저장하지 못했습니다.");
    }
  };

  const handleDeleteLeg = async (legId) => {
    if (!selectedId) return;
    if (!window.confirm("이 전략 단계를 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDoc(doc(collection(doc(db, "portfolioStocks", selectedId), "legs"), legId));
      setMessage("전략 단계가 삭제되었습니다.");
      await fetchStocks();
    } catch (error) {
      console.error("전략 단계 삭제 실패", error);
      setMessage("전략 단계를 삭제하지 못했습니다.");
    }
  };

  const buyLegs = selectedStock?.legs?.filter((leg) => leg.type === "BUY") ?? [];
  const sellLegs = selectedStock?.legs?.filter((leg) => leg.type === "SELL") ?? [];

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">포트폴리오 목록</h2>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs text-teal-300 hover:text-teal-200"
            >
              새 종목 추가
            </button>
          </div>
          <div className="divide-y divide-gray-800 max-h-[480px] overflow-y-auto">
            {loading && <p className="px-4 py-3 text-xs text-gray-400">불러오는 중...</p>}
            {error && <p className="px-4 py-3 text-xs text-red-400">{error}</p>}
            {!loading && !stocks.length && !error && (
              <p className="px-4 py-3 text-xs text-gray-400">등록된 포트폴리오가 없습니다.</p>
            )}
            {stocks.map((stock) => (
              <button
                key={stock.id}
                type="button"
                onClick={() => setSelectedId(stock.id)}
                className={`w-full text-left px-4 py-3 text-sm transition ${
                  selectedId === stock.id
                    ? "bg-teal-500/10 text-white border-l-4 border-teal-400"
                    : "hover:bg-gray-800 text-gray-200"
                }`}
              >
                <p className="font-semibold">{stock.name}</p>
                <p className="text-xs text-gray-400">{stock.ticker} · 목표 {stock.targetWeight ?? 0}%</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {selectedId ? "포트폴리오 종목 수정" : "새 포트폴리오 종목"}
              </h3>
              {selectedId && (
                <button
                  type="button"
                  onClick={handleDeleteStock}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  종목 삭제
                </button>
              )}
            </div>
            <div className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  종목 코드
                  <input
                    value={stockForm.ticker}
                    onChange={(event) => handleStockFormChange("ticker", event.target.value)}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="예: 005930"
                  />
                </label>
                <label className="relative flex flex-col gap-2 text-sm text-gray-300">
                  종목명
                  <input
                    value={stockForm.name}
                    onChange={(event) => handleStockFormChange("name", event.target.value)}
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
                    placeholder="삼성전자"
                  />
                  {stockSuggestions.open && (
                    <ul className="absolute z-10 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
                      {stockSuggestions.loading && (
                        <li className="px-3 py-2 text-xs text-gray-400">검색 중...</li>
                      )}
                      {!stockSuggestions.loading && stockSuggestions.error && (
                        <li className="px-3 py-2 text-xs text-red-400">{stockSuggestions.error}</li>
                      )}
                      {!stockSuggestions.loading && !stockSuggestions.error &&
                        !stockSuggestions.items.length && (
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
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  목표 비중 (%)
                  <input
                    type="number"
                    step="0.1"
                    value={stockForm.targetWeight}
                    onChange={(event) => handleStockFormChange("targetWeight", event.target.value)}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="예: 12.5"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  누적 수익률 (%)
                  <input
                    type="number"
                    step="0.1"
                    value={stockForm.aggregatedReturn}
                    onChange={(event) => handleStockFormChange("aggregatedReturn", event.target.value)}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="예: 8.2"
                  />
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  현재 상태
                  <select
                    value={stockForm.status}
                    onChange={(event) => handleStockFormChange("status", event.target.value)}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  노출 순서
                  <input
                    type="number"
                    value={stockForm.orderIndex}
                    onChange={(event) => handleStockFormChange("orderIndex", event.target.value)}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="1"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm text-gray-300">
                전략 메모
                <textarea
                  rows={4}
                  value={stockForm.strategyNote}
                  onChange={(event) => handleStockFormChange("strategyNote", event.target.value)}
                  className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                  placeholder="전략 개요를 입력하세요."
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveStock}
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg"
                >
                  {selectedId ? "종목 수정" : "종목 등록"}
                </button>
              </div>
            </div>
          </div>

          {selectedId && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">전략 단계 관리</h3>
                {editingLegId && (
                  <button
                    type="button"
                    onClick={resetLegForm}
                    className="text-sm text-gray-300 hover:text-white"
                  >
                    새 단계 추가
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  구분
                  <select
                    value={legForm.type}
                    onChange={(event) => setLegForm((prev) => ({ ...prev, type: event.target.value }))}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                  >
                    {LEG_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  차수
                  <input
                    type="number"
                    value={legForm.sequence}
                    onChange={(event) => setLegForm((prev) => ({ ...prev, sequence: event.target.value }))}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="예: 1"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  목표 가격
                  <input
                    type="number"
                    value={legForm.targetPrice}
                    onChange={(event) => setLegForm((prev) => ({ ...prev, targetPrice: event.target.value }))}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="예: 75000"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                  비중 (%)
                  <input
                    type="number"
                    step="0.1"
                    value={legForm.weightPercent}
                    onChange={(event) => setLegForm((prev) => ({ ...prev, weightPercent: event.target.value }))}
                    className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white"
                    placeholder="예: 10"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={legForm.filled}
                    onChange={(event) => setLegForm((prev) => ({ ...prev, filled: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                  />
                  실행 완료
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveLeg}
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg"
                >
                  {editingLegId ? "단계 수정" : "단계 추가"}
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">매수 전략</h4>
                  <div className="space-y-2">
                    {buyLegs.length === 0 && (
                      <p className="text-xs text-gray-400">등록된 매수 전략이 없습니다.</p>
                    )}
                    {buyLegs
                      .slice()
                      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
                      .map((leg) => (
                        <div
                          key={leg.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                        >
                          <div className="text-sm text-gray-200">
                            <span className="font-semibold">{leg.sequence}차</span> · 목표 {leg.targetPrice}원 · 비중
                            {" "}
                            {leg.weight ? (Number(leg.weight) * 100).toFixed(1) : 0}%
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className={leg.filled ? "text-teal-300" : "text-yellow-300"}>
                              {leg.filled ? "완료" : "대기"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditLeg(leg)}
                              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLeg(leg.id)}
                              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">매도 전략</h4>
                  <div className="space-y-2">
                    {sellLegs.length === 0 && (
                      <p className="text-xs text-gray-400">등록된 매도 전략이 없습니다.</p>
                    )}
                    {sellLegs
                      .slice()
                      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
                      .map((leg) => (
                        <div
                          key={leg.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                        >
                          <div className="text-sm text-gray-200">
                            <span className="font-semibold">{leg.sequence}차</span> · 목표 {leg.targetPrice}원 · 비중
                            {" "}
                            {leg.weight ? (Number(leg.weight) * 100).toFixed(1) : 0}%
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className={leg.filled ? "text-teal-300" : "text-yellow-300"}>
                              {leg.filled ? "완료" : "대기"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditLeg(leg)}
                              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLeg(leg.id)}
                              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
