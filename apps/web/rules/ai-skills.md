# AI Skills 维护规则

> 本文是 Shirone AI skills 的硬性规则。操作步骤见 `docs/ai-skills-maintenance.md`。

## 1. 唯一源目录

- 技能本体唯一存放在 `.agents/skills/`。
- 每个技能使用 `.agents/skills/<skill-name>/SKILL.md`，可按需附带 `agents/openai.yaml` 和资源文件。
- `artifacts/` 下的插件目录与 ZIP 都是生成物，不得作为第二份源码维护或手工修改。
- 项目内 Agent 依赖 `.agents/skills/` 自动发现；打包脚本从该目录动态扫描，不维护技能清单副本。

## 2. 技能契约

- 目录名必须与 frontmatter 的 `name` 完全一致，使用 kebab-case，并以 `shirone-` 开头。
- `description` 使用英文，面向任务触发匹配，保持明确、具体且不超过 1024 个字符。
- 技能正文使用中文，描述“何时触发、先读哪些权威文档、必须遵守哪些边界、如何验证”；详细规范只在 `rules/` 或 `docs/` 保留一份。
- 技能只能引用仓库中真实存在的路径；移动或删除文档时必须同步更新引用。
- 一个技能应覆盖一个稳定的任务域。若触发条件、输入和验证方式明显不同，拆成多个技能；若只是同一流程的补充，合并到已有技能。
- 不得在技能中关闭、改变或臆测现有功能默认值；可选功能必须遵守零额外负担规则。
- `disable-model-invocation` 不得设置为 `true`，除非有经过评审的明确理由。

## 3. 功能变更与文档边界

当项目增加或修改功能时，先判断变化属于哪一层：

| 变化 | AI skills 本体 | 项目文档/规则 |
|---|---|---|
| 触发条件、任务步骤、技能入口变化 | 必须更新 | 按需更新索引 |
| 权威架构、API、配置默认值、行为契约变化 | 引用新文档或更新摘要 | 必须更新 `rules/` 或 `docs/` |
| 仅修正文档错字且不改变流程 | 更新对应一份即可 | 不制造重复改动 |
| 仅修改源码实现且现有流程未变 | 不更新 | 按项目代码流程处理 |

技能不得复制项目规则的完整段落。项目文档不得复制技能的触发描述；两者通过路径和链接关联。

## 4. 两份提交约定

当一次功能变更同时影响 skills 和项目文档时，拆成两份有内容的提交：

1. **skills 提交**：只包含 `.agents/skills/**` 以及直接服务于 skills 的发现、校验、打包工具（如 `scripts/check-skills.mjs`、`scripts/package-skills.mjs`、对应 package script 和 CI 校验）。提交信息使用 `docs(skills): ...`。
2. **项目文档提交**：包含 `AGENTS.md`、`rules/**`、`docs/**`、项目 README 或功能说明文档。提交信息使用 `docs(project): ...`。

新增技能引用的新权威文档时，先提交项目文档，再提交 skills；否则 skills 提交会引用不存在的路径。两个提交都必须有实际改动，不创建空提交。

不要把源码、配置默认值或测试实现混入 skills 提交。若功能代码也发生变化，按项目既有提交策略单独归入项目实现提交，不能借 skills 提交隐藏代码变更。

## 5. 验证门禁

修改 skills 后必须运行：

```text
pnpm.cmd check:manifest
python <skill-creator>/scripts/quick_validate.py .agents/skills/<skill-name>
pnpm.cmd skills:package -- --zip --output <temporary-output>.zip
```

生成插件目录后，用 Codex plugin creator 的 `validate_plugin.py` 校验；临时产物验证完删除。修改项目功能或权威文档时，再运行对应的 `npx.cmd astro check`、类型检查和最小相关测试。

## 6. 维护禁区

- 不复制 `.agents/skills/` 到 `plugins/`、`src/` 或其他目录作为长期副本。
- 不手工编辑打包后的 `plugin.json` 或 ZIP 内容。
- 不为了让技能“看起来更多”而拆分技能，不为了提交数量而创建空提交。
- 不因新增 skills 而关闭已有功能；默认值变化必须在项目文档和变更说明中明确记录并经过确认。
