# Internationalization Scope

- Every new `I18nKey` must have a non-empty value in all ten locale modules under `src/i18n/languages/`. Keep locale object keys synchronized with `src/i18n/i18nKey.ts`; the type check catches missing keys but does not prove that values are meaningful.
- Parameterized copy must preserve the exact placeholder-name set across locales, such as `{date}` or `{days}`. Replace placeholders in the consuming component or page; do not add a second ad-hoc translation system.
- When adding a supported language or alias, update the lookup map in `src/i18n/translation.ts` and verify fallback behavior. Keep the existing locale module naming and exported object shape.
- Do not put route-specific data, counts, dates, or user names into locale files. Pass those values into an existing localized template at the consumer and test the replacement path when it is user-visible.
- For i18n changes, run `npx.cmd astro check` and the focused page/component test that renders the new key. Check at least one non-default locale when the change affects layout-sensitive copy.
