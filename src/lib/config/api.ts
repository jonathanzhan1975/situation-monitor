/**
 * API Configuration
 */

import { browser } from '$app/environment';

/**
 * Finnhub API key
 * Get your free key at: https://finnhub.io/
 * Free tier: 60 calls/minute
 */
export const FINNHUB_API_KEY = browser
	? (import.meta.env?.VITE_FINNHUB_API_KEY ?? '')
	: (process.env.VITE_FINNHUB_API_KEY ?? '');

export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * FRED API key (St. Louis Fed)
 * Get your free key at: https://fred.stlouisfed.org/docs/api/api_key.html
 * Free tier: Unlimited requests
 */
export const FRED_API_KEY = browser
	? (import.meta.env?.VITE_FRED_API_KEY ?? '')
	: (process.env.VITE_FRED_API_KEY ?? '');

export const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

/**
 * Check if we're in development mode
 * Uses import.meta.env which is available in both browser and test environments
 */
const isDev = browser ? (import.meta.env?.DEV ?? false) : false;

export const CORS_PROXIES = {
	primary: 'https://corsproxy.io/?url=',
	secondary: 'https://api.allorigins.win/raw?url=',
	tertiary: 'https://api.codetabs.com/v1/proxy?quest=',
	quaternary: 'https://thingproxy.freeboard.io/fetch/'
} as const;

// Default export for backward compatibility
export const CORS_PROXY_URL = CORS_PROXIES.primary;

export async function fetchWithProxy(url: string, retries = 1): Promise<Response> {
	// Step 1: Try direct fetch with FAST timeout (1.5s)
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 1500);
		const directResponse = await fetch(url, { signal: controller.signal });
		clearTimeout(timeout);
		if (directResponse.ok) return directResponse;
	} catch (e) {
		// Silent catch for direct fetch, expected to fail for CORS
	}

	const encodedUrl = encodeURIComponent(url);
	const proxies = Object.values(CORS_PROXIES);

	for (const proxy of proxies) {
		try {
			logger.log('Proxy', `Attempting fetch via ${new URL(proxy).hostname} for: ${url.slice(0, 50)}...`);
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 6000); // 6s per proxy
			const response = await fetch(proxy + encodedUrl, { 
				signal: controller.signal,
				headers: { 'Accept': 'application/json, application/xml, text/xml, */*' }
			});
			clearTimeout(timeout);
			
			if (response.ok) {
				logger.log('Proxy', `Success using ${new URL(proxy).hostname}`);
				return response;
			}
		} catch (error) {
			// Try next proxy
		}
	}

	if (retries > 0) {
		logger.warn('Proxy', `All proxies failed for ${url.slice(0, 30)}, retrying...`);
		return fetchWithProxy(url, retries - 1);
	}

	throw new Error(`Failed to fetch ${url} after trying all proxies`);
}

/**
 * API request delays (ms) to avoid rate limiting
 */
export const API_DELAYS = {
	betweenCategories: 500,
	betweenRetries: 1000
} as const;

/**
 * Cache TTLs (ms)
 */
export const CACHE_TTLS = {
	weather: 10 * 60 * 1000, // 10 minutes
	news: 5 * 60 * 1000, // 5 minutes
	markets: 60 * 1000, // 1 minute
	default: 5 * 60 * 1000 // 5 minutes
} as const;

/**
 * Debug/logging configuration
 */
export const DEBUG = {
	enabled: isDev,
	logApiCalls: isDev,
	logCacheHits: false
} as const;

/**
 * Conditional logger - only logs in development
 */
export const logger = {
	log: (prefix: string, ...args: unknown[]) => {
		if (DEBUG.logApiCalls) {
			console.log(`[${prefix}]`, ...args);
		}
	},
	warn: (prefix: string, ...args: unknown[]) => {
		console.warn(`[${prefix}]`, ...args);
	},
	error: (prefix: string, ...args: unknown[]) => {
		console.error(`[${prefix}]`, ...args);
	}
};
