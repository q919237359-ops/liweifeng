"use client";

import { useMemo, useState } from "react";
import { CaretDown, CheckCircle, Clock } from "@phosphor-icons/react";
import { FeedDialog } from "@/components/FeedDialog";
import { useFishManager } from "@/lib/data-context";
import {
  activePonds,
  amountLabel,
  beijingDate,
  beijingTime,
  fmt,
  recordAmount,
  unitForFeed,
} from "@/lib/domain";
import type { Pond } from "@/types";

export default function HomePage() {
  const manager = useFishManager();
  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [expanded, setExpanded] = useState(false);
  const ponds = activePonds(manager.ponds);
  const today = beijingDate(manager.now);
  const todayRecords = useMemo(
    () => manager.feedRecords.filter((record) => !record.cancelled && record.date === today),
    [manager.feedRecords, today],
  );
  const usageByPond = useMemo(() => {
    return Object.fromEntries(ponds.map((pond) => {
      const records = todayRecords.filter((record) => record.pondId === pond.id || record.pondName === pond.name);
      let jin = 0;
      let bags = 0;
      records.forEach((record) => {
        const amount = recordAmount(record, manager.feedSettings);
        if ((record.unit || unitForFeed(record.feedName)) === "jin") jin += amount;
        else bags += amount;
      });
      return [pond.id, jin ? `${fmt(jin, 1)}斤` : bags ? `${fmt(bags, 1)}包` : (pond.species.includes("鳗") ? "0斤" : "0包")];
    }));
  }, [manager.feedSettings, ponds, todayRecords]);
  const visibleRecords = expanded ? todayRecords : todayRecords.slice(0, 4);

  return (
    <div className="page-stack home-page">
      <section className="page-title-row">
        <div><span>今日喂料</span><h1>我的鱼塘</h1></div>
        <div className="page-count"><span>养殖中</span><strong>{ponds.length}</strong></div>
      </section>

      <section className="pond-grid" aria-label="当前养殖鱼塘">
        {ponds.map((pond) => (
          <button key={pond.id} type="button" className="pond-card" onClick={() => setSelectedPond(pond)}>
            <div className="pond-card-head"><strong>{pond.name}</strong><span>{pond.species}</span></div>
            <div className="pond-card-rule" />
            <small>今日用料</small>
            <b>{usageByPond[pond.id]}</b>
          </button>
        ))}
      </section>

      <section className="section-block today-section">
        <div className="section-heading">
          <div><h2>今日记录</h2><p>{todayRecords.length} 条喂料记录</p></div>
          {todayRecords.length > 4 && <button type="button" className="text-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : "展开全部"}<CaretDown size={15} className={expanded ? "rotated" : ""} /></button>}
        </div>
        <div className="today-list">
          {visibleRecords.map((record, index) => (
            <article key={record.id} className="today-row">
              <span className="row-index">{record.pondName.replace(/号塘$/, "") || index + 1}</span>
              <div className="today-row-main">
                <div><strong>{record.pondName}</strong><span>{record.species}</span></div>
                <p>第{todayRecords.filter((item) => item.pondId === record.pondId && item.createdAt <= record.createdAt).length}餐&nbsp; {amountLabel(record.feedName, recordAmount(record, manager.feedSettings), record.unit || unitForFeed(record.feedName))}{record.feedSpec ? ` · ${record.feedSpec}` : ""}</p>
              </div>
              <time><Clock size={13} />{beijingTime(record.createdAt)}</time>
            </article>
          ))}
          {!todayRecords.length && <div className="empty-state"><CheckCircle size={28} /><strong>今天还没有喂料记录</strong><span>点击上方鱼塘即可登记</span></div>}
        </div>
      </section>

      {selectedPond && <FeedDialog pond={selectedPond} onClose={() => setSelectedPond(null)} />}
    </div>
  );
}
