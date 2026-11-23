"use client";

import { useMemo, useState } from "react";
import { SessionList } from "./session-list";
import { useI18n } from "./i18n-provider";
import { sessions } from "@/lib/demo-data";

const tracks = ["Todas", "Produto e inovação", "Comunidade", "Estratégia", "Design"];

export function AgendaExplorer() {
  const { t } = useI18n();
  const [track, setTrack] = useState("Todas");
  const filtered = useMemo(
    () => (track === "Todas" ? sessions : sessions.filter((session) => session.track === track)),
    [track],
  );

  return (
    <>
      <div className="filters" aria-label={t("Filtrar por trilha")}>
        {tracks.map((item) => (
          <button
            className={`filter-pill${item === track ? " active" : ""}`}
            type="button"
            aria-pressed={item === track}
            onClick={() => setTrack(item)}
            key={item}
          >
            {t(item)}
          </button>
        ))}
      </div>
      <SessionList items={filtered} />
    </>
  );
}
