export type IconOption = { id: string; label: string; group: string };

const material = (items: [string, string][]): IconOption[] =>
  items.map(([name, label]) => ({ id: `material-symbols:${name}-rounded`, label, group: "常用" }));

export const iconOptions: IconOption[] = [
  ...material([
    ["home", "首页"], ["home-outline", "首页（线框）"], ["person", "用户"], ["person-outline", "用户（线框）"],
    ["campaign", "公告"], ["notifications", "通知"], ["category", "分类"], ["folder", "文件夹"],
    ["sell", "标签"], ["tag", "标签（线框）"], ["auto-stories", "系列/书籍"], ["menu-book", "文章"],
    ["article", "文章（线框）"], ["description", "文档"], ["edit", "编辑"], ["edit-note", "编辑笔记"],
    ["image", "图片"], ["photo-library", "图片库"], ["link", "链接"], ["language", "语言"],
    ["mail", "邮件"], ["alternate-email", "邮箱"], ["rss-feed", "RSS 订阅"], ["search", "搜索"],
    ["settings", "设置"], ["tune", "调整"], ["analytics", "统计"], ["bar-chart", "柱状图"],
    ["visibility", "浏览"], ["query-stats", "访问统计"], ["schedule", "时间"], ["calendar-month", "日历"],
    ["star", "收藏"], ["favorite", "喜欢"], ["bookmark", "书签"], ["share", "分享"],
    ["download", "下载"], ["upload", "上传"], ["cloud", "云"], ["code", "代码"],
    ["terminal", "终端"], ["public", "公开"], ["lock", "锁定"], ["shield", "安全"],
    ["info", "信息"], ["help", "帮助"], ["check-circle", "完成"], ["warning", "警告"],
    ["error", "错误"], ["more-horiz", "更多"], ["apps", "应用"], ["widgets", "组件"],
    ["dashboard", "仪表盘"], ["grid-view", "网格"], ["view-list", "列表"], ["push-pin", "置顶"],
    ["place", "位置"], ["map", "地图"], ["music-note", "音乐"], ["sports-esports", "游戏"],
    ["coffee", "咖啡"], ["favorite-border", "心形"], ["pets", "宠物"], ["eco", "自然"],
  ]),
  ...[
    ["fa6-brands:github", "GitHub", "社交与品牌"], ["fa6-brands:gitlab", "GitLab", "社交与品牌"],
    ["fa6-brands:x-twitter", "X / Twitter", "社交与品牌"], ["fa6-brands:twitter", "Twitter", "社交与品牌"],
    ["fa6-brands:facebook", "Facebook", "社交与品牌"], ["fa6-brands:instagram", "Instagram", "社交与品牌"],
    ["fa6-brands:youtube", "YouTube", "社交与品牌"], ["fa6-brands:bilibili", "哔哩哔哩", "社交与品牌"],
    ["fa6-brands:linkedin", "LinkedIn", "社交与品牌"], ["fa6-brands:discord", "Discord", "社交与品牌"],
    ["fa6-brands:telegram", "Telegram", "社交与品牌"], ["fa6-brands:reddit", "Reddit", "社交与品牌"],
    ["fa6-brands:steam", "Steam", "社交与品牌"], ["fa6-brands:spotify", "Spotify", "社交与品牌"],
    ["fa6-brands:weibo", "微博", "社交与品牌"], ["fa6-brands:weixin", "微信", "社交与品牌"],
    ["fa6-brands:qq", "QQ", "社交与品牌"], ["fa6-brands:zhihu", "知乎", "社交与品牌"],
    ["fa6-brands:google", "Google", "社交与品牌"], ["fa6-brands:apple", "Apple", "社交与品牌"],
  ].map(([id, label, group]) => ({ id, label, group })),
];
