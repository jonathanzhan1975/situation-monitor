/**
 * Markets API - Fetch market data from Finnhub & CoinGecko
 */

import { INDICES, SECTORS, COMMODITIES, CRYPTO } from '$lib/config/markets';
import type { MarketItem, SectorPerformance, CryptoItem } from '$lib/types';
import { fetchWithProxy, logger, FINNHUB_API_KEY, FINNHUB_BASE_URL } from '$lib/config/api';

/**
 * Mock data for markets (fallback for network failures or rate limits)
 */
const MOCK_MARKETS = {
	indices: [
		{ symbol: '^GSPC', name: 'S&P 500', price: 5123.44, change: 12.33, changePercent: 0.24, type: 'index' as const },
		{ symbol: '^IXIC', name: 'NASDAQ', price: 16274.94, change: -45.12, changePercent: -0.28, type: 'index' as const },
		{ symbol: '^DJI', name: 'Dow Jones', price: 39127.14, change: 172.5, changePercent: 0.44, type: 'index' as const }
	],
	crypto: [
		{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', current_price: 67432.12, price_change_24h: 1244.5, price_change_percentage_24h: 1.88 },
		{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum', current_price: 3544.22, price_change_24h: -12.4, price_change_percentage_24h: -0.35 }
	],
	commodities: [
		{ symbol: 'GC=F', name: 'Gold', price: 2164.50, change: 15.20, changePercent: 0.71, type: 'commodity' as const },
		{ symbol: 'CL=F', name: 'Crude Oil', price: 81.24, change: -0.45, changePercent: -0.55, type: 'commodity' as const }
	]
};

interface CoinGeckoPrice {
	usd: number;
	usd_24h_change?: number;
}

interface CoinGeckoPricesResponse {
	[key: string]: CoinGeckoPrice;
}

interface FinnhubQuote {
	c: number; // Current price
	d: number; // Change
	dp: number; // Percent change
	h: number; // High price of the day
	l: number; // Low price of the day
	o: number; // Open price of the day
	pc: number; // Previous close price
	t: number; // Timestamp
}

/**
 * Check if Finnhub API key is configured
 */
function hasFinnhubApiKey(): boolean {
	return Boolean(FINNHUB_API_KEY && FINNHUB_API_KEY.length > 0);
}

/**
 * Create an empty market item
 */
function createEmptyMarketItem<T extends 'index' | 'commodity'>(
	symbol: string,
	name: string,
	type: T
): MarketItem {
	const mock = [...MOCK_MARKETS.indices, ...MOCK_MARKETS.commodities].find(m => m.symbol === symbol);
	return (mock as MarketItem) || { symbol, name, price: NaN, change: NaN, changePercent: NaN, type };
}

/**
 * Create an empty sector performance item
 */
function createEmptySectorItem(symbol: string, name: string): SectorPerformance {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN };
}

const INDEX_ETF_MAP: Record<string, string> = {
	'^DJI': 'DIA',
	'^GSPC': 'SPY',
	'^IXIC': 'QQQ',
	'^RUT': 'IWM'
};

/**
 * Fetch a quote from Finnhub
 */
async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
	if (!hasFinnhubApiKey()) return null;
	try {
		const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data: FinnhubQuote = await response.json();
		return (data.c === 0 && data.pc === 0) ? null : data;
	} catch (error) {
		return null;
	}
}

/**
 * Fetch crypto prices from CoinGecko
 */
export async function fetchCryptoPrices(): Promise<CryptoItem[]> {
	try {
		const ids = CRYPTO.map((c) => c.id).join(',');
		const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

		const response = await fetchWithProxy(coinGeckoUrl);
		if (!response.ok) throw new Error('Proxy failed');

		const data: CoinGeckoPricesResponse = await response.json();

		return CRYPTO.map((crypto) => {
			const priceData = data[crypto.id];
			return {
				id: crypto.id,
				symbol: crypto.symbol,
				name: crypto.name,
				current_price: priceData?.usd || MOCK_MARKETS.crypto.find(c => c.id === crypto.id)?.current_price || 0,
				price_change_24h: priceData?.usd_24h_change || 0,
				price_change_percentage_24h: priceData?.usd_24h_change || 0
			};
		});
	} catch (error) {
		return CRYPTO.map(c => {
			const mock = MOCK_MARKETS.crypto.find(m => m.id === c.id);
			return mock || { id: c.id, symbol: c.symbol, name: c.name, current_price: 0, price_change_24h: 0, price_change_percentage_24h: 0 };
		});
	}
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch market indices from Finnhub
 */
export async function fetchIndices(): Promise<MarketItem[]> {
	if (!hasFinnhubApiKey()) return MOCK_MARKETS.indices;

	try {
		const results: MarketItem[] = [];
		for (const index of INDICES) {
			const etfSymbol = INDEX_ETF_MAP[index.symbol] || index.symbol;
			const quote = await fetchFinnhubQuote(etfSymbol);
			
			if (quote) {
				results.push({ symbol: index.symbol, name: index.name, price: quote.c, change: quote.d, changePercent: quote.dp, type: 'index' });
			} else {
				const mock = MOCK_MARKETS.indices.find(m => m.symbol === index.symbol);
				results.push(mock || createEmptyMarketItem(index.symbol, index.name, 'index'));
			}
			await delay(200);
		}
		return results;
	} catch (error) {
		return MOCK_MARKETS.indices;
	}
}

/**
 * Fetch sector performance from Finnhub
 */
export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
	if (!hasFinnhubApiKey()) return SECTORS.map(s => createEmptySectorItem(s.symbol, s.name));

	try {
		const results: SectorPerformance[] = [];
		for (const sector of SECTORS) {
			const quote = await fetchFinnhubQuote(sector.symbol);
			results.push({
				symbol: sector.symbol,
				name: sector.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN
			});
			await delay(200);
		}
		return results;
	} catch (error) {
		return SECTORS.map(s => createEmptySectorItem(s.symbol, s.name));
	}
}

/**
 * Fetch commodities from Finnhub
 */
export async function fetchCommodities(): Promise<MarketItem[]> {
	if (!hasFinnhubApiKey()) return MOCK_MARKETS.commodities;

	try {
		const results: MarketItem[] = [];
		for (const commodity of COMMODITIES) {
			const finnhubSymbol = (COMMODITY_SYMBOL_MAP as any)[commodity.symbol] || commodity.symbol;
			const quote = await fetchFinnhubQuote(finnhubSymbol);
			
			if (quote) {
				results.push({ symbol: commodity.symbol, name: commodity.name, price: quote.c, change: quote.d, changePercent: quote.dp, type: 'commodity' });
			} else {
				const mock = MOCK_MARKETS.commodities.find(m => m.symbol === commodity.symbol);
				results.push(mock || createEmptyMarketItem(commodity.symbol, commodity.name, 'commodity'));
			}
			await delay(200);
		}
		return results;
	} catch (error) {
		return MOCK_MARKETS.commodities;
	}
}

const COMMODITY_SYMBOL_MAP = {
	'^VIX': 'VIXY',
	'GC=F': 'GLD',
	'CL=F': 'USO',
	'NG=F': 'UNG',
	'SI=F': 'SLV',
	'HG=F': 'CPER'
};

interface AllMarketsData {
	crypto: CryptoItem[];
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
}

/**
 * Fetch all market data
 */
export async function fetchAllMarkets(): Promise<AllMarketsData> {
	const [crypto, indices, sectors, commodities] = await Promise.all([
		fetchCryptoPrices(),
		fetchIndices(),
		fetchSectorPerformance(),
		fetchCommodities()
	]);

	return { crypto, indices, sectors, commodities };
}
