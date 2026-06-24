import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Dynamic backend URL injection for Cloudflare Worker deployment
const BACKEND_URL = 'https://aob-708g.onrender.com';

function makePathsAbsolute(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('/uploads/')) {
      return BACKEND_URL + obj;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(makePathsAbsolute);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = makePathsAbsolute(obj[key]);
    }
    return newObj;
  }
  return obj;
}

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  let url = input;
  if (typeof input === 'string') {
    if (input.startsWith('/api/')) {
      url = BACKEND_URL + input;
    } else if (input.startsWith('/uploads/')) {
      url = BACKEND_URL + input;
    }
  }

  if (typeof url === 'string' && url.startsWith(BACKEND_URL)) {
    if (!init) {
      init = { credentials: 'include' };
    } else {
      init.credentials = 'include';
    }
  }

  const response = await originalFetch(url, init);

  // Safely intercept JSON outputs to fix image paths returned from DB
  const originalJson = response.json;
  response.json = async () => {
    const data = await originalJson.call(response);
    return makePathsAbsolute(data);
  };

  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
