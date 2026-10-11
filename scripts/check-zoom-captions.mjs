import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// This diagnostic opens one short-lived Zoom session. An optional WAV is sent
// through Chromium's fake microphone; it never uses the person's real microphone,
// changes account settings, creates an event or prints credentials.
const audioFixture = process.argv[2];
const apiDirectory = process.env.BREVENTS_API_DIR ?? fileURLToPath(new URL("../../brevents-api/", import.meta.url));
const sessionName = `brevents-ltt-check-${Date.now()}`;
const forceWebRtc = process.env.ZOOM_CHECK_WEBRTC_AUDIO === "1";
const python = `import os, django, json, uuid, jwt; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); django.setup(); from django.conf import settings; from types import SimpleNamespace; from events.services import issue_zoom_video_sdk_token; session=SimpleNamespace(session_name='${sessionName}', room=SimpleNamespace(event_id=uuid.uuid4())); token=issue_zoom_video_sdk_token('caption-check', session, 1); ${forceWebRtc ? "payload=jwt.decode(token, settings.ZOOM_VIDEO_SDK_SECRET, algorithms=['HS256']); payload['audio_webrtc_mode']=1; token=jwt.encode(payload, settings.ZOOM_VIDEO_SDK_SECRET, algorithm='HS256'); " : ""}print(json.dumps({'token': token, 'viewerToken': issue_zoom_video_sdk_token('caption-viewer', session, 0)}))`;
const credentials = spawnSync("docker", ["compose", "exec", "-T", "api", "python", "-c", python], { cwd: apiDirectory, encoding: "utf8" });
if (credentials.status !== 0) throw new Error("A API local precisa estar ativa no Docker para emitir o token de diagnóstico.");
const { token, viewerToken } = JSON.parse(credentials.stdout);
if (!token) throw new Error("As credenciais Zoom SDK não estão configuradas na API local.");

const server = createServer((request, response) => {
  if (audioFixture && request.url === "/audio.wav") {
    response.writeHead(200, { "Content-Type": "audio/wav" });
    createReadStream(resolve(audioFixture)).pipe(response);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html", "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" });
  response.end("<!doctype html><title>Zoom LTT diagnostic</title><p>Teste isolado, sem áudio ou vídeo.</p>");
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true, args: audioFixture ? ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${resolve(audioFixture)}`, "--autoplay-policy=no-user-gesture-required"] : [] });
  const page = await browser.newPage({ permissions: audioFixture ? ["microphone"] : [] });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.addScriptTag({ path: resolve("node_modules/@zoom/videosdk/dist/index.umd.js") });
  const evaluation = page.evaluate(async ({ token, sessionName, withAudio }) => {
    const sdk = window.WebVideoSDK.default;
    const client = sdk.createClient();
    const failures = {};
    const execute = async (name, operation) => {
      try {
        const value = await operation();
        if (value && (typeof value === "string" || "type" in value || "errorCode" in value)) failures[name] = { errorCode: value.errorCode, type: value.type, reason: value.reason ?? value.message ?? String(value) };
      } catch (reason) {
        failures[name] = { errorCode: reason?.errorCode, type: reason?.type, reason: reason?.reason ?? reason?.message ?? String(reason) };
      }
    };
    try {
      await execute("init", () => client.init("en-US", "Global", { patchJsMedia: true }));
      if (failures.init) return { failures };
      await execute("join", () => client.join(sessionName, token, "BR Events LTT check", ""));
      if (failures.join) return { failures };
      const ltt = client.getLiveTranscriptionClient();
      const status = ltt.getLiveTranscriptionStatus();
      const captions = [];
      client.on("caption-message", (message) => { if (message.done) captions.push({ text: message.text, language: message.language, done: message.done }); });
      await execute("start", () => ltt.startLiveTranscription());
      if (!failures.start) {
        await execute("speaking", () => ltt.setSpeakingLanguage("pt"));
        await execute("translation", () => ltt.setTranslationLanguage("en"));
      }
      if (withAudio && Object.keys(failures).length === 0) {
        window.diagnosticHostJoined = true;
        await new Promise((done) => {
          const button = document.createElement("button");
          button.textContent = "Reproduzir áudio de teste";
          button.onclick = async () => {
            await execute("audio", () => client.getMediaStream().startAudio({ mediaFile: { url: `${location.origin}/audio.wav` } }));
            done();
          };
          document.body.append(button);
        });
        await new Promise((done) => setTimeout(done, 30_000));
        await client.getMediaStream().stopAudio();
      }
      return { transcriptionEnabled: status.isLiveTranscriptionEnabled, translationEnabled: status.isLiveTranslationEnabled, hostDisabled: status.isHostDisableCaptions, transcriptionLanguages: status.transcriptionLanguage, failures, ...(withAudio ? { captions } : {}) };
    } finally {
      try { await client.leave(true); } catch { /* Session may not have joined. */ }
      sdk.destroyClient();
    }
  }, { token, sessionName, withAudio: Boolean(audioFixture) });
  let viewer;
  if (audioFixture) {
    await Promise.race([evaluation, page.waitForFunction(() => window.diagnosticHostJoined, null, { timeout: 30_000 })]);
    viewer = await browser.newPage();
    await viewer.goto(`http://127.0.0.1:${server.address().port}`);
    await viewer.addScriptTag({ path: resolve("node_modules/@zoom/videosdk/dist/index.umd.js") });
    await viewer.evaluate(async ({ token, sessionName }) => {
      const sdk = window.WebVideoSDK.default;
      const client = sdk.createClient();
      window.diagnosticViewer = client;
      window.diagnosticCaptions = [];
      await client.init("en-US", "Global", { patchJsMedia: true });
      await client.join(sessionName, token, "BR Events caption viewer", "");
      client.on("caption-message", (message) => { if (message.done) window.diagnosticCaptions.push({ text: message.text, language: message.language, done: message.done }); });
      const ltt = client.getLiveTranscriptionClient();
      const start = await ltt.startLiveTranscription();
      if (start && typeof start === "object" && "type" in start) throw new Error("Viewer could not start transcription.");
      await ltt.setSpeakingLanguage("pt");
      await ltt.setTranslationLanguage("en");
    }, { token: viewerToken, sessionName });
    await Promise.race([evaluation, page.getByRole("button", { name: "Reproduzir áudio de teste" }).click({ timeout: 30_000 })]);
  }
  const result = await Promise.race([evaluation, new Promise((_, reject) => setTimeout(() => reject(new Error("Zoom diagnostic exceeded 90 seconds.")), 90_000).unref())]);
  if (viewer) {
    result.viewerCaptions = await viewer.evaluate(() => window.diagnosticCaptions);
    await viewer.evaluate(async () => { try { await window.diagnosticViewer.leave(); } finally { window.WebVideoSDK.default.destroyClient(); } });
  }
  console.log(JSON.stringify(result, null, 2));
  if (Object.keys(result.failures).length || (audioFixture && (!result.captions?.some((item) => item.language === 400) || !result.viewerCaptions?.some((item) => item.language === 0)))) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
