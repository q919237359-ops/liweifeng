"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, BoxArrowDown, Package, UserCircle } from "@phosphor-icons/react";
import { useFishManager } from "@/lib/data-context";
import {
  activeWarehouses,
  bagJin,
  beijingDate,
  feedSpecLabel,
  fmt,
  normalizeFeedSpec,
  stockDisplay,
  stockRows,
} from "@/lib/domain";

function localDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function InventoryPage() {
  const manager = useFishManager();
  const warehouses = activeWarehouses(manager.warehouses);
  const rows = useMemo(() => stockRows(manager.stockTotals, manager.feedSettings), [manager.stockTotals, manager.feedSettings]);
  const groups = useMemo(() => {
    const map = new Map<string, { feedName: string; feedSpec: string; stockJin: number; rows: typeof rows }>();
    rows.forEach((row) => {
      const spec = normalizeFeedSpec(row.feedSpec);
      const key = `${row.feedName}__${spec}`;
      const group = map.get(key) || { feedName: row.feedName, feedSpec: spec, stockJin: 0, rows: [] };
      group.stockJin += Number(row.stockJin || 0);
      group.rows.push(row);
      map.set(key, group);
    });
    return [...map.values()].sort((left, right) => left.feedName.localeCompare(right.feedName, "zh-CN"));
  }, [rows]);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [feedName, setFeedName] = useState(manager.feedTypes[0] || "");
  const [feedSpec, setFeedSpec] = useState("");
  const [amount, setAmount] = useState("");
  const [person, setPerson] = useState("");
  const [date, setDate] = useState(beijingDate(manager.now));
  const [takenAt, setTakenAt] = useState(localDateTime(manager.now));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const availableRows = useMemo(() => rows.filter((row) => row.warehouseId === warehouseId), [rows, warehouseId]);
  const outFeeds = useMemo(() => [...new Set(availableRows.map((row) => row.feedName))], [availableRows]);
  const feedOptions = mode === "out" ? outFeeds : manager.feedTypes;
  const specOptions = useMemo(() => mode === "out"
    ? [...new Set(availableRows.filter((row) => row.feedName === feedName).map((row) => normalizeFeedSpec(row.feedSpec)))]
    : ["", ...manager.feedSettings.feedGrades], [availableRows, feedName, manager.feedSettings.feedGrades, mode]);

  useEffect(() => {
    if (!feedOptions.includes(feedName)) setFeedName(feedOptions[0] || "");
  }, [feedName, feedOptions]);

  useEffect(() => {
    if (!specOptions.includes(feedSpec)) setFeedSpec(specOptions[0] || "");
  }, [feedSpec, specOptions]);

  useEffect(() => {
    if (!warehouses.some((warehouse) => warehouse.id === warehouseId)) {
      setWarehouseId(warehouses[0]?.id || "");
    }
  }, [warehouseId, warehouses]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "in") {
        await manager.stockIn({ date, warehouseId, feedName, feedSpec, amount: Number(amount) });
      } else {
        await manager.externalOut({
          date: takenAt.slice(0, 10),
          takenAt: new Date(takenAt).getTime(),
          warehouseId,
          feedName,
          feedSpec,
          amount: Number(amount),
          person,
        });
      }
      setAmount("");
      setPerson("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  function switchMode(nextMode: "in" | "out") {
    setMode(nextMode);
    setError("");
    const options = nextMode === "out" ? outFeeds : manager.feedTypes;
    setFeedName(options[0] || "");
    setFeedSpec("");
  }

  return (
    <div className="page-stack inventory-page">
      <section className="page-title-row inventory-title">
        <div><span>库存管理</span><h1>饲料库存</h1></div>
        <div className="page-count"><strong>{groups.length}</strong><span>种在库饲料</span></div>
      </section>

      <section className="section-block inventory-balance">
        <div className="section-heading"><div><h2>库存余额</h2><p>按饲料与规格汇总</p></div></div>
        <div className="stock-list">
          {groups.map((group) => (
            <article className="stock-row" key={`${group.feedName}_${group.feedSpec}`}>
              <div className="stock-row-top">
                <span className="stock-icon"><Package size={21} /></span>
                <div className="stock-identity"><strong>{group.feedName}</strong><span>{feedSpecLabel(group.feedSpec)} · {fmt(bagJin(group.feedName, manager.feedSettings))}斤/包</span></div>
                <div className="stock-total"><strong>{stockDisplay(group.feedName, group.stockJin, manager.feedSettings).split(" / ")[0]}</strong><span>{stockDisplay(group.feedName, group.stockJin, manager.feedSettings).split(" / ")[1] || ""}</span></div>
              </div>
              <div className="warehouse-distribution">
                {group.rows.map((row) => <span key={`${row.warehouseId}_${row.feedSpec}`}><small>{manager.warehouses.find((item) => item.id === row.warehouseId)?.name || row.warehouseName}</small><b>{stockDisplay(row.feedName, row.stockJin, manager.feedSettings).split(" / ")[0]}</b></span>)}
              </div>
            </article>
          ))}
          {!groups.length && <div className="empty-state"><Package size={28} /><strong>当前没有库存</strong><span>可以在下方登记送货入库</span></div>}
        </div>
      </section>

      <section className="section-block inventory-operation">
        <div className="segmented-control" aria-label="库存操作">
          <button type="button" className={mode === "in" ? "active" : ""} onClick={() => switchMode("in")}><ArrowDown size={18} />送货入库</button>
          <button type="button" className={mode === "out" ? "active" : ""} onClick={() => switchMode("out")}><ArrowUp size={18} />领料出库</button>
        </div>
        <form className="operation-form" onSubmit={submit}>
          <div className="form-title"><div><h2>{mode === "in" ? "送货入库" : "领料出库"}</h2><p>{mode === "in" ? "登记到货包数" : "只扣库存，不计入鱼塘喂料"}</p></div>{mode === "in" ? <BoxArrowDown size={25} /> : <UserCircle size={25} />}</div>
          <div className="form-grid">
            <label><span>{mode === "in" ? "日期" : "领取时间"}</span>{mode === "in" ? <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /> : <input type="datetime-local" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} />}</label>
            <label><span>仓库</span><select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setFeedSpec(""); }}>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
            <label><span>饲料种类</span><select value={feedName} onChange={(event) => { setFeedName(event.target.value); setFeedSpec(""); }}>{feedOptions.map((feed) => <option key={feed} value={feed}>{feed}</option>)}</select></label>
            <label><span>规格</span><select value={feedSpec} onChange={(event) => setFeedSpec(event.target.value)}>{specOptions.map((spec) => <option key={spec || "default"} value={spec}>{feedSpecLabel(spec)}</option>)}</select></label>
            <label><span>数量（包）</span><input type="number" min="0.5" step="0.5" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="填写包数" /></label>
            {mode === "out" && <label><span>领料人</span><input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="填写姓名" /></label>}
          </div>
          {error && <div className="inline-error">{error}</div>}
          <button className="primary-button" type="submit" disabled={saving || manager.readOnly}>{saving ? "正在保存" : mode === "in" ? "确认入库" : "确认出库"}</button>
        </form>
      </section>
    </div>
  );
}
