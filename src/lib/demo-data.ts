export type SessionStatus = "live" | "soon" | "recorded";

export type Session = {
  time: string;
  title: string;
  speaker: string;
  track: string;
  room: string;
  status: SessionStatus;
};

export const sessions: Session[] = [
  { time: "09:00", title: "O futuro dos eventos híbridos", speaker: "Marina Costa · EQI", track: "Produto e inovação", room: "Auditório principal", status: "live" },
  { time: "10:15", title: "Comunidades que continuam depois do evento", speaker: "Lucas Almeida · Norte Studio", track: "Comunidade", room: "Palco Conexões", status: "soon" },
  { time: "11:30", title: "Dados, intenção e experiências memoráveis", speaker: "Ana Ribeiro · Singular", track: "Estratégia", room: "Auditório principal", status: "soon" },
  { time: "14:00", title: "Design para momentos ao vivo", speaker: "Caio Nunes · Particular", track: "Design", room: "Palco Conexões", status: "recorded" },
];

export const speakers = [
  { initials: "MC", name: "Marina Costa", role: "Head de Produto, EQI" },
  { initials: "LA", name: "Lucas Almeida", role: "Fundador, Norte Studio" },
  { initials: "AR", name: "Ana Ribeiro", role: "Diretora de Estratégia, Singular" },
];
