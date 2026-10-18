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

  client.interceptors.request.use(config => {
    const tokenToUse = token;

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
      } catch {
        console.error('Impossibile cancellare il token legacy dal browser.');
      }
      throw error;
    }
  );

  return client;
};

export default axiosClient;
