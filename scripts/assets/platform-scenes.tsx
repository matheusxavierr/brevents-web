import { ArrowRight, CalendarDays, Check, ChevronDown, LayoutDashboard, MessageSquare, Mic, MicOff, MonitorUp, Send, Settings, Share2, Users, Video } from "lucide-react";

const people = [
  { name: "Ana Ribeiro", initials: "AR", company: "Aurora Studio", color: "mint" },
  { name: "Pedro Alves", initials: "PA", company: "Horizonte Tech", color: "blue" },
  { name: "Marina Costa", initials: "MC", company: "Conecta Lab", color: "rose" },
  { name: "Lucas Mendes", initials: "LM", company: "Norte Soluções", color: "gold" },
];

function Avatar({ index = 0, small = false }: { index?: number; small?: boolean }) {
  const person = people[index];
  return <span className={`demo-avatar ${person.color} ${small ? "small" : ""}`}>{person.initials}</span>;
}

function Header({ light = false }: { light?: boolean }) {
  return <header className={`demo-header ${light ? "light" : ""}`}><strong>BR Events</strong><span>{light ? "CONEXÕES & NEGÓCIOS 2026" : "SALA AO VIVO · CONECTADO"}</span><span className="demo-header-back">Voltar para a página principal</span></header>;
}

function Presentation({ event = false }: { event?: boolean }) {
  return <div className={`demo-presentation ${event ? "event" : ""}`}><div><span className="demo-slide-kicker">{event ? "CONEXÕES & NEGÓCIOS 2026" : "AURORA STUDIO · PLANEJAMENTO"}</span><h1>{event ? <>Conexões que<br />geram negócios.</> : <>Boas ideias começam<br />com uma conversa.</>}</h1><p>{event ? "Pessoas, ideias e oportunidades no mesmo palco." : "Vamos construir os próximos passos, juntos."}</p><span className="demo-slide-line" /></div><div className="demo-slide-art"><i /><i /><i /></div><span className="demo-slide-footer">{event ? "PALCO PRINCIPAL" : "REUNIÃO DE EQUIPE"} <span>01 / 08</span></span></div>;
}

function Conversation({ event = false }: { event?: boolean }) {
  return <aside className="demo-chat"><div className="demo-chat-tabs"><span className="active"><MessageSquare size={16} /> Chat</span><span>{event ? "Perguntas" : "Transcrição"}</span>{event && <span>Enquetes</span>}</div><div className="demo-messages"><p className="demo-chat-welcome">A conversa acontece aqui.</p>{[
    { index: 1, time: "14:02", text: event ? "Ótima abertura! Já anotei várias ideias." : "Podemos revisar o cronograma juntos?" },
    { index: 2, time: "14:03", text: event ? "Nos vemos nas rodadas de negócios!" : "Claro! Compartilha a proposta com a gente." },
    { index: 0, time: "14:04", text: event ? "As perguntas podem ser enviadas pela aba ao lado." : "Já está na tela. Vamos alinhar os próximos passos." },
  ].map(({ index, time, text }) => <div className="demo-message" key={index}><Avatar index={index} small /><div><strong>{people[index].name}</strong><time>{time}</time><p>{text}</p></div></div>)}</div><div className="demo-composer"><span>Escreva sua mensagem...</span><Send size={18} /></div></aside>;
}

function Controls() {
  return <div className="demo-controls"><span><Mic size={20} /> Microfone <ChevronDown size={14} /></span><span><Video size={20} /> Câmera <ChevronDown size={14} /></span><span className="sharing"><MonitorUp size={20} /> Compartilhando</span><span><MessageSquare size={19} /> Legendas</span><span className="exit">Sair</span></div>;
}

function LiveRoom({ event = false }: { event?: boolean }) {
  return <div className="demo-screen demo-live"><Header /><div className="demo-live-layout"><div className="demo-video"><div className="demo-status"><span><i /> AO VIVO · {event ? "PALCO PRINCIPAL" : "REUNIÃO"}</span><div><span><Share2 size={16} /> Compartilhar sala</span><span><Users size={17} /> Participantes <b>{event ? "320" : "4"}</b></span></div></div><div className="demo-stage"><span className="demo-sharing-label"><MonitorUp size={14} /> {event ? "TELA COMPARTILHADA" : "ANA RIBEIRO ESTÁ APRESENTANDO"}</span><Presentation event={event} /><div className="demo-filmstrip">{(event ? [2] : [0, 1, 2, 3]).map(index => <div key={index}><Avatar index={index} small /><span>{people[index].name}</span><MicOff size={13} /></div>)}</div></div><Controls /></div><Conversation event={event} /></div></div>;
}

function Networking() {
  return <div className="demo-screen demo-networking"><Header light /><div className="demo-network-content"><div className="demo-breadcrumb">EVENTO / LOBBY / RODADAS DE NEGÓCIOS</div><div className="demo-network-heading"><div><span className="demo-eyebrow">CONEXÕES & NEGÓCIOS 2026</span><h1>Uma conversa pode<br />abrir novas portas.</h1><p>Encontre quem está no evento e convide para uma conversa 1:1.</p></div><span className="demo-online"><i /> 24 pessoas disponíveis</span></div><div className="demo-network-layout"><section className="demo-directory"><div className="demo-card-heading"><h2>Quem está no evento</h2><span>Buscar por nome ou empresa</span></div><div className="demo-people">{people.map((person, index) => <article key={person.name}><Avatar index={index} small /><div><h3>{person.name}</h3><p>{person.company}</p><small><i /> Disponível para conversar</small></div><span className="demo-invite">Convidar para 1:1 <ArrowRight size={15} /></span></article>)}</div></section><aside className="demo-invitations"><h2>Seus convites</h2><p>Escolha com quem quer conversar.</p>{[2, 3].map(index => <div className="demo-invitation" key={index}><span className="demo-eyebrow">CONVITE RECEBIDO</span><strong>{people[index].name}</strong><p>{people[index].company} quer conversar com você.</p><div><span>Aceitar convite</span><span>Recusar</span></div></div>)}<div className="demo-main-stage"><Video size={21} /><strong>O evento continua por aqui.</strong><span>Voltar ao palco principal <ArrowRight size={15} /></span></div></aside></div></div></div>;
}

function Organizer() {
  const quickLinks = [
    { Icon: Video, title: "Transmissão", description: "Gerencie as salas e o palco." },
    { Icon: Users, title: "Participantes", description: "Acompanhe e modere o público." },
    { Icon: MessageSquare, title: "Interações", description: "Perguntas, chat e enquetes." },
  ];
  return <div className="demo-screen demo-organizer"><aside className="demo-sidebar"><strong>BR Events</strong><small>PAINEL</small>{["Visão geral", "Eventos"].map(name => <span className={name === "Visão geral" ? "selected" : ""} key={name}><LayoutDashboard size={17} />{name}</span>)}<small>PRODUÇÃO</small>{["Programação", "Transmissão"].map(name => <span key={name}><CalendarDays size={17} />{name}</span>)}<small>PÚBLICO</small>{["Participantes", "Interações", "Analytics"].map(name => <span key={name}><Users size={17} />{name}</span>)}<div className="demo-sidebar-bottom"><Settings size={18} /> Configurações<div><Avatar small /><span>Ana Ribeiro<small>Organizadora</small></span></div></div></aside><main className="demo-dashboard"><div className="demo-dashboard-heading"><div><span className="demo-eyebrow">PAINEL DO ORGANIZADOR</span><h1>Visão geral</h1><p><i /> Conexões & Negócios 2026</p></div><span className="demo-outline-action">Ver evento <ArrowRight size={15} /></span></div><div className="demo-stat-grid">{[["Inscrições confirmadas", "1.427"], ["Participantes online", "320"], ["Salas do evento", "2"], ["Perguntas recebidas", "18"]].map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>CONEXÕES & NEGÓCIOS 2026</span></article>)}</div><div className="demo-dashboard-grid"><section className="demo-dashboard-card"><div className="demo-card-heading"><h2>Seu evento está pronto</h2><span>5 de 5 etapas</span></div><div className="demo-progress" />{["Informações do evento", "Palcos e transmissão", "Programação e palestrantes", "Inscrições do público", "Interações habilitadas"].map(name => <div className="demo-check" key={name}><Check size={18} />{name}</div>)}</section><section className="demo-dashboard-card"><h2>Acesso rápido</h2>{quickLinks.map(({ Icon, title, description }) => <div className="demo-quick" key={title}><Icon size={22} /><div><strong>{title}</strong><p>{description}</p></div><ArrowRight size={16} /></div>)}</section></div><div className="demo-dashboard-footer"><span><i /> Evento publicado</span><strong>Tudo em um lugar. Sua equipe no controle.</strong><span>Administrar evento <ArrowRight size={16} /></span></div></main></div>;
}

export function PlatformScene({ kind }: { kind: "meeting" | "event" | "networking" | "organizer" }) {
  if (kind === "networking") return <Networking />;
  if (kind === "organizer") return <Organizer />;
  return <LiveRoom event={kind === "event"} />;
}
