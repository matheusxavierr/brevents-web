import type { SessionStatus } from "@/lib/demo-data";

const labels: Record<SessionStatus, string> = {
  live: "Ao vivo",
  soon: "Em breve",
  recorded: "Gravado",
};

export function StatusPill({ status }: { status: SessionStatus }) {
  return (
    <span className={`status-pill status-${status}`}>
      {status === "live" && <span className="live-dot" aria-hidden="true" />}
      {labels[status]}
    </span>
  );
}
