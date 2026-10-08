import { describe, expect, it } from "vitest";

import { formatChatTime } from "@/lib/format-date";

describe("formatChatTime", () => {
  it("usa um horário curto para datas válidas", () => {
    expect(formatChatTime("2026-10-08T13:45:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("não exibe Invalid Date para valores ausentes ou inválidos", () => {
    expect(formatChatTime(undefined)).toBe("--:--");
    expect(formatChatTime("not-a-date")).toBe("--:--");
  });
});
