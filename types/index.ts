export type IdMap<T> = Record<string, T>;

export interface Pond {
  id: string;
  name: string;
  species: string;
  defaultWarehouseId?: string;
  defaultFeedName?: string;
  defaultFeedSpec?: string;
  seedDate?: string;
  seedQty?: string;
  archived?: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  active?: boolean;
}

export interface FeedSettings {
  eelBagJin: number;
  feedGrades: string[];
}

export interface FeedRecord {
  id: string;
  date: string;
  pondId: string;
  pondName: string;
  species?: string;
  warehouseId: string;
  warehouseName: string;
  feedName: string;
  feedSpec?: string;
  amount: number;
  unit: "jin" | "bag";
  stockJin: number;
  person?: string;
  note?: string;
  createdAt: number;
  cancelled?: boolean;
  cancelledAt?: number;
}

export interface StockLog {
  id: string;
  type: "in" | "out" | "externalOut" | "stockIn";
  sourceType?: "feed" | "stockIn" | "externalOut" | string;
  feedRecordId?: string;
  date: string;
  takenAt?: number;
  warehouseId: string;
  warehouseName: string;
  pondId?: string;
  pondName?: string;
  feedName: string;
  feedSpec?: string;
  amount: number;
  unit: "jin" | "bag";
  stockJin: number;
  externalPerson?: string;
  person?: string;
  note?: string;
  createdAt: number;
  cancelled?: boolean;
  cancelledAt?: number;
}

export interface StockTotal {
  warehouseId: string;
  warehouseName: string;
  feedName: string;
  feedSpec?: string;
  stockJin: number;
  updatedAt?: number;
}

export interface PondMemo {
  id: string;
  date: string;
  pondId: string;
  pondName: string;
  species?: string;
  action: string;
  text?: string;
  person?: string;
  createdAt: number;
}

export interface FishManagerData {
  ponds: Pond[];
  warehouses: Warehouse[];
  customFeedTypes: string[];
  feedSettings: FeedSettings;
  feedRecords: FeedRecord[];
  stockLogs: StockLog[];
  stockTotals: IdMap<StockTotal>;
  pondMemos: PondMemo[];
  serverTimeOffset: number;
}

export interface FeedInput {
  pond: Pond;
  warehouseId: string;
  feedName: string;
  feedSpec: string;
  amount: number;
  note?: string;
}

export interface StockInput {
  date: string;
  warehouseId: string;
  feedName: string;
  feedSpec: string;
  amount: number;
  note?: string;
}

export interface ExternalOutInput extends StockInput {
  person: string;
  takenAt: number;
}

export interface MemoInput {
  pond: Pond;
  date: string;
  action: string;
  text: string;
}

export interface SettingsInput {
  ponds: Pond[];
  warehouses: Warehouse[];
  customFeedTypes: string[];
  feedSettings: FeedSettings;
}
