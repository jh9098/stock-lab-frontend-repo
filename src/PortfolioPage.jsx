import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import usePortfolioData from "./hooks/usePortfolioData";
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
