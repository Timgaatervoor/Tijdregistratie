import type { StamhoofdConfig, StamhoofdShop, StamhoofdSnapshot } from '../types/stamhoofd';
import { syncService } from './syncService';

export async function workerRequest<T>(workerUrl: string, path: string, accessToken: string): Promise<T> {
  if (!navigator.onLine || syncService.getIsSimulatedOffline()) throw new Error('Je bent offline. Lokale wedstrijdregistratie blijft beschikbaar.');
  const base = new URL(workerUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Gebruik een HTTPS Worker URL zonder pad of aanmeldgegevens.');
  let response: Response;
  try {
    response = await fetch(new URL(path, base), { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(180000) });
  } catch {
    console.error('Worker-request mislukt: netwerk, timeout of CORS.');
    throw new Error('Worker niet bereikbaar. Controleer internet, Worker URL en de CORS-origin.');
  }
  const data = await response.json();
  if (!response.ok) {
    console.error('Worker-request geweigerd:', response.status);
    throw new Error(data.error || 'Worker kon de aanvraag niet uitvoeren.');
  }
  return data;
}
export function searchShops(url: string, domain: string, token: string) {
  return workerRequest<{ shops: StamhoofdShop[] }>(url, `/webshop/search?${new URLSearchParams({ domain })}`, token);
}
export async function loadStamhoofd(config: StamhoofdConfig, token: string): Promise<StamhoofdSnapshot> {
  if (!config.shop) throw new Error('Selecteer eerst een webshop.');
  const data = await workerRequest<StamhoofdSnapshot>(config.workerUrl, `/sync?${new URLSearchParams({ organizationId: config.shop.organizationId, webshopId: config.shop.id })}`, token);
  if (data.shop.id !== config.shop.id || data.shop.organizationId !== config.shop.organizationId || !Array.isArray(data.orders) || !Array.isArray(data.tickets) || !data.webshop) throw new Error('Onvolledig synchronisatieantwoord.');
  return { ...data, shop: config.shop };
}
