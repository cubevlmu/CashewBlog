import type {
	MetingMusicConfig,
	TrackDescriptor,
} from "../../types/musicConfig.ts";

export const DEFAULT_METING_API =
	"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export interface RawMetingSong {
	id?: number | string;
	name?: string;
	title?: string;
	artist?: string;
	author?: string;
	duration?: number | string;
	pic?: string;
	url?: string;
	lrc?: string;
}

/**
 * 根据 Meting 配置组装请求 URL。若 ID 为空则返回 null。
 */
export function buildMetingUrl(config: MetingMusicConfig): string | null {
	const id = config.id?.trim();
	if (!id) return null;

	const api = config.api?.trim() || DEFAULT_METING_API;
	const server = config.server?.trim() || DEFAULT_METING_SERVER;
	const type = config.type?.trim() || DEFAULT_METING_TYPE;
	const random = Date.now().toString();

	return api
		.replace(":server", encodeURIComponent(server))
		.replace(":type", encodeURIComponent(type))
		.replace(":id", encodeURIComponent(id))
		.replace(":auth", "")
		.replace(":r", random);
}

/**
 * 将 Meting API 单曲响应清洗并转换为标准的 TrackDescriptor。
 */
export function parseMetingSong(
	song: RawMetingSong,
	index: number,
	server = DEFAULT_METING_SERVER,
): TrackDescriptor | null {
	if (!song || typeof song !== "object") return null;

	const title = (song.name ?? song.title ?? "").trim();
	const source = (song.url ?? "").trim();
	if (!title || !source) return null;

	const id =
		song.id !== undefined && song.id !== null && String(song.id).trim() !== ""
			? `meting-${server}-${String(song.id).trim()}`
			: `meting-${server}-${index}-${Math.random().toString(36).slice(2, 8)}`;

	const artist = (song.artist ?? song.author ?? "").trim() || undefined;
	const cover = (song.pic ?? "").trim() || undefined;

	let duration: number | undefined;
	if (typeof song.duration === "number" && Number.isFinite(song.duration)) {
		duration =
			song.duration > 10000
				? Math.floor(song.duration / 1000)
				: Math.floor(song.duration);
	} else if (typeof song.duration === "string") {
		const parsed = Number.parseInt(song.duration, 10);
		if (Number.isFinite(parsed) && parsed > 0) {
			duration = parsed > 10000 ? Math.floor(parsed / 1000) : parsed;
		}
	}
	if (duration !== undefined && duration <= 0) {
		duration = undefined;
	}

	return Object.freeze({
		id,
		title,
		source,
		artist,
		cover,
		duration,
	});
}

/**
 * 从 Meting API 异步获取并解析曲目列表。
 */
export async function fetchMetingTracks(
	config: MetingMusicConfig,
	customFetch: typeof fetch = fetch,
): Promise<readonly TrackDescriptor[]> {
	const url = buildMetingUrl(config);
	if (!url) return [];

	const response = await customFetch(url);
	if (!response.ok) {
		throw new Error(`Meting API HTTP ${response.status}`);
	}

	const data = (await response.json()) as RawMetingSong[];
	if (!Array.isArray(data)) return [];

	const server = config.server || DEFAULT_METING_SERVER;
	const tracks: TrackDescriptor[] = [];
	const seenIds = new Set<string>();

	for (let i = 0; i < data.length; i++) {
		const track = parseMetingSong(data[i], i, server);
		if (track && !seenIds.has(track.id)) {
			seenIds.add(track.id);
			tracks.push(track);
		}
	}

	return Object.freeze(tracks);
}
