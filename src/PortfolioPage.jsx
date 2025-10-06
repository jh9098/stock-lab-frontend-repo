import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import usePortfolioData from "./hooks/usePortfolioData";
import { db } from "./firebaseConfig";
import useAuth from "./useAuth";

const PriceLineChart = lazy(() => import("./components/PriceLineChart"));

function ProgressBar({ value }) {
  const percentage = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));

  return (
    <div className="w-full bg-gray-700 h-2 rounded">
      <div
        className="bg-teal-400 h-2 rounded transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function StockRow({ stock, onSelect }) {
  const statusColor =
    stock.status === "완료"
      ? "text-emerald-400"
      : stock.status === "진행중"
      ? "text-yellow-400"
      : "text-gray-300";

  return (
    <tr
      className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
      onClick={() => onSelect(stock)}
    >
      <td className="px-4 py-3 font-semibold text-white">{stock.ticker}</td>
      <td className="px-4 py-3">{stock.name}</td>
      <td className={`px-4 py-3 ${statusColor}`}>{stock.status ?? "-"}</td>
      <td className="px-4 py-3">
        <ProgressBar value={stock.totalProgress} />
      </td>
      <td className="px-4 py-3 text-right">
        {typeof stock.aggregatedReturn === "number"
          ? `${stock.aggregatedReturn.toFixed(2)}%`
          : "-"}
      </td>
    </tr>
  );
}

function MemberNoteForm({ stock }) {
  const { user, signIn } = useAuth();
  const [form, setForm] = useState({ buyPrice: "", quantity: "", memo: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (stock?.memberNote) {
      setForm({
        buyPrice: stock.memberNote.buyPrice ?? "",
        quantity: stock.memberNote.quantity ?? "",
        memo: stock.memberNote.memo ?? "",
      });
    } else {
      setForm({ buyPrice: "", quantity: "", memo: "" });
    }
  }, [stock]);

  if (!user) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 space-y-3">
        <p>로그인 후 나의 매매 정보를 기록할 수 있습니다.</p>
        <button
          type="button"
          onClick={signIn}
          className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold py-2 rounded"
        >
          구글 계정으로 로그인
        </button>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stock) return;
    setSaving(true);
    try {
      const noteRef = doc(
        collection(doc(db, "portfolioStocks", stock.id), "memberNotes"),
        user.uid
      );

      await setDoc(
        noteRef,
        {
          uid: user.uid,
          buyPrice: form.buyPrice === "" ? null : Number(form.buyPrice),
          quantity: form.quantity === "" ? null : Number(form.quantity),
          memo: form.memo,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      alert("저장되었습니다.");
    } catch (error) {
      console.error("회원 메모 저장 실패", error);
      alert("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 rounded-lg p-4 space-y-3 text-sm"
    >
      <div>
        <label className="block text-gray-300 mb-1" htmlFor="buyPrice">
          나의 평균 매수가
        </label>
        <input
          id="buyPrice"
          type="number"
          step="0.01"
          value={form.buyPrice}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, buyPrice: event.target.value }))
          }
          className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white"
          placeholder="예: 12345"
        />
      </div>
      <div>
        <label className="block text-gray-300 mb-1" htmlFor="quantity">
          보유 수량(주)
        </label>
        <input
          id="quantity"
          type="number"
          step="1"
          value={form.quantity}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, quantity: event.target.value }))
          }
          className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white"
          placeholder="예: 10"
        />
      </div>
      <div>
        <label className="block text-gray-300 mb-1" htmlFor="memo">
          메모
        </label>
        <textarea
          id="memo"
          rows={3}
          value={form.memo}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, memo: event.target.value }))
          }
          className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white"
          placeholder="내 전략이나 체크하고 싶은 내용을 입력하세요."
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white font-semibold py-2 rounded"
      >
        {saving ? "저장 중..." : "나의 매매 기록 저장"}
      </button>
    </form>
  );
}

export default function PortfolioPage() {
  const { loading, stocks } = usePortfolioData();
  const [selectedStock, setSelectedStock] = useState(null);
  const [statusFilter, setStatusFilter] = useState("전체");
  const filteredStocks = useMemo(() => {
    if (statusFilter === "전체") {
      return stocks;
    }
    return stocks.filter((stock) => (stock.status ?? "") === statusFilter);
  }, [statusFilter, stocks]);
  const priceSeries = useMemo(() => {
    if (!selectedStock?.priceHistory) {
      return [];
    }

    const toDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) {
        return value;
      }
      if (typeof value.toDate === "function") {
        try {
          const converted = value.toDate();
          if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
            return converted;
          }
        } catch (error) {
          console.warn("가격 데이터 변환 실패", error);
        }
      }
      const parsed = new Date(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    };

    return (Array.isArray(selectedStock.priceHistory)
      ? selectedStock.priceHistory
      : []
    )
      .map((item) => {
        const dateValue = toDate(item.date ?? item.timestamp);
        const close = Number(
          item.close ?? item.price ?? item.closePrice ?? item.endPrice
        );

        if (!Number.isFinite(close) || !dateValue) {
          return null;
        }

        return {
          ...item,
          close,
          date: item.date ?? item.timestamp ?? dateValue.toISOString().slice(0, 10),
          dateValue,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dateValue - b.dateValue);
  }, [selectedStock]);

  const recentPrices = useMemo(() => {
    if (!priceSeries.length) {
      return [];
    }

    return [...priceSeries]
      .sort((a, b) => b.dateValue - a.dateValue)
      .slice(0, 10)
      .map((item) => ({ date: item.date, close: item.close }));
  }, [priceSeries]);

  const legAnalysis = useMemo(() => {
    if (!selectedStock) {
      return {
        buyLegs: [],
        sellLegs: [],
        reachedLegs: [],
        unreachedLegs: [],
        allLegs: [],
      };
    }

    const toSafeDate = (value) => {
      if (!value) return null;
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
      }
      if (typeof value.toDate === "function") {
        try {
          const converted = value.toDate();
          if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
            return converted;
          }
        } catch (error) {
          console.warn("타임스탬프 변환 실패", error);
        }
      }
      const parsed = new Date(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    };

    const parsedPrices = priceSeries
      .map((item) => ({
        ...item,
        close: Number(item.close),
        dateValue: item.dateValue instanceof Date ? item.dateValue : new Date(item.date),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.close) &&
          item.dateValue instanceof Date &&
          !Number.isNaN(item.dateValue.getTime())
      );

    if (!parsedPrices.length) {
      const fallbackAnalyse = (legs, type) =>
        (Array.isArray(legs) ? legs : []).map((leg) => ({
          id: leg?.id ?? `${type}-${leg?.sequence ?? ""}-${leg?.targetPrice ?? ""}`,
          sequence: leg.sequence,
          type,
          targetPrice: Number.isFinite(Number(leg.targetPrice))
            ? Number(leg.targetPrice)
            : null,
          rawTargetPrice: leg.targetPrice,
          reached: false,
          reachedDate: null,
          reachedDateValue: null,
          daysToHit: null,
          maxAdversePercent: null,
          filled: Boolean(leg?.filled),
          createdAt: toSafeDate(leg?.createdAt),
          filledAt: toSafeDate(leg?.filledAt),
          startDate: toSafeDate(leg?.createdAt) ?? toSafeDate(selectedStock?.createdAt),
        }));

      const buyLegs = fallbackAnalyse(selectedStock.buyLegs, "buy");
      const sellLegs = fallbackAnalyse(selectedStock.sellLegs, "sell");
      const allLegs = [...buyLegs, ...sellLegs];

      return {
        buyLegs,
        sellLegs,
        reachedLegs: [],
        unreachedLegs: [],
        allLegs,
      };
    }

    const firstDate = parsedPrices[0].dateValue;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const stockCreatedAt = toSafeDate(selectedStock?.createdAt) ?? firstDate;

    const analyseLegs = (legs, type) =>
      (Array.isArray(legs) ? legs : []).map((leg) => {
        const numericTarget = Number(leg.targetPrice);
        const hasValidTarget = Number.isFinite(numericTarget);
        const baseId = leg?.id ?? `${type}-${leg?.sequence ?? ""}-${leg?.targetPrice ?? ""}`;

        const legCreatedAt = toSafeDate(leg?.createdAt);
        const startDateCandidate = legCreatedAt ?? stockCreatedAt;
        const startDate =
          startDateCandidate instanceof Date && !Number.isNaN(startDateCandidate.getTime())
            ? startDateCandidate
            : firstDate;

        if (!hasValidTarget) {
          return {
            id: baseId,
            sequence: leg.sequence,
            type,
            targetPrice: null,
            rawTargetPrice: leg.targetPrice,
            reached: false,
            reachedDate: null,
            daysToHit: null,
            maxAdversePercent: null,
            filled: Boolean(leg?.filled),
            createdAt: legCreatedAt,
            filledAt: toSafeDate(leg?.filledAt),
            startDate,
          };
        }

        const relevantPrices = parsedPrices.filter((price) => price.dateValue >= startDate);
        const scopedPrices = relevantPrices.length ? relevantPrices : parsedPrices;
        const baselineDate = relevantPrices.length
          ? relevantPrices[0].dateValue
          : scopedPrices.length
          ? scopedPrices[0].dateValue
          : startDate;

        const hitIndex = scopedPrices.findIndex((price) =>
          type === "buy" ? price.close <= numericTarget : price.close >= numericTarget
        );

        const reached = hitIndex !== -1;
        const reachedInfo = reached ? scopedPrices[hitIndex] : null;

        const daysToHit =
          reachedInfo && baselineDate
            ? Math.max(
                0,
                Math.round(
                  (reachedInfo.dateValue.getTime() - baselineDate.getTime()) /
                    millisecondsPerDay
                )
              )
            : null;

        let maxAdversePercent = null;
        if (!reached && scopedPrices.length) {
          const scopedCloses = scopedPrices.map((price) => price.close);
          const scopedMax = Math.max(...scopedCloses);
          const scopedMin = Math.min(...scopedCloses);

          if (type === "buy" && Number.isFinite(scopedMax)) {
            maxAdversePercent = ((scopedMax - numericTarget) / numericTarget) * 100;
          } else if (type === "sell" && Number.isFinite(scopedMin)) {
            maxAdversePercent = ((numericTarget - scopedMin) / numericTarget) * 100;
          }
        }

        if (maxAdversePercent != null) {
          if (!Number.isFinite(maxAdversePercent)) {
            maxAdversePercent = null;
          } else {
            maxAdversePercent = Math.max(0, maxAdversePercent);
          }
        }

        return {
          id: baseId,
          sequence: leg.sequence,
          type,
          targetPrice: numericTarget,
          rawTargetPrice: leg.targetPrice,
          reached,
          reachedDate: reachedInfo ? reachedInfo.date : null,
          reachedDateValue: reachedInfo ? reachedInfo.dateValue : null,
          daysToHit,
          maxAdversePercent,
          filled: Boolean(leg?.filled),
          createdAt: legCreatedAt,
          filledAt: toSafeDate(leg?.filledAt),
          startDate,
        };
      });

    const buyLegs = analyseLegs(selectedStock.buyLegs, "buy");
    const sellLegs = analyseLegs(selectedStock.sellLegs, "sell");
    const allLegs = [...buyLegs, ...sellLegs];

    return {
      buyLegs,
      sellLegs,
      reachedLegs: allLegs.filter((leg) => leg.reached && leg.daysToHit != null),
      unreachedLegs: allLegs.filter(
        (leg) => !leg.reached && leg.maxAdversePercent != null
      ),
      allLegs,
    };
  }, [priceSeries, selectedStock]);

  const executionSummary = useMemo(() => {
    const legs = legAnalysis.allLegs ?? [];
    if (!legs.length) {
      return {
        total: 0,
        filled: 0,
        reached: 0,
        pending: 0,
        items: [],
      };
    }

    const items = legs
      .map((leg) => ({
        ...leg,
        status: leg.filled ? "filled" : leg.reached ? "reached" : "pending",
      }))
      .sort((a, b) => {
        const typePriority = a.type === b.type ? 0 : a.type === "buy" ? -1 : 1;
        if (typePriority !== 0) return typePriority;
        return (a.sequence ?? 0) - (b.sequence ?? 0);
      });

    const filled = items.filter((item) => item.status === "filled").length;
    const reached = items.filter((item) => item.status === "reached").length;
    const pending = items.filter((item) => item.status === "pending").length;

    return {
      total: items.length,
      filled,
      reached,
      pending,
      items,
    };
  }, [legAnalysis]);

  const formatDate = (value) => {
    if (!value) return "-";
    let dateValue = value;
    if (typeof value?.toDate === "function") {
      try {
        dateValue = value.toDate();
      } catch (error) {
        console.warn("날짜 변환 실패", error);
        dateValue = value;
      }
    }

    if (!(dateValue instanceof Date)) {
      dateValue = new Date(dateValue);
    }

    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
      return "-";
    }

    return dateValue.toISOString().slice(0, 10);
  };

  const formatTargetPrice = (value, fallback) => {
    if (Number.isFinite(value)) {
      return `${value.toLocaleString()}원`;
    }
    if (fallback) {
      return fallback;
    }
    return "-";
  };

  useEffect(() => {
    if (!stocks.length) {
      setSelectedStock(null);
      return;
    }

    setSelectedStock((prev) => {
      if (!prev) {
        return prev;
      }

      const matched = stocks.find((stock) => stock.id === prev.id);
      return matched ?? null;
    });
  }, [stocks]);

  useEffect(() => {
    if (!filteredStocks.length) {
      setSelectedStock(null);
      return;
    }
    if (!selectedStock) {
      return;
    }
    const exists = filteredStocks.some((stock) => stock.id === selectedStock.id);
    if (!exists) {
      setSelectedStock(filteredStocks[0]);
    }
  }, [filteredStocks, selectedStock]);

  const summary = useMemo(() => {
    if (!stocks.length) {
      return { totalWeight: 0, averageReturn: 0 };
    }

    const totalWeight = stocks.reduce(
      (acc, stock) => acc + (Number(stock.targetWeight) || 0),
      0
    );
    const averageReturn =
      stocks.reduce(
        (acc, stock) => acc + (Number(stock.aggregatedReturn) || 0),
        0
      ) / stocks.length;

    return { totalWeight, averageReturn };
  }, [stocks]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Helmet>
        <title>포트폴리오 현황 - 지지저항 Lab</title>
        <meta
          name="description"
          content="유료 회원을 위한 종목별 매수/매도 전략 및 실시간 진행 상황"
        />
      </Helmet>

      <header className="px-6 py-8 border-b border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">유료 회원 포트폴리오 현황</h1>
        <p className="text-gray-400">
          전체 목표 비중 {summary.totalWeight.toFixed(1)}% · 평균 수익률 {" "}
          {summary.averageReturn.toFixed(2)}%
        </p>
      </header>

      <main className="px-6 py-8 space-y-8">
        <section className="bg-gray-800 rounded-xl shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
            <h2 className="text-sm font-semibold text-gray-200">전략 목록</h2>
            <div className="flex flex-wrap gap-2">
              {["전체", "진행중", "관망", "완료"].map((option) => {
                const isActive = statusFilter === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatusFilter(option)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? "bg-teal-500 text-white shadow"
                        : "bg-gray-900 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-700 text-gray-300 uppercase">
                <tr>
                  <th className="px-4 py-3">종목코드</th>
                  <th className="px-4 py-3">종목명</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">진행률</th>
                  <th className="px-4 py-3 text-right">총 수익률</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      데이터를 불러오는 중입니다...
                    </td>
                  </tr>
                )}
                {!loading && !stocks.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      아직 등록된 포트폴리오가 없습니다.
                    </td>
                  </tr>
                )}
                {!loading && stocks.length > 0 && !filteredStocks.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      선택한 상태에 해당하는 종목이 없습니다.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredStocks.map((stock) => (
                    <StockRow
                      key={stock.id}
                      stock={stock}
                      onSelect={setSelectedStock}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {selectedStock && (
          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="bg-gray-800 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {selectedStock.name} ({selectedStock.ticker})
                  </h2>
                  <p className="text-sm text-gray-400">
                    목표 비중 {(Number(selectedStock.targetWeight) || 0).toFixed(1)}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStock(null)}
                  className="text-sm text-gray-400 hover:text-gray-200"
                >
                  닫기
                </button>
              </div>

              <div className="rounded-lg bg-gray-900 px-4 py-2 text-xs text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
                <span>최근 업데이트: {formatDate(selectedStock.updatedAt)}</span>
                <span>전략 등록일: {formatDate(selectedStock.createdAt)}</span>
              </div>

              <div>
                <h3 className="text-gray-300 font-semibold mb-2">매수 전략</h3>
                <ul className="space-y-2 text-sm">
                  {selectedStock.buyLegs?.length ? (
                    selectedStock.buyLegs.map((leg) => (
                      <li
                        key={`buy-${leg.id}`}
                        className="flex justify-between bg-gray-900 px-3 py-2 rounded border border-gray-700"
                      >
                        <span>
                          {leg.sequence}차 매수 · 목표 {leg.targetPrice}원
                        </span>
                        <span className="text-gray-400">
                          비중 {(Number(leg.weight) * 100 || 0).toFixed(1)}%
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400">등록된 매수 전략이 없습니다.</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="text-gray-300 font-semibold mb-2">매도 전략</h3>
                <ul className="space-y-2 text-sm">
                  {selectedStock.sellLegs?.length ? (
                    selectedStock.sellLegs.map((leg) => (
                      <li
                        key={`sell-${leg.id}`}
                        className="flex justify-between bg-gray-900 px-3 py-2 rounded border border-gray-700"
                      >
                        <span>
                          {leg.sequence}차 매도 · 목표 {leg.targetPrice}원
                        </span>
                        <span className="text-gray-400">
                          비중 {(Number(leg.weight) * 100 || 0).toFixed(1)}%
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400">등록된 매도 전략이 없습니다.</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="text-gray-300 font-semibold mb-2">설정 이후 실행 여부</h3>
                {executionSummary.total ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="bg-gray-900 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400">체결 완료</p>
                        <p className="text-lg font-semibold text-emerald-400">
                          {executionSummary.filled} / {executionSummary.total}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400">가격 도달</p>
                        <p className="text-lg font-semibold text-teal-400">
                          {executionSummary.reached}
                        </p>
                      </div>
                      <div className="bg-gray-900 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400">대기 중</p>
                        <p className="text-lg font-semibold text-yellow-400">
                          {executionSummary.pending}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-900 text-gray-300">
                          <tr>
                            <th className="px-3 py-2 text-left">구분</th>
                            <th className="px-3 py-2 text-left">차수</th>
                            <th className="px-3 py-2 text-right">목표가</th>
                            <th className="px-3 py-2 text-left">설정일</th>
                            <th className="px-3 py-2 text-left">현재 상태</th>
                            <th className="px-3 py-2 text-left">추가 정보</th>
                          </tr>
                        </thead>
                        <tbody>
                          {executionSummary.items.map((leg) => {
                            const statusText =
                              leg.status === "filled"
                                ? "체결 완료"
                                : leg.status === "reached"
                                ? "목표가 도달"
                                : "진행 대기";

                            let detailText = "-";
                            if (leg.status === "filled") {
                              detailText = leg.filledAt
                                ? `${formatDate(leg.filledAt)} 체결`
                                : "회원 기록 기준";
                            } else if (leg.status === "reached") {
                              const reachedDate = leg.reachedDateValue
                                ? formatDate(leg.reachedDateValue)
                                : leg.reachedDate ?? "-";
                              const durationText =
                                leg.daysToHit != null ? `${leg.daysToHit}일 소요` : "기간 정보 없음";
                              detailText = `${reachedDate} · ${durationText}`;
                            } else if (Number.isFinite(leg.maxAdversePercent)) {
                              detailText = `미도달 · 최대 괴리 ${leg.maxAdversePercent.toFixed(1)}%`;
                            }

                            return (
                              <tr key={`${leg.type}-${leg.id}`} className="border-b border-gray-700">
                                <td className="px-3 py-2 text-gray-300">
                                  {leg.type === "buy" ? "매수" : "매도"}
                                </td>
                                <td className="px-3 py-2">{leg.sequence}차</td>
                                <td className="px-3 py-2 text-right text-white">
                                  {formatTargetPrice(leg.targetPrice, leg.rawTargetPrice)}
                                </td>
                                <td className="px-3 py-2 text-gray-300">
                                  {formatDate(leg.createdAt ?? leg.startDate)}
                                </td>
                                <td className="px-3 py-2 text-gray-200">{statusText}</td>
                                <td className="px-3 py-2 text-gray-400">{detailText}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    아직 가격 추적 정보가 없어 실행 여부를 계산할 수 없습니다.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-gray-300 font-semibold mb-2">최근 종가 추이</h3>
                {priceSeries.length ? (
                  <div className="space-y-3">
                    <div className="h-64 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
                      <Suspense
                        fallback={
                          <div className="flex h-full items-center justify-center text-sm text-gray-400">
                            차트 모듈을 불러오는 중입니다...
                          </div>
                        }
                      >
                        <PriceLineChart data={priceSeries} />
                      </Suspense>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                      {recentPrices.map((item) => {
                        const numericClose = Number(item.close);
                        const closeText = Number.isFinite(numericClose)
                          ? `${numericClose.toLocaleString()}원`
                          : item.close;

                        return (
                          <li
                            key={item.date}
                            className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded border border-gray-700"
                          >
                            <span className="text-gray-300">{item.date}</span>
                            <span className="font-semibold text-white">{closeText}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">가격 데이터가 없습니다.</p>
                )}
              </div>

              <div className="bg-gray-900 rounded-lg px-4 py-3 text-sm text-gray-300">
                {selectedStock.strategyNote || "전략 설명이 없습니다."}
              </div>
            </div>

            <MemberNoteForm stock={selectedStock} />
          </section>
        )}
      </main>
    </div>
  );
}
