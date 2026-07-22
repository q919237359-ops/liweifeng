"use client";

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useFishManager } from "@/lib/data-context";
import { amountLabel, beijingDate, fmt, recordAmount, unitForFeed } from "@/lib/domain";
import type { FeedRecord, Pond } from "@/types";

function addMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function PondCalendarDialog({ pond, onClose }: { pond: Pond; onClose(): void }) {
  const manager = useFishManager();
  const [month, setMonth] = useState(beijingDate(manager.now).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState("");
  const records = useMemo(
    () => manager.feedRecords.filter((record) => !record.cancelled && (record.pondId === pond.id || record.pondName === pond.name)),
    [manager.feedRecords, pond.id, pond.name],
  );
  const byDate = useMemo(() => records.reduce<Record<string, FeedRecord[]>>((result, record) => {
    (result[record.date] ||= []).push(record);
    return result;
  }, {}), [records]);
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const start = new Date(year, monthNumber - 1, 1).getDay();
  const cells = Array.from({ length: start + days }, (_, index) => index < start ? null : index - start + 1);
  const dayRecords = selectedDate ? byDate[selectedDate] || [] : [];
  const totalJin = records.reduce((sum, record) => sum + Number(record.stockJin || 0), 0);

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" type="button" aria-label="关闭喂料日历" onClick={onClose} />
      <section className="calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
        <div className="dialog-handle" />
        <div className="dialog-head">
          <div><h2 id="calendar-title">{pond.name} · {pond.species}</h2><p>落苗：{pond.seedDate || "未设置"} · 数量：{pond.seedQty || "未设置"}</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={21} /></button>
        </div>
        <div className="calendar-summary"><span><small>累计用料</small><strong>{fmt(totalJin, 1)}斤</strong></span><span><small>记录天数</small><strong>{Object.keys(byDate).length}天</strong></span></div>
        <div className="calendar-month-head">
          <button type="button" onClick={() => setMonth(addMonth(month, -1))} aria-label="上月"><CaretLeft size={19} /></button>
          <strong>{year}年{monthNumber}月</strong>
          <button type="button" onClick={() => setMonth(addMonth(month, 1))} aria-label="下月"><CaretRight size={19} /></button>
        </div>
        <div className="calendar-weekdays">{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span key={`empty_${index}`} className="calendar-day empty" />;
            const date = `${month}-${String(day).padStart(2, "0")}`;
            const current = byDate[date] || [];
            const label = current.map((record) => `${recordAmount(record, manager.feedSettings)}${(record.unit || unitForFeed(record.feedName)) === "jin" ? "斤" : "包"}${record.feedName}`).join(" + ");
            return <button key={date} type="button" className={`calendar-day ${current.length ? "has-record" : ""} ${selectedDate === date ? "selected" : ""}`} onClick={() => setSelectedDate(date)}><b>{day}</b>{label && <small>{label}</small>}</button>;
          })}
        </div>
        <div className="day-detail">
          <div className="section-heading"><div><h3>{selectedDate || "当天餐次明细"}</h3><p>{selectedDate ? `${dayRecords.length} 条记录` : "点击有记录的日期查看"}</p></div></div>
          {dayRecords.map((record, index) => <article key={record.id} className="meal-detail"><span>{index + 1}</span><div><small>第{index + 1}餐</small><strong>{amountLabel(record.feedName, recordAmount(record, manager.feedSettings), record.unit || unitForFeed(record.feedName))}{record.feedSpec ? ` · ${record.feedSpec}` : ""}</strong></div></article>)}
        </div>
      </section>
    </div>
  );
}
