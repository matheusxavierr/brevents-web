import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZoomVideoRoom } from "@/components/zoom-video-room";

vi.mock("@zoom/videosdk", () => ({ default: { preloadDependentAssets: vi.fn() } }));

describe("idioma de fala na pré-sala", () => {
  afterEach(() => { cleanup(); localStorage.clear(); });
  it("permite escolher os quatro idiomas e preserva a escolha para a chamada", () => {
    render(<ZoomVideoRoom session={{ id: 1, configured: true, is_live: false }} eventId="event" roomMode="meeting" />);
    const language = screen.getByLabelText("Idioma que vou falar");
    expect(language.querySelectorAll("option")).toHaveLength(4);
    fireEvent.change(language, { target: { value: "en-US" } });
    expect(localStorage.getItem("brevents-spoken-language")).toBe("en-US");
    expect(language).toHaveValue("en-US");
    expect(screen.getByRole("button", { name: "Entrar na reunião" })).toBeEnabled();
  });
});
