// START OF FILE src/components/CausalForm.jsx

import { useState } from "react";

const PRESET = {
  start: "FR_credit_rating",
  direction: "down",
  end: "KOSPI",
  minStrength: 0.05,
};

const directionOptions = [
  { value: "up", label: "상승" },
  { value: "down", label: "하락" },
];

export default function CausalForm({ onSubmit, loading }) {
  const [formState, setFormState] = useState({
    start: "",
    direction: "up",
    end: "",
    minStrength: 0.05,
  });
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: name === "minStrength" ? value : value.trimStart(),
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formState.start.trim()) {
      nextErrors.start = "시작 키워드를 입력해 주세요.";
    }
    if (!formState.end.trim()) {
      nextErrors.end = "종료 키워드를 입력해 주세요.";
    }
    const strengthValue = Number(formState.minStrength);
    if (Number.isNaN(strengthValue) || strengthValue < 0 || strengthValue > 1) {
      nextErrors.minStrength = "0 이상 1 이하의 값을 입력해 주세요.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    const payload = {
      start: formState.start.trim(),
      end: formState.end.trim(),
      direction: formState.direction,
      minStrength: Number(formState.minStrength) || 0,
    };
    onSubmit?.(payload);
  };

  const handlePreset = () => {
    setFormState({
      start: PRESET.start,
      direction: PRESET.direction,
      end: PRESET.end,
      minStrength: PRESET.minStrength,
    });
    setErrors({});
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg space-y-6"
      aria-label="연쇄효과 추론 입력 폼"
    >
      <div>
        <label htmlFor="start" className="block text-sm font-semibold text-gray-200 mb-2">
          시작 키워드
        </label>
        <input
          id="start"
          name="start"
          type="text"
          aria-label="시작 키워드 입력"
          placeholder="예: 프랑스신용등급, 유로화"
          value={formState.start}
          onChange={handleChange}
          disabled={loading}
          className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {errors.start && <p className="mt-1 text-sm text-red-400" role="alert">{errors.start}</p>}
      </div>

      <div>
        <span className="block text-sm font-semibold text-gray-200 mb-2">초기 방향</span>
        <div className="flex gap-4" role="radiogroup" aria-label="초기 방향 선택">
          {directionOptions.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 text-sm text-gray-200">
              <input
                type="radio"
                name="direction"
                value={option.value}
                checked={formState.direction === option.value}
                onChange={handleChange}
                disabled={loading}
                className="h-4 w-4 text-blue-500 focus:ring-blue-400"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="end" className="block text-sm font-semibold text-gray-200 mb-2">
          종료 키워드
        </label>
        <input
          id="end"
          name="end"
          type="text"
          aria-label="종료 키워드 입력"
          placeholder="예: 코스피, 원달러"
          value={formState.end}
          onChange={handleChange}
          disabled={loading}
          className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {errors.end && <p className="mt-1 text-sm text-red-400" role="alert">{errors.end}</p>}
      </div>

      <div>
        <label htmlFor="minStrength" className="block text-sm font-semibold text-gray-200 mb-2">
          최소 연쇄 강도 (0 ~ 1)
        </label>
        <input
          id="minStrength"
          name="minStrength"
          type="number"
          step="0.01"
          min="0"
          max="1"
          aria-label="최소 연쇄 강도"
          value={formState.minStrength}
          onChange={handleChange}
          disabled={loading}
          className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {errors.minStrength && <p className="mt-1 text-sm text-red-400" role="alert">{errors.minStrength}</p>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handlePreset}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          테스트용 기본값 채우기
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-6 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? "분석 중..." : "연쇄효과 추론 실행"}
        </button>
      </div>
    </form>
  );
}

// END OF FILE src/components/CausalForm.jsx
