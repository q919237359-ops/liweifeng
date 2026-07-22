"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X, Package } from "@phosphor-icons/react";
import { useFishManager } from "@/lib/data-context";
import {
  activeWarehouses,
  bagJin,
  feedSpecLabel,
  fmt,
  isEelFeed,
  normalizeFeedSpec,
  stockFor,
  stockRows,
  unitForFeed,
} from "@/lib/domain";
import type { Pond } from "@/types";

export function FeedDialog({ pond, onClose }: { pond: Pond; onClose(): void }) {
  const manager = useFishManager();
  const rows = useMemo(() => stockRows(manager.stockTotals, manager.feedSettings), [manager.stockTotals, manager.feedSettings]);
  const initialWarehouse = pond.defaultWarehouseId || activeWarehouses(manager.warehouses)[0]?.id || "";
  const [warehouseId, setWarehouseId] = useState(initialWarehouse);
  const [feedName, setFeedName] = useState(pond.defaultFeedName || "");
  const [feedSpec, setFeedSpec] = useState(normalizeFeedSpec(pond.defaultFeedSpec));
  const [amount, setAmount] = useState("1");
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const warehouseRows = useMemo(
    () => rows.filter((row) => row.warehouseId === warehouseId && row.stockJin > 0.001),
    [rows, warehouseId],
  );
  const feeds = useMemo(() => [...new Set(warehouseRows.map((row) => row.feedName))], [warehouseRows]);
  const specs = useMemo(
    () => [...new Set(warehouseRows.filter((row) => row.feedName === feedName).map((row) => normalizeFeedSpec(row.feedSpec)))],
    [feedName, warehouseRows],
  );

  useEffect(() => {
    if (feedName && feeds.includes(feedName)) return;
    const preferred = pond.defaultFeedName && feeds.includes(pond.defaultFeedName) ? pond.defaultFeedName : feeds[0] || "";
    setFeedName(preferred);
  }, [feedName, feeds, pond.defaultFeedName]);

  useEffect(() => {
    if (specs.includes(feedSpec)) return;
    const preferred = normalizeFeedSpec(pond.defaultFeedSpec);
    setFeedSpec(specs.includes(preferred) ? preferred : specs[0] || "");
  }, [feedSpec, pond.defaultFeedSpec, specs]);

  const unit = unitForFeed(feedName);
  const numericAmount = Number(amount || 0);
  const availableJin = stockFor(manager.stockTotals, manager.feedSettings, warehouseId, feedName, feedSpec);
  const neededJin = unit === "jin" ? numericAmount : numericAmount * bagJin(feedName, manager.feedSettings);
  const canSave = Boolean(feedName && numericAmount > 0 && neededJin <= availableJin + 0.001 && !saving && !manager.readOnly);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await manager.recordFeed({ pond, warehouseId, feedName, feedSpec, amount: numericAmount });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  function step(delta: number) {
    setAmount(fmt(Math.max(0.5, numericAmount + delta), 1));
    setError("");
  }

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" aria-label="关闭喂料弹窗" onClick={onClose} />
      <section className="feed-dialog" role="dialog" aria-modal="true" aria-labelledby="feed-dialog-title">
        <div className="dialog-handle" />
        <div className="dialog-head">
          <div>
            <h2 id="feed-dialog-title">{pond.name} · {pond.species}</h2>
            <p>记录今天的喂料数量</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={21} /></button>
        </div>

        <div className="feed-context">
          <Package size={23} />
          <div><span>本次用料</span><strong>{manager.warehouses.find((item) => item.id === warehouseId)?.name} · {feedName || "暂无库存"} · {feedSpecLabel(feedSpec)}</strong></div>
        </div>

        <div className="amount-stepper">
          <button type="button" onClick={() => step(-0.5)} aria-label={`减少0.5${unit === "jin" ? "斤" : "包"}`}><Minus size={25} /></button>
          <label className="amount-input">
            <span className="sr-only">喂料数量</span>
            <input type="number" min="0.5" step="0.5" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <b>{unit === "jin" ? "斤" : "包"}</b>
          </label>
          <button type="button" onClick={() => step(0.5)} aria-label={`增加0.5${unit === "jin" ? "斤" : "包"}`}><Plus size={25} /></button>
        </div>

        <div className="stock-readout">
          <span>可用库存</span>
          <strong>{isEelFeed(feedName) ? `${fmt(availableJin, 1)}斤` : `${fmt(availableJin / bagJin(feedName, manager.feedSettings), 1)}包`}</strong>
        </div>

        <button className="disclosure-button" type="button" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>
          更换本次用料 <span>{advanced ? "收起" : "展开"}</span>
        </button>
        {advanced && (
          <div className="form-grid compact">
            <label><span>仓库</span><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>{activeWarehouses(manager.warehouses).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
            <label><span>饲料</span><select value={feedName} onChange={(event) => setFeedName(event.target.value)}>{feeds.map((feed) => <option key={feed} value={feed}>{feed}</option>)}</select></label>
            <label><span>规格</span><select value={feedSpec} onChange={(event) => setFeedSpec(event.target.value)}>{specs.map((spec) => <option key={spec || "default"} value={spec}>{feedSpecLabel(spec)}</option>)}</select></label>
          </div>
        )}

        {!feedName && <div className="inline-error">当前仓库没有可用饲料，请先到库存页面入库。</div>}
        {numericAmount > 0 && neededJin > availableJin + 0.001 && <div className="inline-error">当前库存不足，不能保存。</div>}
        {manager.readOnly && <div className="inline-error">当前为只读模式，不能保存。</div>}
        {error && <div className="inline-error">{error}</div>}
        <button className="primary-button orange" type="button" disabled={!canSave} onClick={submit}>{saving ? "正在保存" : "确认记录"}</button>
      </section>
    </div>
  );
}
