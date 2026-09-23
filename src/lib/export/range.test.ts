import { describe, expect, it } from "vitest";
import { resolveExportRange } from "./range";

const TODAY = "2026-03-18"; // Wednesday

describe("resolveExportRange", () => {
  it("resolves a single day", () => {
    expect(resolveExportRange({ preset: "day" }, "monthly", TODAY)).toEqual({ start: TODAY, end: TODAY, preset: "day", label: "יום 18/03/2026" });
  });

  it("resolves the Sunday-Saturday week containing the anchor date", () => {
    expect(resolveExportRange({ preset: "week" }, "monthly", TODAY)).toEqual({ start: "2026-03-15", end: "2026-03-21", preset: "week", label: "שבוע 15/03/2026–21/03/2026" });
  });

  it("resolves the current calendar month", () => {
    const range = resolveExportRange({ preset: "month" }, "monthly", TODAY);
    expect(range).toMatchObject({ start: "2026-03-01", end: "2026-03-31", preset: "month" });
  });

  it("resolves an explicit month param", () => {
    const range = resolveExportRange({ preset: "month", month: "2026-01" }, "monthly", TODAY);
    expect(range).toMatchObject({ start: "2026-01-01", end: "2026-01-31" });
  });

  it("resolves the current bimonthly reporting period", () => {
    const range = resolveExportRange({ preset: "period" }, "bimonthly", TODAY);
    expect(range).toMatchObject({ start: "2026-03-01", end: "2026-04-30" });
  });

  it("resolves the current calendar year", () => {
    expect(resolveExportRange({ preset: "year" }, "monthly", TODAY)).toEqual({ start: "2026-01-01", end: "2026-12-31", preset: "year", label: "שנת 2026" });
  });

  it("resolves an explicit year param", () => {
    expect(resolveExportRange({ preset: "year", year: "2024" }, "monthly", TODAY)).toMatchObject({ start: "2024-01-01", end: "2024-12-31" });
  });

  it("resolves a custom range", () => {
    const range = resolveExportRange({ preset: "custom", start: "2026-02-01", end: "2026-02-10" }, "monthly", TODAY);
    expect(range).toMatchObject({ start: "2026-02-01", end: "2026-02-10" });
  });

  it("rejects an invalid custom range", () => {
    expect(() => resolveExportRange({ preset: "custom", start: "2026-02-10", end: "2026-02-01" }, "monthly", TODAY)).toThrow();
  });

  it("falls back to the reporting period for an unknown preset", () => {
    expect(resolveExportRange({ preset: "bogus" }, "bimonthly", TODAY)).toMatchObject({ preset: "period" });
  });
});
