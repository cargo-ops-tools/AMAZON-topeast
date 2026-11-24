import { describe, expect, it } from "vitest";
import { calculateReviewScore, calculateReviewScoreScenario, type ReviewScoreInput } from "./reviewScore";

const samples: Array<{ input: ReviewScoreInput; raw: number; display: number }> = [
  {
    input: {
      review: { 5: 54, 4: 4, 3: 1, 2: 1, 1: 3 },
      rating: { 5: 23, 4: 8, 3: 7, 2: 4, 1: 6 },
    },
    raw: 476 / 111,
    display: 4.3,
  },
  {
    input: {
      review: { 5: 26, 4: 9, 3: 3, 2: 1, 1: 4 },
      rating: { 5: 0, 4: 4, 3: 3, 2: 3, 1: 6 },
    },
    raw: 218 / 59,
    display: 3.7,
  },
  {
    input: {
      review: { 5: 30, 4: 4, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 1, 3: 0, 2: 6, 1: 3 },
    },
    raw: 185 / 44,
    display: 4.2,
  },
  {
    input: {
      review: { 5: 17, 4: 3, 3: 1, 2: 1, 1: 3 },
      rating: { 5: 2, 4: 1, 3: 3, 2: 2, 1: 3 },
    },
    raw: 135 / 36,
    display: 3.7,
  },
  {
    input: {
      review: { 5: 15, 4: 5, 3: 0, 2: 0, 1: 1 },
      rating: { 5: 4, 4: 2, 3: 0, 2: 0, 1: 2 },
    },
    raw: 126 / 29,
    display: 4.3,
  },
];

describe("calculateReviewScore", () => {
  it.each(samples)("matches the validated operating samples", ({ input, raw, display }) => {
    const result = calculateReviewScore(input);
    expect(result.rawScore).toBeCloseTo(raw, 8);
    expect(result.displayScore).toBe(display);
  });

  it("keeps an exact half-tenth boundary on the lower display score", () => {
    const boundary = calculateReviewScore({
      review: { 5: 1, 4: 1, 3: 2, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    expect(boundary.rawScore).toBe(3.75);
    expect(boundary.displayScore).toBe(3.7);
    expect(boundary.isBoundary).toBe(true);
  });

  it("normalizes negative and fractional counts", () => {
    const result = calculateReviewScore({
      review: { 5: 2.9, 4: -3, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: Number.NaN },
    });
    expect(result.totalCount).toBe(2);
    expect(result.totalPoints).toBe(10);
    expect(result.displayScore).toBe(5);
  });

  it("calculates the minimum five-star reviews needed to reach a target display score", () => {
    const result = calculateReviewScore({
      review: { 5: 7, 4: 3, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    const scenario = calculateReviewScoreScenario(result, 4.8);

    expect(result.displayScore).toBe(4.7);
    expect(scenario.additionalFiveStarsNeeded).toBe(3);
    const improved = calculateReviewScore({
      review: { 5: 10, 4: 3, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    expect(improved.displayScore).toBe(4.8);
  });

  it("calculates how many one-star reviews can be absorbed before the display score drops", () => {
    const result = calculateReviewScore({
      review: { 5: 9, 4: 1, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    const scenario = calculateReviewScoreScenario(result, 4.9);

    expect(result.displayScore).toBe(4.9);
    expect(scenario.oneStarCapacityBeforeDrop).toBe(0);
    expect(scenario.nextLowerDisplayScore).toBe(4.5);
  });

  it("returns an unavailable scenario for empty data", () => {
    const result = calculateReviewScore({
      review: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    expect(calculateReviewScoreScenario(result).additionalFiveStarsNeeded).toBeNull();
  });

  it("moves past an exact half-tenth boundary when calculating five-star needs", () => {
    const result = calculateReviewScore({
      review: { 5: 5, 4: 9, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    expect(result.totalPoints).toBe(61);
    expect(result.displayScore).toBe(4.4);
    expect(calculateReviewScoreScenario(result, 4.6).additionalFiveStarsNeeded).toBe(7);
  });

  it("does not count an exact half-tenth one-star boundary as remaining capacity", () => {
    const result = calculateReviewScore({
      review: { 5: 25, 4: 14, 3: 0, 2: 0, 1: 0 },
      rating: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    });
    expect(result.totalPoints).toBe(181);
    expect(result.displayScore).toBe(4.6);
    const scenario = calculateReviewScoreScenario(result, 4.8);
    expect(scenario.oneStarCapacityBeforeDrop).toBe(0);
    expect(scenario.nextLowerDisplayScore).toBe(4.5);
  });
});
