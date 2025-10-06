// START OF FILE src/lib/api.js

import { resolveApiBase } from "./apiConfig";
export { resolveApiBase } from "./apiConfig";

const DEFAULT_TIMEOUT = 12000;

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path = "", { ensureApiPrefix = false } = {}) {
  const base = resolveApiBase() || "";
  const trimmedPath = path.replace(/^\//, "");

  let normalizedBase = base.replace(/\/$/, "");

  if (ensureApiPrefix) {
    if (!normalizedBase) {
      normalizedBase = "/api";
    } else if (!normalizedBase.endsWith("/api")) {
      normalizedBase = `${normalizedBase}/api`;
    }
  }

  const combined = normalizedBase ? `${normalizedBase}/${trimmedPath}` : `/${trimmedPath}`;
  return combined.replace(/\/\/+/, "/");
}

export async function fetchWithTimeout(url, { method = "GET", headers = {}, body, timeout = DEFAULT_TIMEOUT, signal } = {}) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  const mergedSignal = composeAbortSignal(timeoutController.signal, signal);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: mergedSignal,
    });

    if (!response.ok) {
      let errorPayload;
      try {
        errorPayload = await response.json();
      } catch (err) {
        errorPayload = null;
      }
      throw new ApiError("요청이 실패했습니다.", {
        status: response.status,
        payload: errorPayload,
      });
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return null;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("요청 시간이 초과되었습니다.", { status: 408 });
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || "알 수 없는 오류가 발생했습니다.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function composeAbortSignal(...signals) {
  const controller = new AbortController();

  const handleAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  signals.forEach((sig) => {
    if (!sig) return;
    if (sig.aborted) {
      handleAbort();
    } else {
      sig.addEventListener("abort", handleAbort);
    }
  });

  if (!controller.signal.aborted) {
    controller.signal.addEventListener(
      "abort",
      () => {
        signals.forEach((sig) => {
          if (!sig) return;
          sig.removeEventListener?.("abort", handleAbort);
        });
      },
      { once: true }
    );
  }

  return controller.signal;
}

export async function inferCausalPaths(payload, options = {}) {
  const url = buildUrl("infer-paths", { ensureApiPrefix: true });
  const body = JSON.stringify(payload);

  return fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    timeout: DEFAULT_TIMEOUT,
    ...options,
  });
}

// END OF FILE src/lib/api.js
