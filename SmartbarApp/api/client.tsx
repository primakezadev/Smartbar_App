import * as SecureStore from 'expo-secure-store';

// 1. Corrected variable name and type declaration
const BASE_URL = "https://stylishly-manly-clamshell.ngrok-free.dev";

export const secureFetch = async (endpoint: string, options: any = {}) => {
  const token = await SecureStore.getItemAsync('userToken');
  
  // 2. Now BASE_URL is defined and accessible
  const url = `${BASE_URL}${endpoint}`;

  console.log(`[DEBUG] Attempting fetch to: ${url}`); 

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...options.headers,
        "Authorization": token ? `Bearer ${token}` : ""
      }
    });
    
    console.log(`[DEBUG] Response status: ${response.status}`);
    return response;
  } catch (error) {
    console.error(`[DEBUG] Network Error for ${url}:`, error);
    throw error;
  }
};