/**
 * FRED API - Federal Reserve Economic Data
 * Also includes Fed RSS feed fetching for news/speeches
 *
 * Get your free API key at: https://fred.stlouisfed.org/docs/api/api_key.html
 */

import { FRED_API_KEY, FRED_BASE_URL, logger, fetchWithProxy } from '$lib/config/api';

export interface FredObservation {
	date: string;
	value: string;
}

export interface FredSeriesResponse {
	observations: FredObservation[];
}

export interface EconomicIndicator {
	seriesId: string;
	name: string;
	value: number | null;
	previousValue: number | null;
	change: number | null;
	unit: string;
	date: string | null;
}

export interface FedIndicators {
	fedFundsRate: EconomicIndicator;
	cpi: EconomicIndicator;
	treasury10Y: EconomicIndicator;
}

/**
 * Mock data for FRED indicators (fallback for missing API key or network failure)
 */
const MOCK_FED_INDICATORS: FedIndicators = {
	fedFundsRate: { seriesId: 'FEDFUNDS', name: 'Fed Funds Rate', value: 5.33, previousValue: 5.33, change: 0, unit: '%', date: new Date().toISOString() },
	cpi: { seriesId: 'CPIAUCSL', name: 'CPI Inflation', value: 3.1, previousValue: 3.2, change: -0.1, unit: '%', date: new Date().toISOString() },
	treasury10Y: { seriesId: 'DGS10', name: '10Y Treasury', value: 4.25, previousValue: 4.18, change: 0.07, unit: '%', date: new Date().toISOString() }
};

/**
 * Check if FRED API key is configured
 */
export function isFredConfigured(): boolean {
	return FRED_API_KEY.length > 0;
}

/**
 * Create an empty indicator (used for error/missing data states)
 */
function createEmptyIndicator(seriesId: string, name: string, unit: string): EconomicIndicator {
	return {
		seriesId,
		name,
		value: null,
		previousValue: null,
		change: null,
		unit,
		date: null
	};
}

/**
 * Fetch a single FRED series with the latest 2 observations
 */
async function fetchFredSeries(seriesId: string): Promise<FredObservation[]> {
	if (!isFredConfigured()) return [];
	try {
		const url = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=2`;
		const response = await fetchWithProxy(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const data: FredSeriesResponse = await response.json();
		return data.observations || [];
	} catch (error) {
		logger.error('FRED API', `Error fetching series ${seriesId}:`, error);
		return [];
	}
}

/**
 * Parse FRED observation value (handles "." for missing data)
 */
function parseValue(obs: FredObservation | undefined): number | null {
	if (!obs || obs.value === '.') return null;
	const val = parseFloat(obs.value);
	return isNaN(val) ? null : val;
}

/**
 * Fetch Federal Funds Effective Rate
 */
async function fetchFedFundsRate(): Promise<EconomicIndicator> {
	const seriesId = 'FEDFUNDS';
	const name = 'Fed Funds Rate';
	const unit = '%';

	if (!isFredConfigured()) {
		return MOCK_FED_INDICATORS.fedFundsRate;
	}

	const observations = await fetchFredSeries(seriesId);
	const current = parseValue(observations[0]);
	const previous = parseValue(observations[1]);

	return {
		seriesId,
		name,
		value: current,
		previousValue: previous,
		change: current !== null && previous !== null ? current - previous : null,
		unit,
		date: observations[0]?.date || null
	};
}

/**
 * Fetch Consumer Price Index (Year-over-Year % Change)
 */
async function fetchCPI(): Promise<EconomicIndicator> {
	const seriesId = 'CPIAUCSL';
	const name = 'CPI Inflation';
	const unit = '%';

	if (!isFredConfigured()) {
		return MOCK_FED_INDICATORS.cpi;
	}

	try {
		const url = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=14`;
		const response = await fetchWithProxy(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const data: FredSeriesResponse = await response.json();
		const observations = data.observations || [];

		if (observations.length < 13) {
			return MOCK_FED_INDICATORS.cpi;
		}

		const currentCPI = parseValue(observations[0]);
		const yearAgoCPI = parseValue(observations[12]);
		const previousMonthCPI = parseValue(observations[1]);
		const prevYearAgoCPI = observations.length >= 14 ? parseValue(observations[13]) : yearAgoCPI;

		if (currentCPI === null || yearAgoCPI === null) {
			return MOCK_FED_INDICATORS.cpi;
		}

		const yoyChange = ((currentCPI - yearAgoCPI) / yearAgoCPI) * 100;
		const prevYoyChange =
			previousMonthCPI !== null && prevYearAgoCPI !== null
				? ((previousMonthCPI - prevYearAgoCPI) / prevYearAgoCPI) * 100
				: null;

		return {
			seriesId,
			name,
			value: Math.round(yoyChange * 100) / 100,
			previousValue: prevYoyChange !== null ? Math.round(prevYoyChange * 100) / 100 : null,
			change: prevYoyChange !== null ? Math.round((yoyChange - prevYoyChange) * 100) / 100 : null,
			unit,
			date: observations[0]?.date || null
		};
	} catch (error) {
		logger.warn('FRED API', 'Error fetching CPI, using mock');
		return MOCK_FED_INDICATORS.cpi;
	}
}

/**
 * Fetch 10-Year Treasury Constant Maturity Rate
 */
async function fetchTreasury10Y(): Promise<EconomicIndicator> {
	const seriesId = 'DGS10';
	const name = '10Y Treasury';
	const unit = '%';

	if (!isFredConfigured()) {
		return MOCK_FED_INDICATORS.treasury10Y;
	}

	const observations = await fetchFredSeries(seriesId);
	const current = parseValue(observations[0]);
	const previous = parseValue(observations[1]);

	return {
		seriesId,
		name,
		value: current,
		previousValue: previous,
		change:
			current !== null && previous !== null ? Math.round((current - previous) * 100) / 100 : null,
		unit,
		date: observations[0]?.date || null
	};
}

/**
 * Fetch all Fed economic indicators
 */
export async function fetchFedIndicators(): Promise<FedIndicators> {
	logger.log('FRED API', 'Fetching Fed indicators');

	try {
		const [fedFundsRate, cpi, treasury10Y] = await Promise.all([
			fetchFedFundsRate(),
			fetchCPI(),
			fetchTreasury10Y()
		]);

		return { fedFundsRate, cpi, treasury10Y };
	} catch (e) {
		return MOCK_FED_INDICATORS;
	}
}

// ============================================================================
// Fed RSS News Fetching
// ============================================================================

const FED_BASE_URL_SITE = 'https://www.federalreserve.gov';

/**
 * Fed RSS feed configuration
 */
const FED_RSS_FEEDS = [
	{ url: `${FED_BASE_URL_SITE}/feeds/press_monetary.xml`, type: 'monetary', label: 'Monetary Policy' },
	{ url: `${FED_BASE_URL_SITE}/feeds/s_t_powell.xml`, type: 'powell', label: 'Chair Powell' },
	{ url: `${FED_BASE_URL_SITE}/feeds/speeches.xml`, type: 'speech', label: 'Speeches' },
	{ url: `${FED_BASE_URL_SITE}/feeds/testimony.xml`, type: 'testimony', label: 'Testimony' },
	{ url: `${FED_BASE_URL_SITE}/feeds/press_other.xml`, type: 'announcement', label: 'Announcements' }
] as const;

export type FedNewsType = (typeof FED_RSS_FEEDS)[number]['type'];

export interface FedNewsItem {
	id: string;
	title: string;
	link: string;
	description: string;
	pubDate: string;
	timestamp: number;
	type: FedNewsType;
	typeLabel: string;
	isPowellRelated: boolean;
	hasVideo: boolean;
}

/**
 * Simple hash for generating unique IDs
 */
function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Parse RSS XML and extract items
 */
function parseRssXml(xml: string, type: FedNewsType, typeLabel: string): FedNewsItem[] {
	const items: FedNewsItem[] = [];

	const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
	const titleRegex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
	const linkRegex = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
	const descRegex = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
	const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/i;

	let match;
	while ((match = itemRegex.exec(xml)) !== null) {
		const itemXml = match[1];

		const titleMatch = titleRegex.exec(itemXml);
		const linkMatch = linkRegex.exec(itemXml);
		const descMatch = descRegex.exec(itemXml);
		const pubDateMatch = pubDateRegex.exec(itemXml);

		const title = titleMatch?.[1]?.trim() || '';
		const link = linkMatch?.[1]?.trim() || '';
		const description = descMatch?.[1]?.trim().replace(/<[^>]*>/g, '') || '';
		const pubDate = pubDateMatch?.[1]?.trim() || '';

		if (!title || !link) continue;

		const fullText = `${title} ${description}`.toLowerCase();
		const isPowellRelated = type === 'powell' || /powell|chair(?:man)?/.test(fullText);
		const hasVideo = /video|webcast|watch|broadcast|live/.test(fullText);

		items.push({
			id: `fed-${type}-${hashString(link)}`,
			title,
			link: link.startsWith('http') ? link : `${FED_BASE_URL_SITE}${link}`,
			description,
			pubDate,
			timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
			type,
			typeLabel,
			isPowellRelated,
			hasVideo
		});
	}

	return items;
}

/**
 * Fetch a single Fed RSS feed
 */
async function fetchFedRssFeed(
	url: string,
	type: FedNewsType,
	typeLabel: string
): Promise<FedNewsItem[]> {
	try {
		const response = await fetchWithProxy(url);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const xml = await response.text();
		return parseRssXml(xml, type, typeLabel);
	} catch (error) {
		return [];
	}
}

/**
 * Fetch all Fed news from RSS feeds
 */
export async function fetchFedNews(): Promise<FedNewsItem[]> {
	const results = await Promise.all(
		FED_RSS_FEEDS.map((feed) => fetchFedRssFeed(feed.url, feed.type, feed.label))
	);

	const seen = new Set<string>();
	const allItems: FedNewsItem[] = [];

	for (const items of results) {
		for (const item of items) {
			if (!seen.has(item.link)) {
				seen.add(item.link);
				allItems.push(item);
			}
		}
	}

	return allItems.sort((a, b) => b.timestamp - a.timestamp);
}
