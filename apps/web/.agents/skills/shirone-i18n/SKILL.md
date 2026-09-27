---
name: shirone-i18n
description: Adding or changing user-facing UI copy in the Shirone theme - I18nKey enum, ten locale modules, placeholder parity, and translation lookup. Use when introducing, renaming, or editing interface strings, or adding supported languages.
---

# Shirone 国际化(i18n)

Shirone 禁止硬编码用户可见组件文案:所有 UI 字符串走 `src/i18n/i18nKey.ts` 的 `I18nKey` 枚举注册,由消费方用 `i18n()` 按 `siteConfig` 的语言渲染。

## 核心红线

1. **十个语言全量同步**:每个新 `I18nKey` 必须在 `src/i18n/languages/` 下全部 10 个 locale 模块(`en`、`es`、`id`、`ja`、`ko`、`th`、`tr`、`vi`、`zh_CN`、`zh_TW`)有非空值;类型检查能发现缺 key,但**不能**证明译文有意义。
2. **占位符一致**:参数化文案在各 locale 保持相同占位符名(如 `{date}`、`{days}`);由消费方组件/页面替换占位符,不得新建第二套临时翻译机制。
3. **locale 文件只放文案**:路由数据、计数、日期、用户名等不得进语言文件;在消费处传入已有本地化模板。
4. **循环依赖**:约束与被消费它的配置模块相反——依赖 `siteConfig` 的 `src/i18n/translation.ts` 属于反向依赖链,`navBarConfig` 等消费 i18n 的配置模块只能从具体文件导入(如 `@/config/siteConfig`),**禁止走 `@/config` barrel**,否则形成导入环(详见 `src/config/README.md`)。
5. **新增语言**:同步更新 `src/i18n/translation.ts` 的查找映射并验证 fallback 行为;保持现有 locale 模块命名与导出对象形状。

## 操作要点

- 查现有 key:先在 `src/i18n/i18nKey.ts` 搜索语义相近的 key 复用,避免同义新 key 膨胀。
- 文章级语言用 frontmatter `lang` 覆盖站点默认语言,无需动 locale 模块。

## 必读文档

- `src/i18n/AGENTS.md` — i18n 目录级附加规则
- `src/i18n/i18nKey.ts` — key 枚举单一注册表
- `src/i18n/translation.ts` — `i18n()` 消费入口与语言查找映射
- `src/i18n/languages/` — 十个 locale 模块
- `src/config/README.md` — 导入规则与循环依赖规避

## 验证命令

`npx.cmd astro check`(0 错误)→ 渲染新 key 的最小页面/组件 Playwright 分片 → 至少检查一个非默认 locale 的渲染(文案影响布局时必做);`tests/site/a11y.spec.ts` 用于确认可见标签与可访问名称未被破坏。
