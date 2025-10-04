const DEFAULT_API_BASE_URL = "https://stock-lab-backend-repo.onrender.com";

export const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export default API_BASE_URL;
