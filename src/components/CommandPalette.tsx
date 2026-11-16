"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Hash, Users, Briefcase, Compass, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { globalSearch, type SearchResults } from "@/lib/search";

type ResultItem = {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: "posts" | "users" | "spaces";
};

const GROUP_ICONS: Record<ResultItem["group"], React.ElementType> = {
  posts: Hash,
  users: Users,
  spaces: Compass,
};

const GROUP_LABELS: Record<ResultItem["group"], string> = {
  posts: "Posts",
  users: "People",
  spaces: "Spaces",
};

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 220);

  // Flatten search results into a single list
  const flattenResults = useCallback((data: SearchResults): ResultItem[] => {
    const items: ResultItem[] = [];
    data.posts?.forEach((p) =>
      items.push({
        id: `post-${p.id}`,
        label: p.title,
        sub: p.communitySlug ? `b/${p.communitySlug}` : undefined,
        href: `/post/${p.id}`,
        group: "posts",
      }),
    );
    data.users?.forEach((u) =>
      items.push({
        id: `user-${u.uid}`,
        label: u.displayName || u.username || u.uid,
        sub: u.username ? `f/${u.username}` : undefined,
        href: `/f/${u.username || u.uid}`,
        group: "users",
      }),
    );
    return items;
  }, []);

  // Fetch on debounced query
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    globalSearch(debouncedQuery)
      .then((data) => {
        if (!cancelled) {
          setResults(flattenResults(data));
          setActiveIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, flattenResults]);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const item = results[activeIndex];
        if (item) {
          router.push(item.href);
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, results, activeIndex, router, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  // Quick nav shortcuts shown when query is empty
  const quickNav = [
    { label: "Browse Spaces", href: "/communities", icon: Compass },
    { label: "Opportunities", href: "/l", icon: Briefcase },
    { label: "People", href: "/search?type=people", icon: Users },
  ];

  const palette = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal
      role="dialog"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Panel */}
      <div
        className={cn(
          "panel-raised relative z-10 w-full max-w-[560px] rounded-2xl overflow-hidden",
          "shadow-2xl border border-line",
        )}
        style={{ maxHeight: "min(560px, 80vh)" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 hairline-b">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts, people, spaces…"
            className={cn(
              "flex-1 bg-transparent text-sm text-ink placeholder:text-ink-4",
              "outline-none border-none focus:ring-0",
              "font-body",
            )}
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-ink-4 hover:text-ink transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="eyebrow text-[9px] px-1.5 py-0.5 rounded bg-sunken border border-line hidden sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results area */}
        <div className="overflow-y-auto" style={{ maxHeight: "460px" }}>
          {!query.trim() ? (
            /* Empty state — quick nav */
            <div className="p-3">
              <p className="eyebrow text-[9.5px] px-2 pb-1.5 tracking-widest uppercase">Quick nav</p>
              <ul>
                {quickNav.map(({ label, href, icon: Icon }) => (
                  <li key={href}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-2 hover:bg-sunken hover:text-ink transition-colors"
                      onClick={() => { router.push(href); onClose(); }}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-ink-4" />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-9 w-full rounded-lg bg-sunken skeleton-bx" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-ink-2">No results for "{query}"</p>
              <p className="eyebrow text-[10px] mt-1">Try a different search term</p>
            </div>
          ) : (
            <ul ref={listRef} role="listbox" aria-label="Search results" className="p-2">
              {results.map((item, idx) => {
                const Icon = GROUP_ICONS[item.group];
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={isActive}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-ember/10 text-ember"
                          : "text-ink-2 hover:bg-sunken hover:text-ink",
                      )}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => { router.push(item.href); onClose(); }}
                    >
                      <Icon
                        className={cn("h-4 w-4 shrink-0", isActive ? "text-ember" : "text-ink-4")}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        {item.sub && (
                          <p className="eyebrow text-[9.5px] truncate">{item.sub}</p>
                        )}
                      </div>
                      <span className="tag text-[9px] shrink-0">{GROUP_LABELS[item.group]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="hairline-b" style={{ borderTop: "1px solid var(--line)" }} />
        <div className="flex items-center gap-4 px-4 py-2">
          <span className="eyebrow text-[9px]">
            <kbd className="px-1 py-0.5 rounded bg-sunken border border-line">↑↓</kbd> navigate
          </span>
          <span className="eyebrow text-[9px]">
            <kbd className="px-1 py-0.5 rounded bg-sunken border border-line">↵</kbd> open
          </span>
          <span className="eyebrow text-[9px]">
            <kbd className="px-1 py-0.5 rounded bg-sunken border border-line">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(palette, document.body);
}

/** Global hook: attach Cmd+K / Ctrl+K to open the command palette. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return { open, setOpen, onClose: () => setOpen(false) };
}
