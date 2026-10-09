import axios, { AxiosInstance, AxiosError, AxiosResponse } from "axios";
import { API_BASE_URL } from "../config/apiConfig";

const axiosClient = (token: string | null = null): AxiosInstance => {
  // Create client with basic configuration, but don't set Authorization header yet
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 60000,
    withCredentials: false,
  });

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  client.interceptors.request.use((config: any) => {
    // Priority: 1. Use token from localStorage, 2. Use token passed to function
    const storedToken = localStorage.getItem("ACCESS_TOKEN");
    const tokenToUse = storedToken || token;

    config.headers = config.headers || {};
    if (tokenToUse) {
      config.headers.Authorization = `Bearer ${tokenToUse}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError) => {
      try {
        const { response } = error;
        if (response?.status === 401) {
          localStorage.removeItem("ACCESS_TOKEN");
        }
      } catch (e) {
        console.error(e);
      }
      throw error;
    }
  );

  return client;
};

export default axiosClient;
