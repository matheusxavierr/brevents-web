import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultMediaPreferences, MediaDeviceSetup } from "@/components/media-device-setup";

const start = vi.fn();
const stop = vi.fn();

vi.mock("@zoom/videosdk", () => ({
  default: {
    preloadDependentAssets: vi.fn(),
    createLocalVideoTrack: vi.fn(() => ({ start, stop })),
  },
}));

describe("prévia de mídia", () => {
  beforeEach(() => {
    start.mockReset().mockResolvedValue(undefined);
    stop.mockReset().mockRejectedValue(new Error("VideoNotStartedError"));
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
});
