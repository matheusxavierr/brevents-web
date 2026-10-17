"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Building2, Clock3, Handshake, LoaderCircle, ShieldCheck } from "lucide-react";
import type { EventData } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";
import { useMatchmaking } from "./use-matchmaking";
import { MatchmakingBoard } from "./matchmaking-board";
import styles from "./matchmaking.module.css";

export function MatchmakingLobby({ event }: { event: EventData }) {
  const { user } = useSession();
  const router = useRouter();
  const { data, error } = useMatchmaking(event.id, Boolean(user));
  useEffect(() => {
    if (!data || data.role === "coordinator") return;
    if ((data.role === "exporter" || data.round) && data.own_room_available !== false && data.room && (data.open || data.round)) router.replace(`/eventos/${event.slug}/networking/salas/${data.room.id}`);
  }, [data, event.slug, router]);
  return <div className={styles.page}><HomeHeader /><main className={styles.main}><div className={styles.topline}><span>{event.name} · Matchmaking</span><Link href={`/eventos/${event.slug}/lobby`}>Voltar ao lobby</Link></div>
    {data?.role === "coordinator" ? <MatchmakingBoard event={event} /> : <section className={styles.waiting}>
      <span className={styles.waitingIcon}>{data?.role === "exporter" ? <Building2 size={38} /> : <Handshake size={38} />}</span><span className={styles.eyebrow}>{data?.role === "exporter" ? "SUA EMPRESA NO EVENTO" : "ÁREA DE ESPERA"}</span>
      <h1>{!user ? "Entre para participar das rodadas" : !data ? "Preparando suas conexões…" : !data.open ? "As rodadas ainda estão fechadas" : data.role === "exporter" ? "Abrindo sua sala…" : `Tudo pronto, ${data.registration?.name.split(" ")[0] || "vamos conversar"}?`}</h1>
      <p>{!user ? "Use a conta associada à sua inscrição para encontrar empresas e conversar." : !data?.open ? "Você será direcionado quando o organizador abrir as rodadas. Pode aguardar aqui." : "A coordenação está organizando suas próximas conversas. Quando uma empresa for selecionada, a sala abrirá automaticamente para você."}</p>
      <div className={styles.steps}><div><ShieldCheck size={23} /><strong>Direcionamento pela coordenação</strong><small>Você não precisa escolher ou procurar uma sala.</small></div><div><Clock3 size={23} /><strong>Até 10 minutos por conversa</strong><small>Ao finalizar, você volta para cá e aguarda a próxima conexão.</small></div></div>
      {error && <p className={styles.error} role="alert">{error}</p>}{!data && user && !error && <LoaderCircle className="spin" aria-label="Carregando" />}
      {data?.own_room_available === false && <p role="status">Outro representante da sua empresa está nesta sala. Para manter o formato 1:1, aguarde ele sair; a sala será liberada automaticamente.</p>}
      {!user && <Link className={styles.primary} href={`/entrar?next=${encodeURIComponent(`/eventos/${event.slug}/networking`)}`}>Entrar na minha conta</Link>}
      {data?.open && <span className={styles.badge}><span className={styles.pulse} /> Aguardando direcionamento · atualização automática</span>}
    </section>}
  </main></div>;
}
