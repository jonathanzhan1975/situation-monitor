import { writable, derived, get } from 'svelte/store';
import type { NewsItem, NewsCategory } from '$lib/types';

const NEWS_CATEGORIES: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

// Immediate mock data to prevent blank screen
const MOCK_INITIAL_NEWS: NewsItem[] = [
	{ id: 'init-1', title: 'Global Market Monitoring Active', source: 'System', category: 'finance', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: false, topics: ['system'] },
	{ id: 'init-2', title: 'Intelligence feeds initializing...', source: 'OSINT', category: 'intel', pubDate: new Date().toISOString(), timestamp: Date.now(), link: '#', isAlert: true, alertKeyword: 'initialization', topics: ['system'] }
];

export interface CategoryState {
	items: NewsItem[];
	loading: boolean;
	error: string | null;
	lastUpdated: number | null;
}

export interface NewsState {
	categories: Record<NewsCategory, CategoryState>;
	initialized: boolean;
}

function createInitialState(): NewsState {
	const categories = {} as Record<NewsCategory, CategoryState>;
	for (const category of NEWS_CATEGORIES) {
		categories[category] = {
			items: category === 'intel' || category === 'finance' ? MOCK_INITIAL_NEWS.filter(n => n.category === category) : [],
			loading: false,
			error: null,
			lastUpdated: Date.now()
		};
	}
	return { categories, initialized: true };
}

function createNewsStore() {
	const { subscribe, set, update } = writable<NewsState>(createInitialState());

	return {
		subscribe,
		setLoading: (category: NewsCategory, loading: boolean) => update(s => ({
			...s, categories: { ...s.categories, [category]: { ...s.categories[category], loading } }
		})),
		setItems: (category: NewsCategory, items: NewsItem[]) => update(s => ({
			...s, categories: { ...s.categories, [category]: { items, loading: false, error: null, lastUpdated: Date.now() } }
		})),
		setError: (category: NewsCategory, error: string) => update(s => ({
			...s, categories: { ...s.categories, [category]: { ...s.categories[category], loading: false, error } }
		})),
		init: () => update(s => ({ ...s, initialized: true })),
		clearAll: () => set(createInitialState())
	};
}

export const news = createNewsStore();

// Exports for category specific usage
export const politicsNews = derived(news, ($news) => $news.categories.politics);
export const techNews = derived(news, ($news) => $news.categories.tech);
export const financeNews = derived(news, ($news) => $news.categories.finance);
export const govNews = derived(news, ($news) => $news.categories.gov);
export const aiNews = derived(news, ($news) => $news.categories.ai);
export const intelNews = derived(news, ($news) => $news.categories.intel);

export const allNewsItems = derived(news, ($news) => {
	return NEWS_CATEGORIES.flatMap(cat => $news.categories[cat].items);
});

export const alerts = derived(news, ($news) => {
	return NEWS_CATEGORIES.flatMap(cat => $news.categories[cat].items.filter(i => i.isAlert));
});

export const isLoading = derived(news, ($news) => NEWS_CATEGORIES.some(cat => $news.categories[cat].loading));
export const hasErrors = derived(news, ($news) => NEWS_CATEGORIES.some(cat => $news.categories[cat].error !== null));
