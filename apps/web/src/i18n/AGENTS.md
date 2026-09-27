# i18n rules

- CashewBlog is single-locale. `src/i18n/languages/zh_CN.ts` is the only dictionary; every `I18nKey` needs a non-empty value there. Keep its keys synchronized with `src/i18n/i18nKey.ts` and delete keys when their last consumer goes away.
- Parameterized copy keeps its placeholder names (`{date}`, `{days}`); replace them in the consuming component. Do not add a second translation system.
- Do not put route-specific data, counts, dates, or user names into the dictionary. Pass those values into a template at the consumer.
- Run `pnpm check` after i18n changes.
