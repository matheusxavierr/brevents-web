# Transcrição, legendas e tradução nativas do Zoom

## Fluxo e experiência

- Meetings, chamadas 1:1 de networking e Web Eventos usam o mesmo `ZoomVideoRoom` e o hook `useZoomCaptions`.
- `getLiveTranscriptionClient()` reconhece o áudio da sessão. Não usamos Web Speech API, um segundo acesso ao microfone ou LibreTranslate.
- O idioma falado continua configurável por usuário. Não há promessa de reconhecimento automático de idiomas misturados na mesma frase.
- A pessoa escolhe o idioma de leitura no menu Legendas. Só mostramos idiomas anunciados pelo SDK para a conta. A tradução é configurada por receptor, sem gerar três traduções na nossa API a cada fala.
- `caption-message` entrega texto provisório para a legenda e texto final para o histórico. `language=400` identifica o original; o código do idioma identifica a tradução. Não há retransmissão de texto pelo command channel.
- “Ocultar legendas” só altera a visualização e a tradução deste usuário: nunca chama `disableCaptions`, que afetaria a sessão inteira.
- A transcrição ativa é informada por um aviso na sala e no menu. O organizador desativando o serviço e erros de licença/configuração têm mensagens próprias. A configuração de idiomas não interfere em câmera, áudio, palco, compartilhamento ou grade.
- Meeting mantém Chat/Transcrição e seu auto-scroll. Web Evento mantém Chat/Perguntas/Enquete: não acrescentamos uma quarta aba nem alteramos a operação do evento. Ambos recebem legendas sobre o vídeo.

## Persistência

O Zoom é o único provedor de reconhecimento e tradução; nossa API é armazenamento e autorização, não outro serviço de STT. Cada falante envia somente seus originais finalizados. Traduções recebidas são exibidas localmente, não reenviadas para espectadores nem geradas pela API.

O POST autenticado e o POST de convidado preservam as permissões: Meeting colaborativo ou pessoa autorizada no palco; o convidado precisa do ingresso e da autorização de áudio. `message_id` permite persistência idempotente por sessão e falante. O histórico antigo continua legível. A reconexão mescla histórico salvo e ao vivo pelo identificador, sem duplicações.

## Conta e implantação

1. Habilitar Live Transcription and Translation na conta **Video SDK**. Uma licença Zoom Meetings não é equivalente.
2. Implantar primeiro a API e aplicar a migration `0015_livecaption_message_id`; depois o front.
3. Redis, banco, worker e API continuam necessários. O serviço LibreTranslate e sua variável `TRANSLATOR_URL` saíram dos Compose; nenhum volume antigo é apagado automaticamente.
4. Não foram adicionadas chaves ao navegador: credenciais SDK continuam apenas na API e os clientes recebem tokens de sessão.
5. Cobrança de LTT é separada: acompanhar os créditos/relatórios da conta. Ocultar a legenda não encerra a transcrição da sala.

## Verificação local

```powershell
npm test
npm run lint
npm run build
node scripts/check-zoom-captions.mjs
# Opcional: áudio de fala fictícia por microfone falso do Chromium
node scripts/check-zoom-captions.mjs C:\caminho\fala-de-teste.wav
# Alternativa para o Chromium automatizado: WebRTC só no token de diagnóstico
$env:ZOOM_CHECK_WEBRTC_AUDIO = "1"
node scripts/check-zoom-captions.mjs C:\caminho\fala-de-teste.wav
```

O diagnóstico exige a API Docker local configurada, inicia uma sessão Zoom temporária com consumo normal do SDK e a encerra em seguida. Sem WAV não abre áudio/vídeo. Com WAV usa a entrada de arquivo do SDK e um espectador automatizado para verificar a entrega do texto, nunca o microfone real. Não imprime tokens nem altera a conta. `BREVENTS_API_DIR` permite apontar para outro diretório local da API. `ZOOM_CHECK_WEBRTC_AUDIO` afeta somente o diagnóstico, não o transporte de áudio da aplicação.

Teste de aceitação com pessoas: host e participante em duas contas; português/inglês/espanhol/árabe; alterar leitura sem alterar fala; ocultar e reabrir legendas; silenciar áudio; entrar/sair do palco; reconectar; conferir histórico, chat e compartilhamento em desktop, celular e iPad. Precisão com sotaques, ruído e termos técnicos deve ser avaliada com áudio representativo.

Referências: [LTT no Web Video SDK](https://developers.zoom.us/docs/video-sdk/web/transcription-translation/) e [contrato do SDK 2.5.0](https://marketplacefront.zoom.us/sdk/custom/web/modules/ZoomVideo.LiveTranscriptionClient.html).
