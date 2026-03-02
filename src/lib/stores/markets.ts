import { writable, derived } from 'svelte/store';
import type { MarketItem, SectorPerformance, CryptoItem } from '$lib/types';

interface MarketCategoryState<T> {
	items: T[];
	loading: boolean;
	error: string | null;
}

export interface MarketsState {
	indices: MarketCategoryState<MarketItem>;
	sectors: MarketCategoryState<SectorPerformance>;
	commodities: MarketCategoryState<MarketItem>;
	crypto: MarketCategoryState<CryptoItem>;
	lastUpdated: number | null;
}

// Mock data
const MOCK_INDICES: MarketItem[] = [
	{ symbol: '^GSPC', name: 'S&P 500', price: 5123.44, change: 12.33, changePercent: 0.24, type: 'index' },
	{ symbol: '^IXIC', name: 'NASDAQ', price: 16274.94, change: -45.12, changePercent: -0.28, type: 'index' },
	{ symbol: '^DJI', name: 'Dow Jones', price: 39127.14, change: 172.5, changePercent: 0.44, type: 'index' }
];

const initialState: MarketsState = {
	indices: { items: MOCK_INDICES, loading: false, error: null },
	sectors: { items: [], loading: false, error: null },
	commodities: { items: [], loading: false, error: null },
	crypto: { items: [], loading: false, error: null },
	lastUpdated: Date.now()
};

const internalStore = writable<MarketsState>(initialState);

export const markets = {
	subscribe: internalStore.subscribe,
	setIndices: (items: MarketItem[]) => internalStore.update(s => ({ ...s, indices: { items, loading: false, error: null }, lastUpdated: Date.now() })),
	setSectors: (items: SectorPerformance[]) => internalStore.update(s => ({ ...s, sectors: { items, loading: false, error: null } })),
	setCommodities: (items: MarketItem[]) => internalStore.update(s => ({ ...s, commodities: { items, loading: false, error: null } })),
	setCrypto: (items: CryptoItem[]) => internalStore.update(s => ({ ...s, crypto: { items, loading: false, error: null } })),
	setLoading: (category: keyof Omit<MarketsState, 'lastUpdated'>, loading: boolean) => 
		internalStore.update(s => ({ ...s, [category]: { ...s[category], loading } }))
};

export const indices = derived(internalStore, s => s.indices);
export const sectors = derived(internalStore, s => s.sectors);
export const commodities = derived(internalStore, s => s.commodities);
export const crypto = derived(internalStore, s => s.crypto);
export const isMarketsLoading = derived(internalStore, s => 
	s.indices.loading || s.sectors.loading || s.commodities.loading || s.crypto.loading
);
export const marketsLastUpdated = derived(internalStore, s => s.lastUpdated);
export const vix = derived(internalStore, s => s.commodities.items.find(c => c.symbol === '^VIX'));
