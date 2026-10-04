import { describe, expect, it } from "vitest";
import {
  currentNavigation,
  navigationTrail,
  pageDescription,
  pageIcon,
  pageTitle,
} from "../src/navigation";

describe("admin navigation trails", () => {
  it("resolves detail routes to their list page", () => {
    expect(currentNavigation("/admin/posts/new").path).toBe("/admin/posts");
    expect(currentNavigation("/admin/pages/7").path).toBe("/admin/pages");
    expect(currentNavigation("/admin/analytics").path).toBe("/admin/analytics");
  });

  it("links every ancestor that has a page of its own", () => {
    expect(navigationTrail("/admin/analytics")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "站点管理" },
      { label: "访问统计" },
    ]);
    expect(navigationTrail("/admin/posts/new")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "内容管理" },
      { label: "文章", to: "/admin/posts" },
      { label: "新建文章" },
    ]);
  });

  it("renders the dashboard and detail pages without dead links", () => {
    expect(navigationTrail("/admin")).toEqual([{ label: "工作台" }]);
    expect(navigationTrail("/admin/pages/7").at(-1)).toEqual({
      label: "编辑页面",
    });
    expect(navigationTrail("/admin/settings").at(-1)).toEqual({
      label: "站点设置",
    });
  });

  it("names detail pages after the breadcrumb leaf", () => {
    expect(pageTitle("/admin/posts/new")).toBe("新建文章");
    expect(pageTitle("/admin/posts/7")).toBe("编辑文章");
    expect(pageTitle("/admin/pages/new")).toBe("新建页面");
    expect(pageTitle("/admin/analytics")).toBe("访问统计");
    expect(pageTitle("/admin")).toBe("仪表盘");
  });

  it("exposes settings sections as sub-pages of 站点设置", () => {
    expect(navigationTrail("/admin/settings")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "站点管理" },
      { label: "站点设置" },
    ]);
    expect(navigationTrail("/admin/settings/appearance")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "站点管理" },
      { label: "站点设置", to: "/admin/settings/general" },
      { label: "外观" },
    ]);
    expect(pageTitle("/admin/settings/appearance")).toBe("外观");
  });

  it("gives every page a menu icon, including the standalone security page", () => {
    expect(pageIcon("/admin/analytics")).toBe("pi pi-chart-line");
    expect(pageIcon("/admin/posts/7")).toBe("pi pi-file-edit");
    expect(pageIcon("/admin/settings/appearance")).toBe("pi pi-palette");
    expect(pageIcon("/admin/settings/security")).toBe("pi pi-shield");
    expect(pageTitle("/admin/settings/security")).toBe("安全与导出");
    expect(navigationTrail("/admin/settings/security")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "站点管理" },
      { label: "站点设置", to: "/admin/settings/general" },
      { label: "安全与导出" },
    ]);
  });

  it("describes each settings section on its own page", () => {
    expect(pageDescription("/admin/settings/appearance")).toBe("主题色、明暗模式、背景纹理与文章列表样式。");
    expect(pageDescription("/admin/settings/security")).toBe("修改管理员密码，导出设置与文章。");
    expect(pageDescription("/admin/posts")).toBe("记录想法，管理草稿与已发布的文章。");
  });

  it("lists 全部文章 and 回收站 as sibling pages under 文章", () => {
    expect(navigationTrail("/admin/trash")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "内容管理" },
      { label: "文章", to: "/admin/posts" },
      { label: "回收站" },
    ]);
    expect(pageTitle("/admin/trash")).toBe("回收站");
    expect(pageIcon("/admin/trash")).toBe("pi pi-trash");
    expect(pageTitle("/admin/posts")).toBe("全部文章");
    expect(navigationTrail("/admin/posts")).toEqual([
      { label: "工作台", to: "/admin" },
      { label: "内容管理" },
      { label: "文章" },
      { label: "全部文章" },
    ]);
  });
});
