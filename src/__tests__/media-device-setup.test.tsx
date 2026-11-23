import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultMediaPreferences, MediaDeviceSetup } from "@/components/media-device-setup";

const start = vi.fn();
const stop = vi.fn();
const init = vi.fn();

vi.mock("@zoom/videosdk", () => ({
  default: {
    preloadDependentAssets: vi.fn(),
    createClient: vi.fn(() => ({ init })),
    createLocalVideoTrack: vi.fn(() => ({ start, stop })),
  },
}));

describe("prévia de mídia", () => {
  afterEach(cleanup);
  beforeEach(() => {
    start.mockReset().mockResolvedValue(undefined);
    stop.mockReset().mockRejectedValue(new Error("VideoNotStartedError"));
    init.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it("ignora VideoNotStartedError ao trocar ou fechar a prévia com desfoque", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { rerender } = render(
      <MediaDeviceSetup
        value={{ ...defaultMediaPreferences, videoEnabled: true, virtualBackgroundMode: "blur" }}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(start).toHaveBeenCalledOnce());

    rerender(<MediaDeviceSetup value={defaultMediaPreferences} onChange={vi.fn()} />);
    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(warning).not.toHaveBeenCalled();
  });

  it("lista saídas de áudio e encaminha a saída selecionada", async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: "audiooutput", deviceId: "headphones", label: "Fones" } as MediaDeviceInfo,
    ]);
    const onChange = vi.fn();
    render(<MediaDeviceSetup value={defaultMediaPreferences} onChange={onChange} />);
    await screen.findByRole("option", { name: "Fones" });
    fireEvent.change(screen.getByLabelText("Saída de áudio"), { target: { value: "headphones" } });
    expect(onChange).toHaveBeenCalledWith({ ...defaultMediaPreferences, speakerDeviceId: "headphones" });
  });
});
