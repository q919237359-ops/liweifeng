import type { FishManagerData, Pond, StockTotal } from "@/types";
import { DEFAULT_WAREHOUSES, beijingDate, stockKey } from "@/lib/domain";

export function previewData(): FishManagerData {
  const today = beijingDate();
  const ponds: Pond[] = [
    ["pond1", "1号塘", "鳗鱼", "wh1", "鳗鱼料", ""],
    ["pond2", "2号塘", "鳗鱼", "wh1", "鳗鱼料", ""],
    ["pond3", "3号塘", "生鱼", "wh1", "生鱼料", "三号料"],
    ["pond4", "4号塘", "鳗鱼", "wh2", "鳗鱼料", ""],
    ["pond5", "5号塘", "生鱼", "wh1", "生鱼料", "三号料"],
    ["pond8", "8号塘", "生鱼", "wh2", "生鱼料", "三号料"],
    ["pond9", "9号塘", "生鱼", "wh2", "生鱼料", "三号料"],
    ["pond10", "10号塘", "鳗鱼", "wh2", "鳗鱼料", ""],
  ].map(([id, name, species, defaultWarehouseId, defaultFeedName, defaultFeedSpec], index) => ({
    id,
    name,
    species,
    defaultWarehouseId,
    defaultFeedName,
    defaultFeedSpec,
    seedDate: `2026-06-${String(10 + index).padStart(2, "0")}`,
    seedQty: `${3 + index}.2万尾`,
    archived: false,
  }));
  const base = new Date(`${today}T07:00:00+08:00`).getTime();
  const feedRecords = ponds.map((pond, index) => {
    const eel = pond.defaultFeedName === "鳗鱼料";
    const amount = eel ? [80, 40, 0, 80, 0, 0, 0, 40][index] : [0, 0, 3, 0, 2.5, 5, 7, 0][index];
    return {
      id: `preview_${pond.id}`,
      date: today,
      pondId: pond.id,
      pondName: pond.name,
      species: pond.species,
      warehouseId: pond.defaultWarehouseId || "wh1",
      warehouseName: `${(pond.defaultWarehouseId || "wh1").replace("wh", "")}号仓库`,
      feedName: pond.defaultFeedName || "生鱼料",
      feedSpec: pond.defaultFeedSpec || "",
      amount,
      unit: eel ? ("jin" as const) : ("bag" as const),
      stockJin: eel ? amount : amount * 40,
      createdAt: base + index * 180000,
    };
  }).filter((record) => record.amount > 0);
  const totals: StockTotal[] = [
    { warehouseId: "wh1", warehouseName: "1号仓库", feedName: "鳗鱼料", feedSpec: "", stockJin: 520 },
    { warehouseId: "wh2", warehouseName: "2号仓库", feedName: "鳗鱼料", feedSpec: "", stockJin: 360 },
    { warehouseId: "wh1", warehouseName: "1号仓库", feedName: "生鱼料", feedSpec: "三号料", stockJin: 1480 },
    { warehouseId: "wh2", warehouseName: "2号仓库", feedName: "生鱼料", feedSpec: "三号料", stockJin: 1240 },
    { warehouseId: "wh1", warehouseName: "1号仓库", feedName: "加州鲈料", feedSpec: "二号料", stockJin: 680 },
  ];
  return {
    ponds,
    warehouses: DEFAULT_WAREHOUSES,
    customFeedTypes: [],
    feedSettings: { eelBagJin: 40, feedGrades: ["一号料", "二号料", "三号料", "四号料", "五号料"] },
    feedRecords,
    stockLogs: [],
    stockTotals: Object.fromEntries(totals.map((row) => [stockKey(row.warehouseId, row.feedName, row.feedSpec), row])),
    pondMemos: [],
    serverTimeOffset: 0,
  };
}
