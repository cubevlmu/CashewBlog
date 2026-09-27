import {
	formatCalendarDate,
	formatInstantDateTimeInSiteTimeZone,
} from "./content-date";

export function formatDateToYYYYMMDD(date: Date): string {
	return formatCalendarDate(date);
}

const DAY_MS = 86_400_000;

function toUtcDayStart(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** 两个日期之间相隔的 UTC 日历天数；未来日期返回负数。 */
export function differenceInUtcCalendarDays(
	date: Date,
	reference: Date = new Date(),
): number {
	return (toUtcDayStart(reference) - toUtcDayStart(date)) / DAY_MS;
}

/** 将用户配置的显示阈值收敛为非负整数。 */
export function normalizeMinimumAgeDays(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export interface LastUpdatedNoticeState {
	days: number;
	visible: boolean;
}

/** 解析最后更新提示的天数与阈值显隐状态。 */
export function resolveLastUpdatedNoticeState(
	date: Date,
	minimumAgeDays: number,
	reference: Date = new Date(),
): LastUpdatedNoticeState {
	const days = differenceInUtcCalendarDays(date, reference);
	return {
		days: Math.max(0, days),
		visible: days >= normalizeMinimumAgeDays(minimumAgeDays),
	};
}

/** 动态流时间戳：YYYY-MM-DD HH:mm（站点时区，用于社交式短内容） */
export function formatDateToYYYYMMDDHHmm(date: Date): string {
	return formatInstantDateTimeInSiteTimeZone(date);
}
