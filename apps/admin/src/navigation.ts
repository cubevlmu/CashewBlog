import { settingsPages } from "./settings-sections";

/** Menu leaf without further children of its own (settings sections). */
export type NavigationLeaf = { label: string; path: string; icon?: string };

export type NavigationItem = NavigationLeaf & {
  icon: string;
  description: string;
  /** Sub-pages shown under the item in the sidebar. */
  children?: NavigationLeaf[];
};

export const groups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "工作台",
    items: [
      {
        label: "仪表盘",
        path: "/admin",
        icon: "pi pi-home",
        description: "内容、访问趋势与运行状态，一览无余。",
      },
    ],
  },
  {
    label: "内容管理",
    items: [
      {
        label: "文章",
        path: "/admin/posts",
        icon: "pi pi-file-edit",
        description: "记录想法，管理草稿与已发布的文章。",
        children: [
          { label: "回收站", path: "/admin/trash", icon: "pi pi-trash" },
        ],
      },
      {
        label: "分类",
        path: "/admin/categories",
        icon: "pi pi-folder",
        description: "为内容建立清晰的分类。",
      },
      {
        label: "标签",
        path: "/admin/tags",
        icon: "pi pi-tags",
        description: "用标签串联相关内容。",
      },
      {
        label: "系列",
        path: "/admin/series",
        icon: "pi pi-book",
        description: "将文章组织成有序的系列。",
      },
      {
        label: "自定义页面",
        path: "/admin/pages",
        icon: "pi pi-code",
        description: "编辑独立页面及其 HTML 和 CSS。",
      },
      {
        label: "媒体库",
        path: "/admin/media",
        icon: "pi pi-images",
        description: "统一管理图片、附件及其引用。",
      },
    ],
  },
  {
    label: "站点管理",
    items: [
      {
        label: "访问统计",
        path: "/admin/analytics",
        icon: "pi pi-chart-line",
        description: "了解文章阅读量与近期访问趋势。",
      },
      {
        label: "站点设置",
        path: "/admin/settings",
        icon: "pi pi-cog",
        description: "设置站点资料、外观、导航与侧栏。",
        children: settingsPages.map((page) => ({
          label: page.label,
          path: `/admin/settings/${page.value}`,
          icon: page.icon,
        })),
      },
    ],
  },
];

/** Chinese labels for PrimeVue's built-in sidebar actions and announcements. */
export const sidebarLocale = {
  toggleNavigation: "展开或收起侧边栏",
  collapseNavigation: "收起侧边栏",
  expandNavigation: "展开侧边栏",
  group: "导航分组",
  menu: "导航菜单",
  submenu: "子菜单",
};
export function currentNavigation(path: string) {
  return (
    groups
      .flatMap((group) => group.items)
      .filter(
        (item) =>
          path === item.path ||
          (item.path !== "/admin" && path.startsWith(`${item.path}/`)) ||
          item.children?.some((child) => child.path === path),
      )
      .at(-1) ?? groups[0].items[0]
  );
}

/** Header breadcrumb entry; items without `to` render as plain text. */
export type NavigationCrumb = { label: string; to?: string };

function detailTitle(path: string) {
  const match = /^\/admin\/(posts|pages)\/([^/]+)$/.exec(path);
  if (!match) return undefined;
  const action = match[2] === "new" ? "新建" : "编辑";
  return `${action}${match[1] === "posts" ? "文章" : "页面"}`;
}

/**
 * Breadcrumb trail for a route, e.g. `工作台 › 内容管理 › 文章 › 新建文章`.
 * Group labels have no page of their own, so only page items are navigable.
 */
export function navigationTrail(path: string): NavigationCrumb[] {
  const active = currentNavigation(path);
  if (active.path === "/admin") return [{ label: "工作台" }];
  const group = groups.find((entry) => entry.items.includes(active));
  const detail = detailTitle(path);
  const child = active.children?.find((item) => item.path === path);
  return [
    { label: "工作台", to: "/admin" },
    { label: group?.label ?? active.label },
    ...(detail || child ? [{ label: active.label, to: active.path }] : []),
    { label: detail ?? child?.label ?? active.label },
  ];
}

/** Heading for the current page: detail routes name themselves, lists use the menu label. */
export function pageTitle(path: string) {
  const active = currentNavigation(path);
  return (
    detailTitle(path) ??
    active.children?.find((item) => item.path === path)?.label ??
    active.label
  );
}

/** Icon shown next to the page heading; sub-pages inherit their menu entry's icon. */
export function pageIcon(path: string) {
  const active = currentNavigation(path);
  return active.children?.find((item) => item.path === path)?.icon ?? active.icon;
}
