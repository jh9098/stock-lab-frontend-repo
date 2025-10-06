const FALLBACK_REMOTE_API = "https://stock-lab-backend-repo.onrender.com";

const normalizeBase = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.replace(/\/$/, "") : null;
};

const inferSameOriginApiBase = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const { hostname } = window.location;

  if (hostname.endsWith("netlify.app") || hostname.endsWith("netlify.live")) {
    // Netlify에서는 netlify.toml 리다이렉트 설정을 통해 백엔드로 프록시합니다.
    return "/api";
  }

  return null;
};

const resolveExplicitBase = () => {
  const candidates = [
    import.meta?.env?.VITE_API_BASE,
    import.meta?.env?.VITE_API_BASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBase(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const explicitBase = resolveExplicitBase();
const inferredBase = normalizeBase(inferSameOriginApiBase());

const RESOLVED_API_BASE = explicitBase || inferredBase || FALLBACK_REMOTE_API;

export const API_BASE_URL = RESOLVED_API_BASE;

export const resolveApiBase = () => RESOLVED_API_BASE;

export default API_BASE_URL;
