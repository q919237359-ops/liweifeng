"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { firebaseDatabase } from "@/lib/firebase";
import {
  DEFAULT_FEED_GRADES,
  DEFAULT_PONDS,
  DEFAULT_WAREHOUSES,
  allFeedTypes,
  bagJin,
  beijingDate,
  customFeedTypes,
  normalizeFeedSpec,
  objectList,
  stockFor,
  stockKey,
  unitForFeed,
  warehouseById,
} from "@/lib/domain";
import { previewData } from "@/lib/preview";
import type {
  ExternalOutInput,
  FeedInput,
  FeedRecord,
  FishManagerData,
  IdMap,
  MemoInput,
  Pond,
  PondMemo,
  SettingsInput,
  StockInput,
  StockLog,
  StockTotal,
  Warehouse,
} from "@/types";

const EMPTY_DATA: FishManagerData = {
  ponds: DEFAULT_PONDS,
  warehouses: DEFAULT_WAREHOUSES,
  customFeedTypes: [],
  feedSettings: { eelBagJin: 40, feedGrades: DEFAULT_FEED_GRADES },
  feedRecords: [],
  stockLogs: [],
  stockTotals: {},
  pondMemos: [],
  serverTimeOffset: 0,
};

interface FishManagerContextValue extends FishManagerData {
  loading: boolean;
  preview: boolean;
  readOnly: boolean;
  status: string;
  message: string;
  now: number;
  feedTypes: string[];
  clearMessage(): void;
  recordFeed(input: FeedInput): Promise<void>;
  stockIn(input: StockInput): Promise<void>;
  externalOut(input: ExternalOutInput): Promise<void>;
  saveMemo(input: MemoInput): Promise<void>;
  saveSettings(input: SettingsInput): Promise<void>;
  undoStockLog(log: StockLog): Promise<void>;
}

const FishManagerContext = createContext<FishManagerContextValue | null>(null);
const CACHE_KEY = "fish_manager_next_cache_v1";

function withIds<T extends object>(value: unknown) {
  return objectList<T>(value);
}

export function FishManagerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FishManagerData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState("正在连接 Firebase");
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(Date.now());
  const mounted = useRef(true);

  const notify = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => mounted.current && setMessage(""), 2800);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPreview = params.has("preview");
    const isReadOnly = params.has("readonly");
    setPreview(isPreview);
    setReadOnly(isReadOnly);

    if (isPreview) {
      setData(previewData());
      setLoading(false);
      setStatus("安全预览，不写入 Firebase");
      return;
    }

    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) setData({ ...EMPTY_DATA, ...(JSON.parse(cached) as FishManagerData) });
    } catch {
      // Cache is optional; Firebase remains the source of truth.
    }

    const db = firebaseDatabase();
    const unsubscribers = [
      onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
        const offset = Number(snapshot.val());
        setData((current) => ({ ...current, serverTimeOffset: Number.isFinite(offset) ? offset : 0 }));
      }),
      onValue(ref(db, "settings/ponds"), (snapshot) => {
        const ponds = withIds<Pond>(snapshot.val());
        setData((current) => ({ ...current, ponds: ponds.length ? ponds : DEFAULT_PONDS }));
        setLoading(false);
        setStatus(isReadOnly ? "真实数据，只读模式" : "Firebase 数据同步正常");
      }),
      onValue(ref(db, "settings/warehouses"), (snapshot) => {
        const rows = withIds<Warehouse>(snapshot.val());
        const warehouses = DEFAULT_WAREHOUSES.map((fallback) => ({
          ...fallback,
          ...(rows.find((row) => row.id === fallback.id) ?? {}),
        }));
        setData((current) => ({ ...current, warehouses }));
      }),
      onValue(ref(db, "settings/feedTypes"), (snapshot) => {
        setData((current) => ({ ...current, customFeedTypes: customFeedTypes(snapshot.val()) }));
      }),
      onValue(ref(db, "settings/feedSpecs"), (snapshot) => {
        const value = snapshot.val() || {};
        setData((current) => ({
          ...current,
          feedSettings: {
            eelBagJin: Number(value.eelBagJin || 40),
            feedGrades: Array.isArray(value.feedGrades) && value.feedGrades.length ? value.feedGrades : DEFAULT_FEED_GRADES,
          },
        }));
      }),
      onValue(ref(db, "feedRecords"), (snapshot) => {
        const rows = withIds<FeedRecord>(snapshot.val()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        setData((current) => ({ ...current, feedRecords: rows }));
      }),
      onValue(ref(db, "stockLogs"), (snapshot) => {
        const rows = withIds<StockLog>(snapshot.val()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        setData((current) => ({ ...current, stockLogs: rows }));
      }),
      onValue(ref(db, "stockTotals"), (snapshot) => {
        setData((current) => ({ ...current, stockTotals: (snapshot.val() || {}) as IdMap<StockTotal> }));
      }),
      onValue(ref(db, "pondMemos"), (snapshot) => {
        setData((current) => ({ ...current, pondMemos: withIds<PondMemo>(snapshot.val()) }));
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (loading || preview) return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // The application still works if storage is unavailable.
    }
  }, [data, loading, preview]);

  const assertWritable = useCallback(() => {
    if (readOnly) throw new Error("当前为只读模式，不能保存");
  }, [readOnly]);

  const adjustStock = useCallback(
    async (warehouseId: string, feedName: string, feedSpec: string, deltaJin: number) => {
      if (preview) {
        const key = stockKey(warehouseId, feedName, feedSpec);
        const old = data.stockTotals[key] || {
          warehouseId,
          warehouseName: warehouseById(data.warehouses, warehouseId).name,
          feedName,
          feedSpec,
          stockJin: 0,
        };
        const next = Number(old.stockJin || 0) + deltaJin;
        if (next < -0.001) return false;
        setData((current) => {
          return {
            ...current,
            stockTotals: {
              ...current.stockTotals,
              [key]: { ...old, stockJin: next, updatedAt: Date.now() },
            },
          };
        });
        return true;
      }
      assertWritable();
      const db = firebaseDatabase();
      const key = stockKey(warehouseId, feedName, feedSpec);
      const result = await runTransaction(ref(db, `stockTotals/${key}`), (current) => {
        const old = current || {
          warehouseId,
          warehouseName: warehouseById(data.warehouses, warehouseId).name,
          feedName,
          feedSpec,
          stockJin: 0,
        };
        const next = Number(old.stockJin || old.jin || 0) + deltaJin;
        if (next < -0.001) return;
        return {
          ...old,
          warehouseId,
          warehouseName: warehouseById(data.warehouses, warehouseId).name,
          feedName,
          feedSpec: normalizeFeedSpec(feedSpec),
          stockJin: next,
          updatedAt: Date.now() + data.serverTimeOffset,
        };
      });
      return result.committed;
    },
    [assertWritable, data.serverTimeOffset, data.stockTotals, data.warehouses, preview],
  );

  const recordFeed = useCallback(
    async (input: FeedInput) => {
      assertWritable();
      const amount = Number(input.amount);
      if (!input.pond.id || !input.warehouseId || !input.feedName || amount <= 0) throw new Error("请完整填写喂料信息");
      const unit = unitForFeed(input.feedName);
      const stockJin = unit === "jin" ? amount : amount * bagJin(input.feedName, data.feedSettings);
      const available = stockFor(data.stockTotals, data.feedSettings, input.warehouseId, input.feedName, input.feedSpec);
      if (stockJin > available + 0.001) throw new Error("当前仓库库存不足");
      const committed = await adjustStock(input.warehouseId, input.feedName, input.feedSpec, -stockJin);
      if (!committed) throw new Error("当前仓库库存不足");
      const now = Date.now() + data.serverTimeOffset;
      const warehouse = warehouseById(data.warehouses, input.warehouseId);
      const record = {
        date: beijingDate(now),
        pondId: input.pond.id,
        pondName: input.pond.name,
        species: input.pond.species || "",
        warehouseId: input.warehouseId,
        warehouseName: warehouse.name,
        feedName: input.feedName,
        feedSpec: normalizeFeedSpec(input.feedSpec),
        amount,
        unit,
        stockJin,
        person: "",
        note: input.note || "",
        createdAt: now,
      };
      if (preview) {
        setData((current) => ({
          ...current,
          feedRecords: [{ id: `preview_feed_${now}`, ...record }, ...current.feedRecords],
          stockLogs: [
            { id: `preview_log_${now}`, type: "out", sourceType: "feed", ...record },
            ...current.stockLogs,
          ],
        }));
      } else {
        const db = firebaseDatabase();
        const recordRef = await push(ref(db, "feedRecords"), record);
        await push(ref(db, "stockLogs"), { type: "out", sourceType: "feed", feedRecordId: recordRef.key, ...record });
      }
      notify(`${input.pond.name}已记录 ${amount}${unit === "jin" ? "斤" : "包"}`);
    },
    [adjustStock, assertWritable, data, notify, preview],
  );

  const stockIn = useCallback(
    async (input: StockInput) => {
      assertWritable();
      if (!input.warehouseId || !input.feedName || Number(input.amount) <= 0) throw new Error("请完整填写入库信息");
      const stockJin = Number(input.amount) * bagJin(input.feedName, data.feedSettings);
      const committed = await adjustStock(input.warehouseId, input.feedName, input.feedSpec, stockJin);
      if (!committed) throw new Error("入库失败，请稍后再试");
      const now = Date.now() + data.serverTimeOffset;
      const log = {
        type: "in" as const,
        sourceType: "stockIn",
        date: input.date || beijingDate(now),
        warehouseId: input.warehouseId,
        warehouseName: warehouseById(data.warehouses, input.warehouseId).name,
        feedName: input.feedName,
        feedSpec: normalizeFeedSpec(input.feedSpec),
        amount: Number(input.amount),
        unit: "bag" as const,
        stockJin,
        person: "",
        note: input.note || "",
        createdAt: now,
      };
      if (preview) setData((current) => ({ ...current, stockLogs: [{ id: `preview_in_${now}`, ...log }, ...current.stockLogs] }));
      else await push(ref(firebaseDatabase(), "stockLogs"), log);
      notify("入库已保存");
    },
    [adjustStock, assertWritable, data, notify, preview],
  );

  const externalOut = useCallback(
    async (input: ExternalOutInput) => {
      assertWritable();
      if (!input.warehouseId || !input.feedName || Number(input.amount) <= 0 || !input.person.trim()) {
        throw new Error("请完整填写领料信息");
      }
      const stockJin = Number(input.amount) * bagJin(input.feedName, data.feedSettings);
      const available = stockFor(data.stockTotals, data.feedSettings, input.warehouseId, input.feedName, input.feedSpec);
      if (stockJin > available + 0.001) throw new Error("当前仓库库存不足");
      const committed = await adjustStock(input.warehouseId, input.feedName, input.feedSpec, -stockJin);
      if (!committed) throw new Error("当前仓库库存不足");
      const now = Date.now() + data.serverTimeOffset;
      const log = {
        type: "externalOut" as const,
        sourceType: "externalOut",
        date: input.date || beijingDate(input.takenAt),
        takenAt: input.takenAt,
        warehouseId: input.warehouseId,
        warehouseName: warehouseById(data.warehouses, input.warehouseId).name,
        feedName: input.feedName,
        feedSpec: normalizeFeedSpec(input.feedSpec),
        amount: Number(input.amount),
        unit: "bag" as const,
        stockJin,
        externalPerson: input.person.trim(),
        person: input.person.trim(),
        note: input.note || "",
        createdAt: now,
      };
      if (preview) setData((current) => ({ ...current, stockLogs: [{ id: `preview_out_${now}`, ...log }, ...current.stockLogs] }));
      else await push(ref(firebaseDatabase(), "stockLogs"), log);
      notify("领料出库已保存");
    },
    [adjustStock, assertWritable, data, notify, preview],
  );

  const saveMemo = useCallback(
    async (input: MemoInput) => {
      assertWritable();
      if (!input.pond.id || !input.action) throw new Error("请选择鱼塘和动作");
      const now = Date.now() + data.serverTimeOffset;
      const memo = {
        date: input.date || beijingDate(now),
        pondId: input.pond.id,
        pondName: input.pond.name,
        species: input.pond.species || "",
        action: input.action,
        text: input.text.trim(),
        person: "",
        createdAt: now,
      };
      if (preview) setData((current) => ({ ...current, pondMemos: [{ id: `preview_memo_${now}`, ...memo }, ...current.pondMemos] }));
      else await push(ref(firebaseDatabase(), "pondMemos"), memo);
      notify("备忘录已保存");
    },
    [assertWritable, data.serverTimeOffset, notify, preview],
  );

  const saveSettings = useCallback(
    async (input: SettingsInput) => {
      assertWritable();
      const normalized = {
        ponds: input.ponds,
        warehouses: input.warehouses,
        customFeedTypes: customFeedTypes(input.customFeedTypes),
        feedSettings: {
          eelBagJin: Number(input.feedSettings.eelBagJin || 40),
          feedGrades: input.feedSettings.feedGrades.length ? input.feedSettings.feedGrades : DEFAULT_FEED_GRADES,
        },
      };
      if (preview) {
        setData((current) => ({ ...current, ...normalized }));
      } else {
        const db = firebaseDatabase();
        await Promise.all([
          set(ref(db, "settings/ponds"), Object.fromEntries(normalized.ponds.map((pond) => [pond.id, pond]))),
          set(ref(db, "settings/warehouses"), Object.fromEntries(normalized.warehouses.map((warehouse) => [warehouse.id, warehouse]))),
          set(ref(db, "settings/feedTypes"), normalized.customFeedTypes),
          set(ref(db, "settings/feedSpecs"), normalized.feedSettings),
        ]);
      }
      notify("设置已保存");
    },
    [assertWritable, notify, preview],
  );

  const undoStockLog = useCallback(
    async (log: StockLog) => {
      assertWritable();
      if (log.cancelled) return;
      const delta = log.type === "in" || log.type === "stockIn" ? -Number(log.stockJin || 0) : Number(log.stockJin || 0);
      const committed = await adjustStock(log.warehouseId, log.feedName, log.feedSpec || "", delta);
      if (!committed) throw new Error("撤销失败，当前库存不足");
      const cancelledAt = Date.now() + data.serverTimeOffset;
      if (preview) {
        setData((current) => ({
          ...current,
          stockLogs: current.stockLogs.map((item) => item.id === log.id ? { ...item, cancelled: true, cancelledAt } : item),
          feedRecords: current.feedRecords.map((item) => item.id === log.feedRecordId ? { ...item, cancelled: true, cancelledAt } : item),
        }));
      } else {
        const db = firebaseDatabase();
        await update(ref(db, `stockLogs/${log.id}`), { cancelled: true, cancelledAt });
        if (log.feedRecordId) await update(ref(db, `feedRecords/${log.feedRecordId}`), { cancelled: true, cancelledAt });
      }
      notify("流水已撤销");
    },
    [adjustStock, assertWritable, data.serverTimeOffset, notify, preview],
  );

  const now = clock + data.serverTimeOffset;
  const feedTypes = useMemo(
    () => allFeedTypes(data.customFeedTypes, data.ponds, data.feedRecords, data.stockLogs, data.stockTotals),
    [data],
  );
  const value = useMemo<FishManagerContextValue>(
    () => ({
      ...data,
      loading,
      preview,
      readOnly,
      status,
      message,
      now,
      feedTypes,
      clearMessage: () => setMessage(""),
      recordFeed,
      stockIn,
      externalOut,
      saveMemo,
      saveSettings,
      undoStockLog,
    }),
    [data, externalOut, feedTypes, loading, message, now, preview, readOnly, recordFeed, saveMemo, saveSettings, status, stockIn, undoStockLog],
  );

  return <FishManagerContext.Provider value={value}>{children}</FishManagerContext.Provider>;
}

export function useFishManager() {
  const value = useContext(FishManagerContext);
  if (!value) throw new Error("useFishManager must be used inside FishManagerProvider");
  return value;
}
