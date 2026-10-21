import { useCallback, useEffect, useState } from 'react';

export async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`/api/admin/${path}`, { method, headers: raw ? { 'content-type': raw.type } : body ? { 'content-type': 'application/json' } : {}, body: raw ?? (body ? JSON.stringify(body) : undefined), credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status });
  return data;
}

export function useLoad(path, deps = []) {
  const [state, setState] = useState({ loading: true });
  const reload = useCallback(() => {
    setState((value) => ({ ...value, loading: true }));
    api(path).then((data) => setState({ data }), (error) => {
      if (error.status === 401 || error.status === 403) window.location.reload();
      setState({ error: error.message });
    });
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, reload];
}
