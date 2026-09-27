import type { ArticleConfig } from "@/types/articleConfig";

const MAX_DISCOVERY_COUNT = 6;

export interface ArticleDiscoveryOptions {
	relatedCount: number;
	randomCount: number;
}

export interface ArticleShareOptions {
	includeCover: boolean;
}

export function normalizeDiscoveryCount(value: number): number {
	return Number.isFinite(value)
		? Math.min(MAX_DISCOVERY_COUNT, Math.max(0, Math.floor(value)))
		: 0;
}

export function resolveArticleDiscoveryOptions(
	config: Pick<ArticleConfig, "discovery">,
): ArticleDiscoveryOptions | null {
	if (!config.discovery.enable) return null;

	const relatedCount = config.discovery.related.enable
		? normalizeDiscoveryCount(config.discovery.related.count)
		: 0;
	const randomCount = config.discovery.random.enable
		? normalizeDiscoveryCount(config.discovery.random.count)
		: 0;

	return relatedCount > 0 || randomCount > 0
		? { relatedCount, randomCount }
		: null;
}

export function resolveArticleShareOptions(
	config: Pick<ArticleConfig, "share">,
): ArticleShareOptions | null {
	if (!config.share.enable) return null;
	return { includeCover: config.share.includeCover };
}

export function resolveLastUpdatedNoticeOptions(
	config: Pick<ArticleConfig, "lastUpdated">,
): ArticleConfig["lastUpdated"] | null {
	return config.lastUpdated.enable ? config.lastUpdated : null;
}
