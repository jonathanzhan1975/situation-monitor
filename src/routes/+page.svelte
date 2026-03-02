<script lang="ts">
	import { onMount } from 'svelte';
	import { Header, Dashboard } from '$lib/components/layout';
	import { SettingsModal, MonitorFormModal, OnboardingModal } from '$lib/components/modals';
	import {
		NewsPanel,
		MarketsPanel,
		HeatmapPanel,
		CommoditiesPanel,
		CryptoPanel,
		MainCharPanel,
		CorrelationPanel,
		NarrativePanel,
		MonitorsPanel,
		MapPanel,
		WhalePanel,
		PolymarketPanel,
		ContractsPanel,
		LayoffsPanel,
		IntelPanel,
		SituationPanel,
		WorldLeadersPanel,
		PrinterPanel,
		FedPanel
	} from '$lib/components/panels';
	import {
		news,
		markets,
		monitors,
		settings,
		refresh,
		allNewsItems,
		fedIndicators,
		fedNews
	} from '$lib/stores';
	import {
		fetchAllNews,
		fetchAllMarkets,
		fetchPolymarket,
		fetchWhaleTransactions,
		fetchGovContracts,
		fetchLayoffs,
		fetchWorldLeaders,
		fetchFedIndicators,
		fetchFedNews
	} from '$lib/api';
	import type { Prediction, WhaleTransaction, Contract, Layoff } from '$lib/api';
	import type { CustomMonitor, WorldLeader } from '$lib/types';
	import type { PanelId } from '$lib/config';

	// Modal state
	let settingsOpen = $state(false);
	let monitorFormOpen = $state(false);
	let onboardingOpen = $state(false);
	let editingMonitor = $state<CustomMonitor | null>(null);

	// Misc panel data
	let predictions = $state<Prediction[]>([]);
	let whales = $state<WhaleTransaction[]>([]);
	let contracts = $state<Contract[]>([]);
	let layoffs = $state<Layoff[]>([]);
	let leaders = $state<WorldLeader[]>([]);
	let leadersLoading = $state(false);

	// Improved Loading Logic
	async function loadNews() {
		const categories = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'] as const;
		categories.forEach(cat => news.setLoading(cat, true));
		try {
			const data = await fetchAllNews();
			Object.entries(data).forEach(([category, items]) => {
				news.setItems(category as any, items);
			});
		} catch (e) {
			console.error('News fail:', e);
		} finally {
			categories.forEach(cat => news.setLoading(cat, false));
		}
	}

	async function loadMarkets() {
		try {
			const data = await fetchAllMarkets();
			if (data.indices) markets.setIndices(data.indices);
			if (data.sectors) markets.setSectors(data.sectors);
			if (data.commodities) markets.setCommodities(data.commodities);
			if (data.crypto) markets.setCrypto(data.crypto);
		} catch (e) {
			console.error('Markets fail:', e);
		}
	}

	async function loadFedData() {
		fedIndicators.setLoading(true);
		fedNews.setLoading(true);
		try {
			const [indicatorsData, newsData] = await Promise.allSettled([
				fetchFedIndicators(),
				fetchFedNews()
			]);
			if (indicatorsData.status === 'fulfilled') fedIndicators.setData(indicatorsData.value);
			if (newsData.status === 'fulfilled') fedNews.setItems(newsData.value);
		} finally {
			fedIndicators.setLoading(false);
			fedNews.setLoading(false);
		}
	}

	async function loadMiscData() {
		Promise.allSettled([
			fetchPolymarket().then(d => predictions = d),
			fetchWhaleTransactions().then(d => whales = d),
			fetchGovContracts().then(d => contracts = d),
			fetchLayoffs().then(d => layoffs = d),
			fetchWorldLeaders().then(d => leaders = d)
		]);
	}

	async function handleRefresh() {
		refresh.startRefresh();
		await Promise.allSettled([loadNews(), loadMarkets(), loadFedData(), loadMiscData()]);
		refresh.endRefresh();
	}

	function isPanelVisible(id: PanelId): boolean {
		// If onboarding not complete, show everything by default to avoid blank screen
		if (!settings.isOnboardingComplete()) return true;
		return $settings.enabled[id] !== false;
	}

	function handleSelectPreset(presetId: string) {
		settings.applyPreset(presetId);
		onboardingOpen = false;
		// Small delay to let Svelte 5 process state change
		setTimeout(() => handleRefresh(), 100);
	}

	onMount(() => {
		if (!settings.isOnboardingComplete()) {
			onboardingOpen = true;
		}

		// Sequential load to ensure UI updates progressively
		(async () => {
			refresh.startRefresh();
			await loadMarkets();
			await loadNews();
			await loadFedData();
			await loadMiscData();
			refresh.endRefresh();
		})();

		refresh.setupAutoRefresh(handleRefresh);
		return () => refresh.stopAutoRefresh();
	});
</script>

<div class="app">
	<Header onSettingsClick={() => (settingsOpen = true)} />
	<main class="main-content">
		<Dashboard>
			{#if isPanelVisible('map')}
				<div class="panel-slot map-slot"><MapPanel monitors={$monitors.monitors} /></div>
			{/if}
			{#if isPanelVisible('politics')}
				<div class="panel-slot"><NewsPanel category="politics" panelId="politics" title="Politics" /></div>
			{/if}
			{#if isPanelVisible('tech')}
				<div class="panel-slot"><NewsPanel category="tech" panelId="tech" title="Tech" /></div>
			{/if}
			{#if isPanelVisible('finance')}
				<div class="panel-slot"><NewsPanel category="finance" panelId="finance" title="Finance" /></div>
			{/if}
			{#if isPanelVisible('gov')}
				<div class="panel-slot"><NewsPanel category="gov" panelId="gov" title="Gov" /></div>
			{/if}
			{#if isPanelVisible('ai')}
				<div class="panel-slot"><NewsPanel category="ai" panelId="ai" title="AI" /></div>
			{/if}
			{#if isPanelVisible('intel')}
				<div class="panel-slot"><NewsPanel category="intel" panelId="intel" title="Intelligence" /></div>
			{/if}
			{#if isPanelVisible('markets')}
				<div class="panel-slot"><MarketsPanel /></div>
			{/if}
			{#if isPanelVisible('crypto')}
				<div class="panel-slot"><CryptoPanel /></div>
			{/if}
			{#if isPanelVisible('commodities')}
				<div class="panel-slot"><CommoditiesPanel /></div>
			{/if}
			{#if isPanelVisible('fed')}
				<div class="panel-slot"><FedPanel /></div>
			{/if}
			{#if isPanelVisible('leaders')}
				<div class="panel-slot"><WorldLeadersPanel {leaders} loading={leadersLoading} /></div>
			{/if}
			{#if isPanelVisible('mainchar')}
				<div class="panel-slot"><MainCharPanel /></div>
			{/if}
			{#if isPanelVisible('correlation')}
				<div class="panel-slot"><CorrelationPanel news={$allNewsItems} /></div>
			{/if}
			{#if isPanelVisible('narrative')}
				<div class="panel-slot"><NarrativePanel news={$allNewsItems} /></div>
			{/if}
			{#if isPanelVisible('whales')}
				<div class="panel-slot"><WhalePanel {whales} /></div>
			{/if}
			{#if isPanelVisible('polymarket')}
				<div class="panel-slot"><PolymarketPanel {predictions} /></div>
			{/if}
			{#if isPanelVisible('layoffs')}
				<div class="panel-slot"><LayoffsPanel {layoffs} /></div>
			{/if}
			{#if isPanelVisible('printer')}
				<div class="panel-slot"><PrinterPanel /></div>
			{/if}
		</Dashboard>
	</main>

	<SettingsModal open={settingsOpen} onClose={() => (settingsOpen = false)} onReconfigure={() => { settingsOpen = false; settings.resetOnboarding(); onboardingOpen = true; }} />
	<MonitorFormModal open={monitorFormOpen} onClose={() => (monitorFormOpen = false)} editMonitor={editingMonitor} />
	<OnboardingModal open={onboardingOpen} onSelectPreset={handleSelectPreset} />
</div>

<style>
	.app { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
	.main-content { flex: 1; padding: 0.5rem; overflow-y: auto; }
	.map-slot { column-span: all; margin-bottom: 0.5rem; }
</style>
