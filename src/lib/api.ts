import { isCategoryItem } from './categories';

let memoryToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  memoryToken = token;
}

export function getApiAuthToken(): string | null {
  return memoryToken;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (memoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType)) {
    throw new Error('The job service is unavailable. Please try again later.');
  }

  const data: unknown = await res.json();

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error: string }).error)
        : `Request failed with HTTP ${res.status}`;
    throw new Error(message);
  }

  // TypeScript generics do not validate responses at runtime. Reject malformed
  // collection payloads before they can reach React state and crash rendering.
  const pathname = new URL(url, 'http://localhost').pathname;
  if (options.method === undefined || options.method.toUpperCase() === 'GET') {
    const arrayEndpoints = ['/api/jobs/categories', '/api/jobs/companies', '/api/user/saved-jobs'];
    if (arrayEndpoints.includes(pathname) && !Array.isArray(data)) {
      throw new Error('The job service returned an invalid list. Please try again later.');
    }
    if (pathname === '/api/jobs/categories' && (
      !Array.isArray(data) || !data.every(isCategoryItem)
    )) {
      throw new Error('The job service returned invalid categories. Please try again later.');
    }
    if (pathname === '/api/jobs' && (
      !data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)
    )) {
      throw new Error('The job service returned invalid listings. Please try again later.');
    }
  }

  return data as T;
}
