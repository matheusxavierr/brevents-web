export const PRODUCT_PREVIEWS = {
  meeting: {
    src: "/product-previews/meeting.webp",
    title: "Uma sala para conversar e construir juntos.",
    label: "Reunião colaborativa",
    description: "Compartilhe sua apresentação, acompanhe o chat e reúna sua equipe em uma sala com controles de áudio, vídeo e participantes.",
    alt: "Reunião fictícia do BR Events com apresentação compartilhada, quatro participantes, chat e controles de microfone e câmera.",
    features: ["Compartilhamento de tela", "Chat e transcrição", "Controles dos participantes"],
  },
  event: {
    src: "/product-previews/event.webp",
    title: "Um palco para suas ideias chegarem mais longe.",
    label: "Palco ao vivo",
    description: "Uma experiência de evento com transmissão, programação e interação. A organização conduz o palco e o público acompanha a conversa.",
    alt: "Web Event fictício do BR Events com palco principal, apresentação, palestrante e interação do público pelo chat.",
    features: ["Palco moderado", "Chat e perguntas", "Programação do evento"],
  },
  networking: {
    src: "/product-previews/networking.webp",
    title: "O evento também acontece entre as pessoas.",
    label: "Lobby e rodadas 1:1",
    description: "Além do palco, o lobby dá acesso às rodadas de negócios. Os participantes encontram quem está no evento e enviam convites para conversar em uma sala 1:1.",
    alt: "Rodada de negócios fictícia do BR Events com participantes de empresas, busca e convites recebidos para conversas 1:1.",
    features: ["Participantes do evento", "Convites para 1:1", "Retorno ao palco principal"],
  },
  organizer: {
    src: "/product-previews/organizer.webp",
    title: "A organização acompanha tudo em um só lugar.",
    label: "Painel do organizador",
    description: "Prepare a programação, cadastre palestrantes, gerencie as salas e acompanhe inscrições e interações. Sua equipe coordena o evento pelo painel.",
    alt: "Painel fictício do organizador no BR Events com visão geral, inscrições, salas, programação e acesso aos participantes e interações.",
    features: ["Programação e palestrantes", "Gestão de salas", "Participantes e interações"],
  },
} as const;

export type ProductPreviewKind = keyof typeof PRODUCT_PREVIEWS;
