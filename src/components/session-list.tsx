"use client";

import { StatusPill } from "./status-pill";
import { useI18n } from "./i18n-provider";
import type { Session } from "@/lib/demo-data";

export function SessionList({ items }: { items: Session[] }) {
  const { t } = useI18n();
  return (
    <div className="schedule-list">
      {items.map((session) => (
        <article className="schedule-item" key={`${session.time}-${session.title}`}>
          <time className="schedule-time">{session.time}</time>
          <div>
            <h3 className="schedule-title">{session.title}</h3>
            <p>{session.speaker} · {session.room}</p>
          </div>
          <span className="track-label"><span className="track-color" />{t(session.track)}</span>
          <StatusPill status={session.status} />
        </article>
      ))}
    </div>
  );
}
