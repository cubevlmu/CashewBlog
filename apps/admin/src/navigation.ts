export const groups = [
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
      {
        label: "回收站",
        path: "/admin/trash",
        icon: "pi pi-trash",
        description: "已删除的文章保留 30 天，可在这里恢复。",
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
      },
    ],
  },
];
export function currentNavigation(path: string) {
  return (
    groups
      .flatMap((group) => group.items)
      .filter(
        (item) =>
          path === item.path ||
          (item.path !== "/admin" && path.startsWith(`${item.path}/`)),
      )
      .at(-1) ?? groups[0].items[0]
  );
}
