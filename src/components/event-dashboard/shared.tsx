"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Room } from "@/lib/api-types";
export { listAll } from "@/lib/api-pagination";
import styles from "./dashboard.module.css";

export type DashboardAction = (operation: () => Promise<unknown>, message: string, onError?: (reason: unknown) => void) => Promise<boolean>;

export function mainRoom(rooms: Room[], eventId?: string) {
  return rooms.filter((room) => room.purpose !== "networking" && (!eventId || room.event === eventId)).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))[0];
}

export function duration(seconds = 0) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes}min`;
}

export function dateTime(value: string, timezone = "America/Sao_Paulo") {
  return new Date(value).toLocaleString("pt-BR", { timeZone: timezone, dateStyle: "short", timeStyle: "short" });
}

export function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close.current();
      if (event.key !== "Tab") return;
      const controls = element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]');
      if (!controls?.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyDown);
    return () => { document.removeEventListener("keydown", keyDown); previous?.focus(); };
  }, [busy]);
  return <div className={styles.backdrop} onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button type="button" aria-label="Fechar" onClick={onClose} disabled={busy}><X size={20} /></button></header>
      {children}
    </div>
  </div>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className={styles.empty}>{children}</div>; }
export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}
