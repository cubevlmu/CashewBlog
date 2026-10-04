export type Value =
  string | number | boolean | null | Value[] | { [key: string]: Value };

export function isDateField(path: string): boolean {
  return path === "general.siteStartDate";
}

/** Collection paths with numeric indices replaced by `*`, e.g. `navigation.*.label`. */
export function normalizePath(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, ".*");
}

/** Keyword lists edited as chips instead of one card per word. */
export function isChipList(path: string): boolean {
  return path === "general.keywords" || path === "seo.keywords";
}

export function isCardCollection(path: string): boolean {
  return [
    "profile.links",
    "navigation",
    "banner.desktop",
    "banner.mobile",
    "sidebar.widgets",
  ].includes(path) || path.endsWith(".children");
}

export function summarizeValue(value: Value): string {
  if (typeof value === "string") return value || "未填写";
  if (Array.isArray(value)) return `${value.length} 项`;
  if (value && typeof value === "object") {
    const record = value as Record<string, Value>;
    return [record.name, record.label, record.title, record.url]
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .join(" · ") || "未填写";
  }
  return value === null ? "未填写" : String(value);
}
export const labels: Record<string, string> = {
  general: "常规",
  profile: "个人资料",
  appearance: "外观",
  banner: "横幅",
  navigation: "导航",
  sidebar: "侧栏",
  announcement: "公告",
  footer: "页脚",
  seo: "SEO",
  analytics: "统计",
  article: "文章",
  dashboard: "仪表盘",
  siteName: "站点名称",
  siteUrl: "站点网址",
  subtitle: "副标题",
  description: "描述",
  keywords: "关键词",
  timezone: "时区",
  language: "语言",
  favicon: "网站图标",
  siteStartDate: "建站日期",
  avatar: "头像",
  name: "名称",
  bio: "简介",
  email: "邮箱",
  links: "链接",
  icon: "图标",
  url: "网址",
  themeHue: "主题色相",
  themeStyle: "主题风格",
  themeSpec: "主题规范",
  defaultMode: "默认明暗模式",
  allowModeSwitch: "允许切换明暗模式",
  backgroundMode: "背景模式",
  texture: "纹理",
  preset: "预设",
  opacity: "透明度",
  allowMotion: "允许动态效果",
  topAppBarAlign: "顶栏对齐",
  progressIndicatorStyle: "进度条样式",
  postList: "文章列表",
  layout: "布局",
  cover: "封面位置",
  cardWidth: "卡片宽度",
  desktop: "桌面横幅图片",
  mobile: "手机横幅图片",
  position: "位置",
  height: "高度",
  dim: "遮罩",
  enable: "启用",
  homeText: "首页文字",
  title: "标题",
  subtitles: "副标题列表",
  typewriter: "打字机",
  speed: "速度",
  deleteSpeed: "删除速度",
  pauseTime: "停留时间（毫秒）",
  loop: "循环",
  carousel: "轮播",
  interval: "间隔（毫秒）",
  fadeDuration: "渐变时长",
  animation: "动画",
  waves: "波浪",
  id: "标识",
  label: "名称",
  type: "类型",
  target: "目标",
  openInNewTab: "新窗口打开",
  children: "子菜单",
  arrangement: "侧栏布局",
  side: "位置",
  widgets: "组件",
  slot: "位置",
  column: "列",
  pages: "显示页面",
  collapseAfter: "折叠数量",
  content: "内容",
  closable: "允许关闭",
  link: "链接",
  text: "文字",
  external: "外部链接",
  html: "HTML",
  titleSeparator: "标题分隔符",
  defaultDescription: "默认描述",
  ogImage: "社交分享图片",
  twitterHandle: "Twitter 账号",
  extraRobots: "额外 robots 规则",
  umami: "Umami",
  shareUrl: "分享地址",
  websiteId: "网站 ID",
  scriptUrl: "脚本地址",
  pageSize: "每页文章数",
  toc: "目录",
  depth: "深度",
  lastUpdated: "更新提醒",
  minimumAgeDays: "最小天数",
  discovery: "文章推荐",
  relatedCount: "相关文章数",
  randomCount: "随机文章数",
  share: "分享",
  includeCover: "包含封面",
  seriesCardPosition: "系列卡片位置",
  x: "横坐标",
  y: "纵坐标",
  w: "宽度",
  h: "高度",
  visible: "显示",
};
export const choices: Record<string, string[]> = {
  themeStyle: [
    "tonalSpot",
    "vibrant",
    "content",
    "expressive",
    "rainbow",
    "fruitSalad",
    "monochrome",
    "neutral",
    "fidelity",
  ],
  themeSpec: ["2021", "2025"],
  defaultMode: ["light", "dark", "system"],
  backgroundMode: ["banner", "none"],
  preset: [
    "none",
    "starlight",
    "cyberDots",
    "topography",
    "geometric",
    "sakura",
  ],
  topAppBarAlign: ["left", "center"],
  progressIndicatorStyle: ["dual", "single"],
  layout: ["list", "grid"],
  cover: ["left", "right"],
  cardWidth: ["compact", "regular", "relaxed"],
  position: ["top", "center", "bottom"],
  height: ["short", "default", "tall"],
  animation: ["kenBurns", "zoomIn", "zoomOut", "panLeft", "panRight", "none"],
  arrangement: ["single", "dual"],
  side: ["left", "right"],
  slot: ["top", "sticky"],
  column: ["primary", "secondary"],
  seriesCardPosition: ["top", "bottom"],
};
export function template(path: string): Value {
  if (path === "navigation" || path.endsWith(".children"))
    return {
      id: crypto.randomUUID(),
      label: "新链接",
      icon: "",
      type: "url",
      target: "",
      openInNewTab: false,
      children: [],
    };
  if (path === "profile.links") return { name: "", icon: "", url: "" };
  if (path === "sidebar.widgets")
    return {
      type: "recentPosts",
      enable: true,
      slot: "sticky",
      column: "primary",
      pages: [],
      collapseAfter: null,
    };
  return "";
}
export const sidebarPages = [
  "home",
  "archive",
  "categories",
  "tags",
  "series",
  "post",
  "page",
  "search",
  "rss",
  "notFound",
];

/** Labels that depend on where a key appears, keyed by normalized path. */
export const fieldLabels: Record<string, string> = {
  navigation: "导航菜单",
  "sidebar.enable": "显示侧栏",
  "announcement.enable": "显示公告",
  "sidebar.widgets.*.enable": "显示此组件",
};

/** Help text under a field, keyed by normalized path. */
export const hints: Record<string, string> = {
  "general.siteUrl": "站点的完整访问地址，用于生成 RSS、站点地图与分享链接。",
  "general.subtitle": "显示在首页与浏览器标题中。",
  "general.keywords": "输入关键词后按回车添加。",
  "general.timezone": "每日统计与“今天”按此时区计算，页面时间也按此时区显示。",
  "general.favicon": "建议使用正方形 PNG 或 SVG。",
  "general.siteStartDate": "用于计算站点运行天数。",
  "profile.avatar": "显示在侧栏个人资料卡片中。",
  "profile.links": "社交与联系链接，拖动调整顺序。",
  "appearance.themeStyle": "Material 3 调色方案，决定辅助色与强调色如何从主题色派生。",
  "appearance.themeSpec": "2025 为 Material 3 Expressive 规范。",
  "appearance.allowModeSwitch": "在顶栏显示明暗模式切换按钮。",
  "appearance.backgroundMode": "“横幅背景”会用横幅图片作为页面背景。",
  "appearance.texture": "叠加在页面背景上的纹理。",
  "appearance.texture.opacity": "纹理的不透明度。",
  "appearance.texture.allowMotion": "允许纹理播放动画；访客开启“减少动态效果”时自动停止。",
  "appearance.progressIndicatorStyle": "页面切换时顶部进度条的样式。",
  "appearance.postList": "首页与归档中文章卡片的排布。",
  "appearance.postList.cover": "封面图片在卡片中的位置。",
  "banner.desktop": "多张图片会按顺序轮播，拖动调整顺序。",
  "banner.mobile": "窄屏设备使用的横幅图片。",
  "banner.dim": "在横幅上叠加暗色遮罩，提高文字可读性。",
  "banner.dim.opacity": "遮罩的不透明度。",
  "banner.homeText": "显示在首页横幅上的标题与副标题。",
  "banner.homeText.title": "留空时使用站点名称。",
  "banner.homeText.subtitles": "多条副标题会配合打字机效果轮流显示。",
  "banner.carousel": "多张横幅图片时的轮播效果。",
  "banner.carousel.interval": "每张图片停留的时长，至少 3000 毫秒。",
  "banner.waves": "横幅底部的波浪装饰。",
  navigation: "顶栏菜单，拖动调整顺序；每项最多两级子菜单。",
  "navigation.*.target": "自定义链接的地址，或独立页面的路径。",
  "sidebar.arrangement": "双列时宽屏左右各显示一列侧栏。",
  "sidebar.side": "单列布局时侧栏所在的一侧。",
  "sidebar.widgets": "拖动调整顺序，点击组件设置显示位置与页面。",
  "sidebar.widgets.*.pages": "留空表示在所有页面显示。",
  "sidebar.widgets.*.collapseAfter": "超过该数量后折叠，留空表示不折叠。",
  "announcement.content": "纯文本，不支持 HTML。",
  "announcement.link": "公告末尾的跳转链接。",
  "footer.html": "受信任的 HTML，会原样插入所有公开页面，其中的脚本也会执行。",
  "seo.titleSeparator": "页面标题与站点名称之间的分隔符，例如“ - ”。",
  "seo.defaultDescription": "页面没有自己的描述时使用。",
  "seo.keywords": "输入关键词后按回车添加。",
  "seo.ogImage": "社交平台分享卡片使用的默认图片。",
  "seo.twitterHandle": "例如 @cashewblog。",
  "seo.extraRobots": "追加到 robots.txt 末尾的规则，每行一条。",
  "analytics.umami": "启用后需要填写脚本地址与网站 ID。",
  "analytics.umami.scriptUrl": "Umami 统计脚本的完整地址。",
  "article.pageSize": "文章列表每页显示的数量。",
  "article.toc.depth": "目录收录的标题层级数。",
  "article.lastUpdated": "文章长时间未更新时显示提醒。",
  "article.lastUpdated.minimumAgeDays": "距最后更新超过该天数才显示提醒。",
  "article.discovery": "文章末尾的相关文章与随机推荐。",
  "article.share.includeCover": "分享卡片中包含文章封面。",
};

/** Bounded numbers: sliders when `slider`, otherwise number inputs with steppers. */
export interface NumberRange {
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  slider?: boolean;
  percent?: boolean;
}
export const ranges: Record<string, NumberRange> = {
  "appearance.texture.opacity": { min: 0.05, max: 0.25, step: 0.01, slider: true, percent: true },
  "banner.dim.opacity": { min: 0, max: 1, step: 0.01, slider: true, percent: true },
  "banner.homeText.typewriter.speed": { min: 0, step: 10, suffix: " 毫秒" },
  "banner.homeText.typewriter.deleteSpeed": { min: 0, step: 10, suffix: " 毫秒" },
  "banner.homeText.typewriter.pauseTime": { min: 0, step: 100, suffix: " 毫秒" },
  "banner.carousel.interval": { min: 3000, step: 500, suffix: " 毫秒" },
  "banner.carousel.fadeDuration": { min: 0, step: 100, suffix: " 毫秒" },
  "sidebar.widgets.*.collapseAfter": { min: 1, step: 1 },
  "article.pageSize": { min: 1, max: 50, step: 1, suffix: " 篇" },
  "article.toc.depth": { min: 1, max: 3, step: 1, suffix: " 级" },
  "article.lastUpdated.minimumAgeDays": { min: 0, step: 1, suffix: " 天" },
  "article.discovery.relatedCount": { min: 0, max: 6, step: 1, suffix: " 篇" },
  "article.discovery.randomCount": { min: 0, max: 6, step: 1, suffix: " 篇" },
};

/** Fields that take the full row: long text, images, lists and custom pickers. */
export function isWideField(path: string): boolean {
  const key = path.split(".").at(-1)!;
  return (
    ["html", "content", "description", "bio", "extraRobots", "defaultDescription", "pages", "themeHue", "subtitles"].includes(key) ||
    isChipList(path) ||
    ["profile.avatar", "general.favicon", "seo.ogImage"].includes(path)
  );
}

/** Named groups for a section's top-level fields; anything unlisted goes to "基本设置". */
const sectionGroups: Record<string, { title: string; hint?: string; fields: string[] }[]> = {
  general: [
    { title: "站点信息", fields: ["siteName", "siteUrl", "subtitle", "description", "keywords"] },
    { title: "区域与图标", fields: ["timezone", "language", "siteStartDate", "favicon"] },
  ],
  profile: [{ title: "个人资料", hint: "显示在侧栏个人资料卡片与文章作者信息中。", fields: ["avatar", "name", "email", "bio"] }],
  appearance: [
    { title: "主题色", hint: "站点的配色全部由主题色按 Material 3 规则自动生成。", fields: ["themeHue", "themeStyle", "themeSpec"] },
    { title: "明暗模式", fields: ["defaultMode", "allowModeSwitch"] },
    { title: "页面布局", fields: ["backgroundMode", "topAppBarAlign", "progressIndicatorStyle"] },
  ],
  banner: [
    { title: "横幅图片", fields: ["desktop", "mobile"] },
    { title: "显示", fields: ["position", "height", "waves"] },
  ],
  sidebar: [{ title: "布局", fields: ["enable", "arrangement", "side"] }],
  announcement: [{ title: "公告内容", fields: ["enable", "title", "content", "closable"] }],
  footer: [{ title: "页脚 HTML", fields: ["html"] }],
  seo: [
    { title: "标题与描述", fields: ["titleSeparator", "defaultDescription", "keywords"] },
    { title: "社交分享", fields: ["ogImage", "twitterHandle"] },
    { title: "爬虫", fields: ["extraRobots"] },
  ],
  article: [{ title: "列表", fields: ["pageSize", "seriesCardPosition"] }],
};

export interface FieldGroup {
  id: string;
  title: string;
  hint?: string;
  /** A nested object shown as one group, e.g. `texture`; its fields live one level down. */
  object?: string;
  /** The nested object has a boolean `enable`, shown as the group's switch. */
  toggle?: boolean;
  fields: string[];
}

const isRecord = (value: Value | undefined): value is Record<string, Value> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isNavigationItem = (path: string) => /^navigation(\.\d+\.children)*\.\d+$/.test(path);

/**
 * Splits an object's fields into titled groups. At a section's top level the configured
 * groups come first, then leftover plain fields as "基本设置", then every nested object and
 * list as a group of its own. Deeper objects keep plain fields together and turn nested
 * objects into sub-groups.
 */
export function groupFields(path: string, value: Record<string, Value>, hidden: string[] = []): FieldGroup[] {
  const names = Object.keys(value).filter(
    (name) => !hidden.includes(name) && !(name === "id" && isNavigationItem(path)),
  );
  const root = !path.includes(".");
  const used = new Set<string>();
  const groups: FieldGroup[] = [];
  if (root) {
    for (const [index, group] of (sectionGroups[path] ?? []).entries()) {
      const fields = group.fields.filter((name) => names.includes(name));
      fields.forEach((name) => used.add(name));
      if (fields.length) groups.push({ id: `group-${index}`, title: group.title, hint: group.hint, fields });
    }
  }
  const plain = names.filter(
    (name) => !used.has(name) && !isRecord(value[name]) && !(root && Array.isArray(value[name])),
  );
  if (plain.length) groups.push({ id: "basic", title: root ? "基本设置" : "", fields: plain });
  for (const name of names) {
    if (used.has(name) || plain.includes(name)) continue;
    const child = value[name];
    groups.push({
      id: name,
      title: labels[name] ?? name,
      hint: hints[normalizePath(`${path}.${name}`)],
      object: isRecord(child) ? name : undefined,
      toggle: isRecord(child) && typeof child.enable === "boolean",
      fields: [name],
    });
  }
  return groups;
}
