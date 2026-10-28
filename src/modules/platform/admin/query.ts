export type AdminSearchParams = Record<string, string | string[] | undefined>;
export function queryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
export function pageLink(
  base: string,
  filters: Record<string, string>,
  cursor?: string | null,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  if (cursor) query.set("cursor", cursor);
  return `${base}${query.size ? `?${query}` : ""}`;
}
export function displayDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
