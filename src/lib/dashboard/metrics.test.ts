import { describe, expect, it } from "vitest";
import { DEFAULT_METRICS, isMetricSelection, metricCookieName, parseMetricSelection } from "./metrics";
describe("dashboard metric preferences", () => {
    it("shows gross expenses by default and restores saved choices including none", () => {
        expect(parseMetricSelection(undefined)).toEqual(DEFAULT_METRICS);
        expect(DEFAULT_METRICS).toContain("expenseTotal");
        expect(parseMetricSelection('["expenseTotal"]')).toEqual(["expenseTotal"]);
        expect(parseMetricSelection('[]')).toEqual([]);
    });
    it("rejects untrusted, duplicated or corrupt cookie values", () => {
        for (const value of ['invalid', '{}', '["unknown"]', '["expenseTotal","expenseTotal"]', '[1]']) expect(parseMetricSelection(value)).toEqual(DEFAULT_METRICS);
        expect(isMetricSelection(null)).toBe(false);
    });
    it("keeps preferences separate between users on the same browser", () => {
        expect(metricCookieName("first")).not.toBe(metricCookieName("second"));
    });
});
