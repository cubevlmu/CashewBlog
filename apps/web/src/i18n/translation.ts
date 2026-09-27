import type I18nKey from "./i18nKey.ts";
import { zh_CN } from "./languages/zh_CN.ts";

export type Translation = {
	[K in I18nKey]: string;
};

/** CashewBlog v1 is intentionally single-locale. */
export function getTranslation(_lang = "zh_CN"): Translation {
	return zh_CN;
}

export function i18n(key: I18nKey): string {
	return zh_CN[key];
}
