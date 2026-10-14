"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

// The manager page's sections as tabs. Every tab's content is rendered on the server and handed in; only the visible
// one is shown. The tab is kept in the URL hash so a link opens the right one.
export default function ManagerTabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const choose = (id: string) => {
    setActive(id);
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* the hash is only a convenience */
    }
  };

  return (
    <div>
      <div role="tablist" aria-label="Manager history" className="mb-8 flex gap-1 overflow-x-auto border-b border-ice-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => choose(t.id)}
            className={`whitespace-nowrap px-4 py-2 text-sm -mb-px border-b-2 ${active === t.id ? "border-rink font-semibold" : "border-transparent text-muted hover:text-board"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
