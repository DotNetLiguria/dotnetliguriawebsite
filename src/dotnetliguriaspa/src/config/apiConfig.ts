// API Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:64561/api";

// Content Base URL (for images and static files)
export const CONTENT_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "") + "/Contents/";
