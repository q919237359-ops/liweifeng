"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { GearSix, ListDashes, Package, FishSimple } from "@phosphor-icons/react";
import { headerDate } from "@/lib/domain";
import { useFishManager } from "@/lib/data-context";

const navigation = [
  { href: "/", label: "鱼塘", icon: FishSimple },
  { href: "/inventory/", label: "库存", icon: Package },
  { href: "/records/", label: "记录", icon: ListDashes },
  { href: "/settings/", label: "设置", icon: GearSix },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, status, message, clearMessage, now } = useFishManager();
  const [query, setQuery] = useState("");

  useEffect(() => setQuery(window.location.search), []);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="app-header">
        <div className="brand-lockup">
          <Image src={`${basePath}/icon-192.png`} width={52} height={52} alt="鱼管家" priority />
          <div>
            <div className="brand-name">鱼管家</div>
            <div className="brand-subtitle">鱼塘喂料与库存管理</div>
          </div>
        </div>
        <div className="header-status">
          <time>{headerDate(now)}</time>
          <span>{status}</span>
        </div>
      </header>

      <main id="main-content" className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="主要导航">
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace(/\/$/, ""));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={`${item.href}${query}`} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon size={23} weight={active ? "fill" : "regular"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {loading && <div className="loading-bar" aria-label="正在加载 Firebase 数据" />}
      {message && (
        <button className="toast" type="button" onClick={clearMessage}>
          {message}
        </button>
      )}
    </div>
  );
}
