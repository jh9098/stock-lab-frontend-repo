import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import usePortfolioData from "./hooks/usePortfolioData";
import useStockPrices from "./hooks/useStockPrices";
import { db } from "./firebaseConfig";
import useAuth from "./useAuth";

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
  const {
    prices: priceHistory,
    loading: priceLoading,
    error: priceError,
  } = useStockPrices(selectedStock?.ticker, { days: 400 });
  const recentPrices = useMemo(
    () => priceHistory.slice(-10).reverse(),
    [priceHistory]
  );

  const targetAnalysis = useMemo(() => {
    if (!selectedStock || !priceHistory.length) {
      return {
        buyLegs: [],
        sellLegs: [],
        reachedLegs: [],
        unreachedLegs: [],
      };
    }

    const parsedPrices = priceHistory
      .map((item) => ({
        ...item,
        close: Number(item.close),
        dateValue: new Date(item.date),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.close) &&
          item.dateValue instanceof Date &&
          !Number.isNaN(item.dateValue.getTime())
      );

    if (!parsedPrices.length) {
      return {
        buyLegs: [],
        sellLegs: [],
        reachedLegs: [],
        unreachedLegs: [],
      };
    }

    const firstDate = parsedPrices[0].dateValue;
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const closes = parsedPrices.map((price) => price.close);
    const maxPrice = Math.max(...closes);
    const minPrice = Math.min(...closes);

    const analyseLegs = (legs, type) =>
      (Array.isArray(legs) ? legs : []).map((leg) => {
        const numericTarget = Number(leg.targetPrice);
        const hasValidTarget = Number.isFinite(numericTarget);
        const baseId = leg?.id ?? `${type}-${leg?.sequence ?? ""}-${leg?.targetPrice ?? ""}`;

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
          };
        }

        const hitIndex = parsedPrices.findIndex((price) =>
          type === "buy" ? price.close <= numericTarget : price.close >= numericTarget
        );

        const reached = hitIndex !== -1;
        const reachedInfo = reached ? parsedPrices[hitIndex] : null;

        const daysToHit = reachedInfo
          ? Math.max(
              0,
              Math.round(
                (reachedInfo.dateValue.getTime() - firstDate.getTime()) /
                  millisecondsPerDay
              )
            )
          : null;

        const maxAdversePercent = reached
          ? null
          : type === "buy"
          ? ((maxPrice - numericTarget) / numericTarget) * 100
          : ((numericTarget - minPrice) / numericTarget) * 100;

        return {
          id: baseId,
          sequence: leg.sequence,
          type,
          targetPrice: numericTarget,
          rawTargetPrice: leg.targetPrice,
          reached,
          reachedDate: reachedInfo ? reachedInfo.date : null,
          daysToHit,
          maxAdversePercent:
            maxAdversePercent != null && Number.isFinite(maxAdversePercent)
              ? Math.max(0, maxAdversePercent)
              : null,
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
    };
  }, [priceHistory, selectedStock]);

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
                {!loading &&
                  stocks.map((stock) => (
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
                <h3 className="text-gray-300 font-semibold mb-2">
                  목표가 백테스트 결과
                </h3>
                {priceLoading ? (
                  <p className="text-sm text-gray-400">
                    목표가 백테스트를 위한 가격 데이터를 불러오는 중입니다...
                  </p>
                ) : priceError ? (
                  <p className="text-sm text-red-400">
                    목표가 백테스트를 수행하지 못했습니다. 잠시 후 다시 시도해주세요.
                  </p>
                ) : priceHistory.length ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-900 text-gray-300">
                          <tr>
                            <th className="px-3 py-2 text-left">구분</th>
                            <th className="px-3 py-2 text-left">차수</th>
                            <th className="px-3 py-2 text-right">목표가</th>
                            <th className="px-3 py-2 text-left">도달 여부</th>
                            <th className="px-3 py-2 text-left">도달까지 기간</th>
                            <th className="px-3 py-2 text-right">미도달 시 최대 손실</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...targetAnalysis.buyLegs, ...targetAnalysis.sellLegs].map(
                            (leg) => {
                              const targetPriceText = Number.isFinite(leg.targetPrice)
                                ? `${leg.targetPrice.toLocaleString()}원`
                                : leg.rawTargetPrice ?? "-";

                              return (
                                <tr key={leg.id} className="border-b border-gray-700">
                                  <td className="px-3 py-2 text-gray-300">
                                    {leg.type === "buy" ? "매수" : "매도"}
                                  </td>
                                  <td className="px-3 py-2">{leg.sequence}차</td>
                                  <td className="px-3 py-2 text-right text-white">
                                    {targetPriceText}
                                  </td>
                                  <td className="px-3 py-2 text-gray-200">
                                    {leg.reached
                                      ? `도달 (${leg.reachedDate})`
                                      : "미도달"}
                                </td>
                                <td className="px-3 py-2 text-gray-200">
                                  {leg.daysToHit != null
                                    ? `${leg.daysToHit}일`
                                    : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-200">
                                    {leg.maxAdversePercent != null
                                      ? `${leg.maxAdversePercent.toFixed(1)}%`
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                          {!targetAnalysis.buyLegs.length &&
                            !targetAnalysis.sellLegs.length && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-3 py-3 text-center text-gray-400"
                                >
                                  분석할 전략 목표가가 없습니다.
                                </td>
                              </tr>
                            )}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="bg-gray-900 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-200 mb-3">
                          목표 도달까지 걸린 기간 (일)
                        </h4>
                        {targetAnalysis.reachedLegs.length ? (
                          <ul className="space-y-2">
                            {(() => {
                              const maxDays = Math.max(
                                ...targetAnalysis.reachedLegs.map((leg) => leg.daysToHit || 0)
                              );
                              return targetAnalysis.reachedLegs.map((leg) => {
                                const width = maxDays
                                  ? Math.round((leg.daysToHit / maxDays) * 100)
                                  : 0;
                                return (
                                  <li key={`${leg.type}-days-${leg.id}`}>
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                      <span>
                                        {leg.type === "buy" ? "매수" : "매도"} {leg.sequence}차
                                      </span>
                                      <span>{leg.daysToHit}일</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-2 rounded">
                                      <div
                                        className="bg-teal-400 h-2 rounded"
                                        style={{ width: `${width}%` }}
                                      />
                                    </div>
                                  </li>
                                );
                              });
                            })()}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">
                            목표가에 도달한 구간이 없습니다.
                          </p>
                        )}
                      </div>

                      <div className="bg-gray-900 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-200 mb-3">
                          미도달 시 최대 손실 폭 (%)
                        </h4>
                        {targetAnalysis.unreachedLegs.length ? (
                          <ul className="space-y-2">
                            {(() => {
                              const maxLoss = Math.max(
                                ...targetAnalysis.unreachedLegs.map(
                                  (leg) => leg.maxAdversePercent || 0
                                )
                              );
                              return targetAnalysis.unreachedLegs.map((leg) => {
                                const width = maxLoss
                                  ? Math.round(
                                      (leg.maxAdversePercent / maxLoss) * 100
                                    )
                                  : 0;
                                return (
                                  <li key={`${leg.type}-loss-${leg.id}`}>
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                      <span>
                                        {leg.type === "buy" ? "매수" : "매도"} {leg.sequence}차
                                      </span>
                                      <span>{leg.maxAdversePercent.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-2 rounded">
                                      <div
                                        className="bg-orange-400 h-2 rounded"
                                        style={{ width: `${width}%` }}
                                      />
                                    </div>
                                  </li>
                                );
                              });
                            })()}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-400">
                            미도달한 목표가에 대한 손실 데이터가 없습니다.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    가격 데이터가 부족해 백테스트를 수행할 수 없습니다.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-gray-300 font-semibold mb-2">최근 종가 추이</h3>
                {priceLoading ? (
                  <p className="text-sm text-gray-400">주가 데이터를 불러오는 중입니다...</p>
                ) : priceError ? (
                  <p className="text-sm text-red-400">
                    주가 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                  </p>
                ) : recentPrices.length ? (
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
