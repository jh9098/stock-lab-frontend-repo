const FALLBACK_REMOTE_API = "https://stock-lab-backend-repo.onrender.com";

const inferSameOriginApiBase = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const { hostname } = window.location;

  if (hostname.endsWith("netlify.app") || hostname.endsWith("netlify.live")) {
    // Netlify에서는 netlify.toml 리다이렉트 설정을 통해 백엔드로 프록시합니다.
    return "";
  }

  return null;
};

const inferredBase = inferSameOriginApiBase();
const envBase = import.meta?.env?.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = envBase || inferredBase || FALLBACK_REMOTE_API;

export default API_BASE_URL;
