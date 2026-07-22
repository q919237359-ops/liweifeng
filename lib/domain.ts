import type {
  FeedRecord,
  FeedSettings,
  IdMap,
  Pond,
  StockLog,
  StockTotal,
  Warehouse,
} from "@/types";

export const COMMON_FEEDS = ["生鱼料", "鳗鱼料", "加州鲈料"];
export const DEFAULT_FEED_GRADES = ["一号料", "二号料", "三号料"];
export const DEFAULT_PONDS: Pond[] = Array.from({ length: 11 }, (_, index) => ({
  id: `pond${index + 1}`,
  name: `${index + 1}号塘`,
  species: "空置",
  archived: false,
}));
export const DEFAULT_WAREHOUSES: Warehouse[] = Array.from({ length: 10 }, (_, index) => ({
  id: `wh${index + 1}`,
  name: `${index + 1}号仓库`,
  active: true,
}));

export function objectList<T extends object>(value: unknown): Array<T & { id: string }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      item && typeof item === "object" ? [{ id: String(index), ...(item as T) }] : [],
    );
  }
  if (typeof value !== "object") return [];
  return Object.entries(value).flatMap(([id, item]) =>
    item && typeof item === "object" ? [{ id, ...(item as T) }] : [],
  );
}

export function normalizeFeedSpec(value?: string) {
  const raw = String(value ?? "").trim();
  return !raw || raw === "默认规格" || raw === "未分规格" ? "" : raw;
}

export function feedSpecLabel(value?: string) {
  return normalizeFeedSpec(value) || "默认规格";
}

export function isEelFeed(feedName?: string) {
  return String(feedName ?? "").includes("鳗鱼");
}

export function bagJin(feedName: string, settings: FeedSettings) {
  return isEelFeed(feedName) ? Number(settings.eelBagJin || 40) : 40;
}

export function unitForFeed(feedName: string): "jin" | "bag" {
  return isEelFeed(feedName) ? "jin" : "bag";
}

export function stockKey(warehouseId: string, feedName: string, feedSpec = "") {
  const base = `${warehouseId}__${encodeURIComponent(feedName || "未命名饲料")}`;
  const spec = normalizeFeedSpec(feedSpec);
  return spec ? `${base}__${encodeURIComponent(spec)}` : base;
}

export function fmt(value: number, digits = 2) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)).toString() : "0";
}

export function beijingDate(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function beijingTime(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function headerDate(timestamp: number) {
  const date = new Date(timestamp);
  const monthDay = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace("/", ".");
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(date);
  return `${monthDay}${weekday}`;
}

export function activePonds(ponds: Pond[]) {
  return [...ponds]
    .filter((pond) => pond.archived !== true && pond.species && pond.species !== "空置")
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));
}

export function activeWarehouses(warehouses: Warehouse[]) {
  return warehouses.filter((warehouse) => warehouse.active !== false);
}

export function warehouseById(warehouses: Warehouse[], id: string) {
  return warehouses.find((warehouse) => warehouse.id === id) ?? warehouses[0] ?? DEFAULT_WAREHOUSES[0];
}

export function customFeedTypes(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value)
      : String(value ?? "").split(/[，,、\n\r\t]+/);
  return [...new Set(values.map((item) => String(item ?? "").trim()).filter(Boolean))].filter(
    (name) => !COMMON_FEEDS.includes(name),
  );
}

export function allFeedTypes(
  custom: string[],
  ponds: Pond[],
  records: FeedRecord[],
  logs: StockLog[],
  totals: IdMap<StockTotal>,
) {
  return [
    ...new Set([
      ...COMMON_FEEDS,
      ...custom,
      ...ponds.map((pond) => pond.defaultFeedName),
      ...records.map((record) => record.feedName),
      ...logs.map((log) => log.feedName),
      ...Object.values(totals).map((row) => row?.feedName),
    ].filter((value): value is string => Boolean(value))),
  ];
}

function decodePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function rowFromLegacyKey(key: string, value: unknown, settings: FeedSettings): StockTotal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<StockTotal> & { jin?: number; bags?: number };
  const parts = key.split("__").map(decodePart);
  const warehouseId = raw.warehouseId || parts[0] || "";
  const feedName = raw.feedName || parts[1] || "";
  const feedSpec = normalizeFeedSpec(raw.feedSpec || parts[2] || "");
  const stockJin = Number(raw.stockJin ?? raw.jin ?? Number(raw.bags || 0) * bagJin(feedName, settings));
  if (!warehouseId || !feedName || !Number.isFinite(stockJin)) return null;
  return { warehouseId, warehouseName: raw.warehouseName || warehouseId, feedName, feedSpec, stockJin };
}

export function stockRows(totals: IdMap<StockTotal>, settings: FeedSettings) {
  return Object.entries(totals).flatMap(([key, value]) => {
    const row = rowFromLegacyKey(key, value, settings);
    return row && row.stockJin > 0.001 ? [row] : [];
  });
}

export function stockFor(
  totals: IdMap<StockTotal>,
  settings: FeedSettings,
  warehouseId: string,
  feedName: string,
  feedSpec = "",
) {
  const spec = normalizeFeedSpec(feedSpec);
  return stockRows(totals, settings).find(
    (row) => row.warehouseId === warehouseId && row.feedName === feedName && normalizeFeedSpec(row.feedSpec) === spec,
  )?.stockJin ?? 0;
}

export function stockDisplay(feedName: string, stockJin: number, settings: FeedSettings) {
  if (isEelFeed(feedName)) return `${fmt(stockJin, 1)}斤 / 约${fmt(stockJin / bagJin(feedName, settings), 1)}包`;
  return `${fmt(stockJin / bagJin(feedName, settings), 1)}包`;
}

export function recordAmount(record: Pick<FeedRecord, "amount" | "unit" | "stockJin" | "feedName">, settings: FeedSettings) {
  if (Number(record.amount) > 0) return Number(record.amount);
  return record.unit === "jin" ? Number(record.stockJin || 0) : Number(record.stockJin || 0) / bagJin(record.feedName, settings);
}

export function amountLabel(feedName: string, amount: number, unit: "jin" | "bag") {
  return `${fmt(amount, 1)}${unit === "jin" ? "斤" : "包"}${feedName}`;
}
