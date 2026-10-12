import { describe, expect, it } from "vitest";
import { formatShowcasePrice, normalizeShowcasePrice } from "@/lib/company-showcase";

describe("preços do mostruário", () => {
  it("aceita entrada brasileira e envia um valor decimal para a API", () => {
    expect(normalizeShowcasePrice("149,90")).toBe("149.90");
    expect(normalizeShowcasePrice("1.234,56")).toBe("1234.56");
    expect(normalizeShowcasePrice("149.90")).toBe("149.90");
    expect(formatShowcasePrice("149.90")).toMatch(/R\$\s*149,90/);
  });

  it("permite remover o preço sem confundir um valor zero com ausência de preço", () => {
    expect(normalizeShowcasePrice("")).toBeNull();
    expect(normalizeShowcasePrice(null)).toBeNull();
    expect(formatShowcasePrice(undefined)).toBeNull();
    expect(formatShowcasePrice("0.00")).toMatch(/R\$\s*0,00/);
    expect(formatShowcasePrice("invalid")).toBeNull();
    expect(formatShowcasePrice("-10")).toBeNull();
  });
});
