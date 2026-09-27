---
title: Markdown Spoilers
published: 2026-08-28
description: Hide inline answers while keeping spoiler content accessible in Shirone Markdown.
tags: [Demo, Markdown, Accessibility, Shirone]
category: Guides
lang: en
draft: false
---

Spoilers conceal a short answer or plot detail without removing it from the document. Hover, focus, or activate the native control to reveal the content.

## Inline details

The answer is :spoiler[**42**], and this sentence remains ordinary Markdown around it.

Spoilers can include `inline code` and :spoiler[a longer detail with **emphasis**].

## Author syntax

```markdown
The answer is :spoiler[42].
```

The generated HTML uses a native button with an `aria-expanded` state. Without JavaScript, hover and focus still reveal the text; the optional runtime adds click and keyboard toggling.
