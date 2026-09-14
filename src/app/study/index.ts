import type { Mode } from '../store';
export function studySession(): { id: string; mode: Mode } {
  const url = new URL(location.href);
  let id = url.searchParams.get('s');
  if (!id || !/^[a-z0-9]{4}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(4)), n => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join('');
    url.searchParams.set('s', id); history.replaceState(null, '', url);
  }
  return { id, mode: url.searchParams.get('mode') === 'blank' ? 'blank' : 'guide' };
}
