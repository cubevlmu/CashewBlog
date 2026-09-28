import { ref } from "vue";
import { ApiError, http } from "./api/http";
import type { SessionDto, SetupStatusDto, MediaAssetDto } from "./api/types";

export const session = ref<SessionDto | null>(null);
export const setup = ref<SetupStatusDto | null>(null);
export const failure = ref("");
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const fields = Object.entries(error.fieldErrors).map(([key, messages]) => {
      const field = key === "title" ? "标题" : key;
      const localized = messages.map((message) =>
        key === "title" && message.startsWith("Title is required")
          ? "请输入文章标题（最多 200 个字符）"
          : message,
      );
      return `${field}: ${localized.join("；")}`;
    });
    const heading =
      error.code === "validation_failed"
        ? "提交内容未通过验证"
        : error.detail ?? error.title;
    return [heading, ...fields].filter(Boolean).join("\n");
  }
  return error instanceof Error ? error.message : "操作失败，请重试";
}
export async function attempt<T>(
  action: () => Promise<T>,
): Promise<T | undefined> {
  failure.value = "";
  try {
    return await action();
  } catch (error) {
    failure.value = errorMessage(error);
  }
}
export async function upload(file: File): Promise<MediaAssetDto> {
  const data = new FormData();
  data.append("file", file);
  return http.post<MediaAssetDto>("/api/admin/media", data);
}
export const statuses = [
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "私密", value: "private" },
];
export const statusLabel = (status: string) =>
  statuses.find((item) => item.value === status)?.label ?? status;
export const statusSeverity = (status: string) =>
  status === "published"
    ? "success"
    : status === "draft"
      ? "warn"
      : "secondary";
export const dateLabel = (date: string | null) =>
  date ? new Date(date).toLocaleString("zh-CN") : "—";
export const bytesLabel = (bytes: number | null) =>
  bytes === null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
