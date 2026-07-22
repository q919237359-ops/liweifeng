"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDots, CaretDown, NotePencil, Plus, X } from "@phosphor-icons/react";
import { PondCalendarDialog } from "@/components/PondCalendarDialog";
import { useFishManager } from "@/lib/data-context";
import { activePonds, beijingDate } from "@/lib/domain";
import type { Pond } from "@/types";

const actions = ["换水", "消毒", "拉网检查", "投药", "测水质", "清塘", "其他"];

export default function RecordsPage() {
  const manager = useFishManager();
  const ponds = activePonds(manager.ponds);
  const [memoPondId, setMemoPondId] = useState(ponds[0]?.id || "");
  const [memoDate, setMemoDate] = useState(beijingDate(manager.now));
  const [action, setAction] = useState(actions[0]);
  const [text, setText] = useState("");
  const [filterPond, setFilterPond] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [showAllMemos, setShowAllMemos] = useState(false);
  const [showAllPonds, setShowAllPonds] = useState(false);
  const [calendarPond, setCalendarPond] = useState<Pond | null>(null);
  const [error, setError] = useState("");
  const memos = useMemo(() => manager.pondMemos
    .filter((memo) => !filterPond || memo.pondId === filterPond)
    .filter((memo) => !filterDate || memo.date === filterDate)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt - left.createdAt), [filterDate, filterPond, manager.pondMemos]);
  const visibleMemos = showAllMemos ? memos : memos.slice(0, 4);
  const visiblePonds = showAllPonds ? ponds : ponds.slice(0, 4);

  useEffect(() => {
    if (!ponds.some((pond) => pond.id === memoPondId)) setMemoPondId(ponds[0]?.id || "");
  }, [memoPondId, ponds]);

  async function submitMemo(event: FormEvent) {
    event.preventDefault();
    const pond = ponds.find((item) => item.id === memoPondId);
    if (!pond) return;
    setError("");
    try {
      await manager.saveMemo({ pond, date: memoDate, action, text });
      setText("");
      setShowComposer(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    }
  }

  return (
    <div className="page-stack records-page">
      <section className="section-block memo-board">
        <div className="section-heading memo-heading">
          <div className="heading-icon"><NotePencil size={22} /></div>
          <div><h2>鱼塘备忘录</h2><p>{filterPond || filterDate ? `筛选结果 · 共${memos.length}条` : `最近记录 · 共${memos.length}条`}</p></div>
          <button className="small-command" type="button" onClick={() => setShowComposer(true)}><Plus size={17} />新增</button>
        </div>
        <div className="memo-filters">
          <label><span>筛选鱼塘</span><select value={filterPond} onChange={(event) => setFilterPond(event.target.value)}><option value="">全部鱼塘</option>{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.name} · {pond.species}</option>)}</select></label>
          <label><span>筛选日期</span><input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></label>
          {(filterPond || filterDate) && <button className="clear-filter" type="button" onClick={() => { setFilterPond(""); setFilterDate(""); }} aria-label="清空筛选"><X size={20} /></button>}
        </div>
        <div className="memo-list">
          {visibleMemos.map((memo) => <article key={memo.id} className="memo-row"><time>{memo.date.slice(5).replace("-", "/")}</time><div><strong>{memo.pondName} · {memo.species}</strong><p>{memo.text || memo.action}</p></div><span>{memo.action}</span></article>)}
          {!memos.length && <div className="empty-state"><NotePencil size={27} /><strong>还没有鱼塘备忘</strong><span>记录换水、投药或鱼塘情况</span></div>}
        </div>
        {memos.length > 4 && <button className="expand-button" type="button" onClick={() => setShowAllMemos((value) => !value)}>{showAllMemos ? "收起" : "展开"}<CaretDown className={showAllMemos ? "rotated" : ""} /></button>}
      </section>

      <section className="page-title-row records-title"><div><span>养殖记录</span><h1>鱼塘资料</h1><p>落苗日期、鱼种和数量集中查看</p></div></section>
      <section className="pond-records-section">
        <div className="section-heading"><div><h2>当前养殖鱼塘</h2><p>查看落苗资料和喂料日历</p></div>{ponds.length > 4 && <button className="text-button" type="button" onClick={() => setShowAllPonds((value) => !value)}>{showAllPonds ? "收起" : "展开全部"}<CaretDown className={showAllPonds ? "rotated" : ""} /></button>}</div>
        <div className="pond-record-list">
          {visiblePonds.map((pond, index) => <article key={pond.id} className="pond-record-card"><div className="pond-record-head"><span>{index + 1}</span><div><strong>{pond.name}</strong><small>{pond.species}</small></div><button type="button" onClick={() => setCalendarPond(pond)}><CalendarDots size={17} />喂料日历</button></div><div className="pond-record-meta"><span><small>落苗日期</small><strong>{pond.seedDate || "未设置"}</strong></span><span><small>落苗数量</small><strong>{pond.seedQty || "未设置"}</strong></span></div></article>)}
        </div>
      </section>

      {showComposer && <div className="modal-layer"><button className="modal-backdrop" type="button" onClick={() => setShowComposer(false)} aria-label="关闭新增备忘" /><form className="form-dialog" onSubmit={submitMemo}><div className="dialog-head"><div><h2>新增鱼塘备忘</h2><p>记录鱼塘当天情况</p></div><button className="icon-button" type="button" onClick={() => setShowComposer(false)}><X /></button></div><div className="form-grid"><label><span>鱼塘</span><select value={memoPondId} onChange={(event) => setMemoPondId(event.target.value)}>{ponds.map((pond) => <option key={pond.id} value={pond.id}>{pond.name} · {pond.species}</option>)}</select></label><label><span>日期</span><input type="date" value={memoDate} onChange={(event) => setMemoDate(event.target.value)} /></label><label><span>类型</span><select value={action} onChange={(event) => setAction(event.target.value)}>{actions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="full"><span>备忘内容</span><textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="填写具体情况" /></label></div>{error && <div className="inline-error">{error}</div>}<button className="primary-button" disabled={manager.readOnly}>保存备忘</button></form></div>}
      {calendarPond && <PondCalendarDialog pond={calendarPond} onClose={() => setCalendarPond(null)} />}
    </div>
  );
}
