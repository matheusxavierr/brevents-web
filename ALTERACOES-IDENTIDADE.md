# Troca de identidade visual — BR Events

Só o visual mudou. Nenhuma rota, texto, campo, fluxo, permissão, API ou integração (Zoom) foi alterada.

## Arquivos alterados
- src/app/globals.css: todas as cores antigas (terracota, bege, grafite, sálvia) convertidas para azul #135BCA, marinho #002C70, verde #24824F e amarelo #F6AD01. Fontes trocadas para Zalando Sans Expanded (títulos) e Manrope (resto, inclusive etiquetas antes em mono). Títulos reduzidos para a fonte larga. Camada final "nova identidade" com botões, campos, cards alternando azul e verde, grafismos e ajustes de celular.
- src/app/layout.tsx: retirados os imports das fontes antigas; Manrope e Zalando carregadas pelo Google Fonts; viewport-fit=cover para celulares com notch.
- src/components/home-header.tsx: botão de menu (hambúrguer) só visual no celular, mostrando os mesmos itens. Nenhuma lógica de login mudou.
- src/app/empresas/[slug]/page.tsx, src/components/company-hub-admin.tsx, src/components/create-event-form.tsx: só as cores padrão do hub e de eventos novos (#A65C45/#7A8C74 → #135BCA/#24824F) e o degradê da capa do hub.
- public/brand/: grafismos e fotos da marca.

## Observações
- Os pacotes @fontsource antigos continuam em package.json (não são mais importados). Dá para removê-los com `npm uninstall`.
- O arquivo src/lib/api-server.ts não veio no ZIP, então as páginas que dependem dele não foram vistas com dados reais.
