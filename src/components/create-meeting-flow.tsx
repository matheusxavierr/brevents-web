"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { EventData, User } from "@/lib/api-types";
import { Brand } from "./brand";

export function CreateMeetingFlow() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function createMeeting() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          router.replace(`/entrar?next=${encodeURIComponent("/meetings/novo")}`);
          return;
        }
        const user = await response.json() as User;
        if (user.account_type !== "organizer" && !user.is_superuser) {
          router.replace("/servicos/meetings");
          return;
        }
        const ownerName = user.first_name || user.name || user.username;
        const name = `Reunião de ${ownerName}`;
        const slug = `${slugify(name) || "reuniao"}-${Date.now().toString(36)}`;
        const meeting = await apiClient<EventData>("events/create-meeting/", { method: "POST", body: { name, slug } });
        router.replace(`/meetings/${meeting.slug}`);
      } catch (reason) {
        console.error("Não foi possível criar a reunião.", reason);
        setError(reason instanceof Error ? reason.message : "Não foi possível criar a reunião.");
      }
    }

    void createMeeting();
  }, [router]);

  return <main className="meeting-bootstrap">
    <Brand href="/" />
    {!error ? <><span className="navigation-spinner" /><h1>Abrindo sua sala…</h1><p>Você irá direto para a pré-sala.</p></> : <><h1>Não foi possível abrir a sala</h1><p role="alert">{error}</p><button className="button button-primary" type="button" onClick={() => window.location.reload()}><RotateCcw size={17} /> Tentar novamente</button></>}
    <Link href="/servicos/meetings"><ArrowLeft size={16} /> Voltar</Link>
  </main>;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
