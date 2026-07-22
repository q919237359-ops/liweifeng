"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, CaretDown, GearSix, Package, Plus, Scales, Warehouse as WarehouseIcon, X } from "@phosphor-icons/react";
import { useFishManager } from "@/lib/data-context";
import { COMMON_FEEDS, DEFAULT_FEED_GRADES, feedSpecLabel } from "@/lib/domain";
import type { Pond, Warehouse } from "@/types";

function nextPondName(ponds: Pond[]) {
  const used = ponds.map((pond) => Number(pond.name.match(/\d+/)?.[0] || 0));
  let next = 1;
  while (used.includes(next)) next += 1;
  return `${next}号塘`;
}

export default function SettingsPage() {
  const manager = useFishManager();
  const initialized = useRef(false);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [feedTypes, setFeedTypes] = useState<string[]>([]);
  const [feedGrades, setFeedGrades] = useState<string[]>([]);
  const [eelBagJin, setEelBagJin] = useState("40");
  const [newFeedType, setNewFeedType] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (manager.loading || initialized.current) return;
    initialized.current = true;
    setPonds(manager.ponds.map((pond) => ({ ...pond })));
    setWarehouses(manager.warehouses.map((warehouse) => ({ ...warehouse })));
    setFeedTypes([...manager.customFeedTypes]);
    setFeedGrades([...(manager.feedSettings.feedGrades || DEFAULT_FEED_GRADES)]);
    setEelBagJin(String(manager.feedSettings.eelBagJin || 40));
  }, [manager]);

  const active = ponds.filter((pond) => !pond.archived);
  const archived = ponds.filter((pond) => pond.archived);
  const availableFeeds = [...new Set([...COMMON_FEEDS, ...feedTypes])];

  function updatePond(id: string, patch: Partial<Pond>) {
    setPonds((current) => current.map((pond) => pond.id === id ? { ...pond, ...patch } : pond));
  }

  function addPond() {
    const now = Date.now().toString(36);
    setPonds((current) => [...current, {
      id: `pond_${now}`,
      name: nextPondName(current),
      species: "空置",
      defaultWarehouseId: "",
      defaultFeedName: "",
      defaultFeedSpec: "",
      seedDate: "",
      seedQty: "",
      archived: false,
    }]);
  }

  function addType() {
    const value = newFeedType.trim();
    if (!value || availableFeeds.includes(value)) return;
    setFeedTypes((current) => [...current, value]);
    setNewFeedType("");
  }

  function addGrade() {
    const value = newGrade.trim();
    if (!value || feedGrades.includes(value)) return;
    setFeedGrades((current) => [...current, value]);
    setNewGrade("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await manager.saveSettings({
        ponds,
        warehouses,
        customFeedTypes: feedTypes,
        feedSettings: { eelBagJin: Number(eelBagJin || 40), feedGrades },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack settings-page">
      <section className="page-title-row"><div><span>基础配置</span><h1>系统设置</h1></div></section>

      <section className="section-block settings-primary">
        <div className="section-heading"><div><h2>鱼塘设置</h2><p>鱼种、落苗资料和默认用料</p></div><button className="round-add" type="button" onClick={addPond} aria-label="新增鱼塘"><Plus size={22} /></button></div>
        <div className="pond-settings-list">
          {active.map((pond) => <details key={pond.id} className="settings-accordion">
            <summary><div><strong>{pond.name}</strong><span>{pond.species} · {warehouses.find((item) => item.id === pond.defaultWarehouseId)?.name || "未指定仓库"} · {pond.defaultFeedName || "按鱼种推荐"} · {feedSpecLabel(pond.defaultFeedSpec)}</span></div><CaretDown size={18} /></summary>
            <div className="settings-editor">
              <div className="form-grid">
                <label><span>鱼塘名称</span><input value={pond.name} onChange={(event) => updatePond(pond.id, { name: event.target.value })} /></label>
                <label><span>鱼种</span><input value={pond.species} onChange={(event) => updatePond(pond.id, { species: event.target.value || "空置" })} /></label>
                <label><span>默认仓库</span><select value={pond.defaultWarehouseId || ""} onChange={(event) => updatePond(pond.id, { defaultWarehouseId: event.target.value })}><option value="">未指定</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
                <label><span>默认饲料种类</span><select value={pond.defaultFeedName || ""} onChange={(event) => updatePond(pond.id, { defaultFeedName: event.target.value })}><option value="">按鱼种推荐</option>{availableFeeds.map((feed) => <option key={feed}>{feed}</option>)}</select></label>
                <label><span>默认规格</span><select value={pond.defaultFeedSpec || ""} onChange={(event) => updatePond(pond.id, { defaultFeedSpec: event.target.value })}><option value="">默认规格</option>{feedGrades.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
                <label><span>落苗日期</span><input type="date" value={pond.seedDate || ""} onChange={(event) => updatePond(pond.id, { seedDate: event.target.value })} /></label>
                <label className="full"><span>落苗数量</span><input value={pond.seedQty || ""} onChange={(event) => updatePond(pond.id, { seedQty: event.target.value })} placeholder="例如：30000尾" /></label>
              </div>
              <button className="archive-button" type="button" onClick={() => updatePond(pond.id, { archived: true })}><Archive size={17} />归档鱼塘</button>
            </div>
          </details>)}
        </div>
        <details className="archive-panel"><summary><span><Archive size={18} />归档鱼塘</span><b>{archived.length}</b></summary><div>{archived.map((pond) => <article key={pond.id}><div><strong>{pond.name}</strong><span>{pond.species} · 历史记录继续保留</span></div><button type="button" onClick={() => updatePond(pond.id, { archived: false })}>恢复</button></article>)}{!archived.length && <p>暂无归档鱼塘</p>}</div></details>
      </section>

      <details className="section-block settings-group">
        <summary><span className="settings-group-icon"><WarehouseIcon size={20} /></span><div><strong>仓库设置</strong><small>修改仓库显示名称</small></div><CaretDown size={18} /></summary>
        <div className="settings-group-body warehouse-settings">{warehouses.map((warehouse, index) => <label key={warehouse.id}><span>仓库{index + 1}</span><input value={warehouse.name} onChange={(event) => setWarehouses((current) => current.map((item) => item.id === warehouse.id ? { ...item, name: event.target.value } : item))} /></label>)}</div>
      </details>

      <details className="section-block settings-group" open>
        <summary><span className="settings-group-icon"><Package size={20} /></span><div><strong>饲料种类</strong><small>新增入库和鱼塘使用的饲料名称</small></div><CaretDown size={18} /></summary>
        <div className="settings-group-body token-manager">
          <label>基础种类</label><div className="token-list">{COMMON_FEEDS.map((feed) => <span className="token fixed" key={feed}>{feed}</span>)}</div>
          <label>手动添加</label><div className="token-list">{feedTypes.map((feed) => <span className="token" key={feed}>{feed}<button type="button" onClick={() => setFeedTypes((current) => current.filter((item) => item !== feed))} aria-label={`移除${feed}`}><X size={13} /></button></span>)}{!feedTypes.length && <span className="token-empty">暂未添加其他饲料</span>}</div>
          <div className="inline-add"><input value={newFeedType} maxLength={24} onChange={(event) => setNewFeedType(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addType(); } }} placeholder="输入饲料名称" /><button type="button" onClick={addType}>添加</button></div>
        </div>
      </details>

      <details className="section-block settings-group">
        <summary><span className="settings-group-icon"><Scales size={20} /></span><div><strong>鳗鱼料换算</strong><small>设置每包对应斤数</small></div><CaretDown size={18} /></summary>
        <div className="settings-group-body"><label className="single-setting"><span>每包斤数</span><input type="number" min="1" step="0.5" value={eelBagJin} onChange={(event) => setEelBagJin(event.target.value)} /></label></div>
      </details>

      <details className="section-block settings-group">
        <summary><span className="settings-group-icon"><GearSix size={20} /></span><div><strong>鱼料规格</strong><small>独立管理型号和号料</small></div><CaretDown size={18} /></summary>
        <div className="settings-group-body token-manager"><label>固定规格</label><div className="token-list"><span className="token fixed">默认规格</span></div><label>自定义规格</label><div className="token-list">{feedGrades.map((grade) => <span className="token" key={grade}>{grade}<button type="button" onClick={() => setFeedGrades((current) => current.filter((item) => item !== grade))}><X size={13} /></button></span>)}</div><div className="inline-add"><input value={newGrade} onChange={(event) => setNewGrade(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addGrade(); } }} placeholder="输入规格，例如：四号料" /><button type="button" onClick={addGrade}>添加</button></div></div>
      </details>

      {error && <div className="inline-error">{error}</div>}
      <section className="sticky-save"><button className="primary-button" type="button" onClick={save} disabled={saving || manager.readOnly}>{saving ? "正在保存" : "保存设置"}</button></section>
    </div>
  );
}
