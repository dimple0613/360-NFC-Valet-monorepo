import { describe, expect, it } from "vitest";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake } from "../list-query";

describe("list-query", () => {
  it("clampListPageSize defaults, clamps to the max, and rejects non-integers", () => {
    expect(clampListPageSize(undefined)).toBe(20);
    expect(clampListPageSize(5)).toBe(5);
    expect(clampListPageSize(500)).toBe(100);
    expect(clampListPageSize(0)).toBe(1);
    expect(clampListPageSize(NaN)).toBe(20);
    expect(clampListPageSize(7.9)).toBe(7);
  });

  it("clampPage defaults to 1 and rejects values below 1", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(3)).toBe(3);
  });

  it("toSkipTake computes the right offset for a given page/pageSize", () => {
    expect(toSkipTake(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake(2, 20)).toEqual({ skip: 20, take: 20 });
    expect(toSkipTake(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it("toListQueryResult computes totalPages, rounding up, with a floor of 1", () => {
    expect(toListQueryResult([1, 2], 45, 2, 20).totalPages).toBe(3);
    expect(toListQueryResult([], 0, 1, 20).totalPages).toBe(1);
    expect(toListQueryResult([1], 20, 1, 20).totalPages).toBe(1);
  });
});
