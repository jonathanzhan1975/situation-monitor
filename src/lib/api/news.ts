/**
 * News API - Fetch news from GDELT and other sources
 */

import { FEEDS } from '$lib/config/feeds';
import type { NewsItem, NewsCategory } from '$lib/types';
import { containsAlertKeyword, detectRegion, detectTopics } from '$lib/config/keywords';
import { fetchWithProxy, API_DELAYS, logger } from '$lib/config/api';

/**
 * Simple hash function to generate unique IDs from URLs
 */
function hashCode(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(36);
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse GDELT date format (20251202T224500Z) to valid Date
 */
function parseGdeltDate(dateStr: string): Date {
	if (!dateStr) return new Date();
	// Convert 20251202T224500Z to 2025-12-02T22:45:00Z
	const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
	if (match) {
		const [, year, month, day, hour, min, sec] = match;
		return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
	}
	// Fallback to standard parsing
	return new Date(dateStr);
}

interface GdeltArticle {
	title: string;
	url: string;
	seendate: string;
	domain: string;
	socialimage?: string;
}

interface GdeltResponse {
	articles?: GdeltArticle[];
}

/**
 * Transform GDELT article to NewsItem
 */
function transformGdeltArticle(
	article: GdeltArticle,
	category: NewsCategory,
	source: string,
	index: number
): NewsItem {
	const title = article.title || '';
	const alert = containsAlertKeyword(title);
	// Generate unique ID using category, URL hash, and index
	const urlHash = article.url ? hashCode(article.url) : Math.random().toString(36).slice(2);
	const uniqueId = `gdelt-${category}-${urlHash}-${index}`;

	const parsedDate = parseGdeltDate(article.seendate);

	return {
		id: uniqueId,
		title,
		link: article.url,
		pubDate: article.seendate,
		timestamp: parsedDate.getTime(),
		source: source || article.domain || 'Unknown',
		category,
		isAlert: !!alert,
		alertKeyword: alert?.keyword || undefined,
		region: detectRegion(title) ?? undefined,
		topics: detectTopics(title)
	};
}

/**
 * Fetch news from RSS feeds as a fallback for GDELT
 */
async function fetchRssFallback(category: NewsCategory): Promise<NewsItem[]> {
	const categoryFeeds = FEEDS[category] || [];
	if (categoryFeeds.length === 0) return [];

	const results: NewsItem[] = [];
	// Try the first 2 feeds from the category
	for (const feed of categoryFeeds.slice(0, 2)) {
		try {
			logger.log('News API', `Trying RSS fallback for ${category}: ${feed.name}`);
			const response = await fetchWithProxy(feed.url);
			if (!response.ok) continue;

			const xml = await response.text();
			// Simple regex-based RSS parsing since we don't have a full XML parser in-browser
			const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
			
			for (const item of items.slice(0, 5)) {
				const title = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] || 
							  item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
				const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
				const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
				
				if (title && link) {
					const alert = containsAlertKeyword(title);
					results.push({
						id: `rss-${hashCode(link)}`,
						title: title.trim(),
						link: link.trim(),
						pubDate,
						timestamp: new Date(pubDate).getTime() || Date.now(),
						source: feed.name,
						category,
						isAlert: !!alert,
						alertKeyword: alert?.keyword || undefined,
						topics: detectTopics(title)
					});
				}
			}
		} catch (e) {
			continue;
		}
	}
	return results;
}

/**
 * Mock data for extreme network failure
 */
const MOCK_NEWS: Record<NewsCategory, NewsItem[]> = {
	politics: [
		{ id: 'mock-1', title: '全球贸易局势因新关税提案而升级', source: '情报报告', category: 'politics', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: true, alertKeyword: 'tariff', topics: ['trade'] },
		{ id: 'mock-2', title: '下月将在苏黎世举行外交峰会', source: '环球时报', category: 'politics', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: false, topics: ['diplomacy'] }
	],
	intel: [
		{ id: 'mock-3', title: '北大西洋监测到不明海军活动', source: 'OSINT Beta', category: 'intel', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: true, alertKeyword: 'naval', region: 'North Atlantic', topics: ['military'] }
	],
	tech: [{ id: 'mock-4', title: '大型实验室宣布量子计算取得突破', source: '科技评论', category: 'tech', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: false, topics: ['quantum'] }],
	finance: [{ id: 'mock-5', title: '央行暗示利率政策可能发生转变', source: '市场新闻', category: 'finance', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: false, topics: ['economy'] }],
	ai: [{ id: 'mock-6', title: '发布用于多步推理的新型自主代理框架', source: 'AI 周刊', category: 'ai', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: false, topics: ['ai'] }],
	gov: [{ id: 'mock-7', title: '立法会议提出新的数据隐私法规', source: '政策日报', category: 'gov', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: false, topics: ['regulation'] }]
};

/**
 * Fetch news for a specific category using GDELT via proxy
 */
export async function fetchCategoryNews(category: NewsCategory): Promise<NewsItem[]> {
	const categoryQueries: Record<NewsCategory, string> = {
		politics: 'politics government election',
		tech: 'technology software startup',
		finance: 'finance economy banking',
		gov: 'government regulation congress',
		ai: 'artificial intelligence machine learning',
		intel: 'intelligence security military defense'
	};

	try {
		const baseQuery = categoryQueries[category];
		const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${baseQuery}&timespan=3d&mode=artlist&maxrecords=10&format=json&sort=date`;

		logger.log('News API', `Fetching ${category} from GDELT`);

		const response = await fetchWithProxy(gdeltUrl);
		const text = await response.text();
		
		// Robust JSON extraction: look for actual JSON object
		const jsonStart = text.indexOf('{"articles"');
		if (jsonStart === -1) {
			throw new Error('No valid GDELT JSON found in response (likely 522/504 error page)');
		}
		
		const jsonEnd = text.lastIndexOf('}');
		const data = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GdeltResponse;

		if (!data?.articles || data.articles.length === 0) {
			const rss = await fetchRssFallback(category);
			return rss.length > 0 ? rss : MOCK_NEWS[category];
		}

		return data.articles.map((article, index) =>
			transformGdeltArticle(article, category, article.domain || 'GDELT', index)
		);
	} catch (error) {
		logger.warn('News API', `Fallback for ${category} due to: ${error instanceof Error ? error.message : 'Unknown error'}`);
		const rss = await fetchRssFallback(category);
		return rss.length > 0 ? rss : MOCK_NEWS[category];
	}
}

/** All news categories in fetch order */
const NEWS_CATEGORIES: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

/** Create an empty news result object */
function createEmptyNewsResult(): Record<NewsCategory, NewsItem[]> {
	return { politics: [], tech: [], finance: [], gov: [], ai: [], intel: [] };
}

/**
 * Fetch all news - sequential with delays to avoid rate limiting
 */
export async function fetchAllNews(): Promise<Record<NewsCategory, NewsItem[]>> {
	const result = createEmptyNewsResult();

	for (let i = 0; i < NEWS_CATEGORIES.length; i++) {
		const category = NEWS_CATEGORIES[i];

		if (i > 0) {
			await delay(API_DELAYS.betweenCategories);
		}

		result[category] = await fetchCategoryNews(category);
	}

	return result;
}
