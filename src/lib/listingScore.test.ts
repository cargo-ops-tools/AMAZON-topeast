import { describe, expect, it } from "vitest";
import {
  EMPTY_LISTING_SCORE_INPUT,
  LISTING_SCORE_DIMENSION_WEIGHTS,
  calculateListingScore,
  type ListingScoreInput,
} from "./listingScore";

function emptyInput(): ListingScoreInput {
  return {
    content: { ...EMPTY_LISTING_SCORE_INPUT.content },
    traffic: { ...EMPTY_LISTING_SCORE_INPUT.traffic },
    conversion: { ...EMPTY_LISTING_SCORE_INPUT.conversion },
    review: { ...EMPTY_LISTING_SCORE_INPUT.review },
    profitAds: { ...EMPTY_LISTING_SCORE_INPUT.profitAds },
    risk: { ...EMPTY_LISTING_SCORE_INPUT.risk },
  };
}

function perfectInput(): ListingScoreInput {
  return {
    content: {
      titleKeywordCoverage: 100,
      bulletCompleteness: 100,
      imageCount: 7,
      hasVideo: true,
      hasAPlus: true,
    },
    traffic: {
      ctr: 12,
      categoryCtr: 10,
      organicTop10Keywords: 120,
      competitorMedianOrganicTop10Keywords: 100,
      bsrChange30d: -20,
    },
    conversion: {
      cvr: 12,
      categoryCvr: 10,
      returnRate: 0.75,
      categoryReturnRate: 1,
    },
    review: {
      reviewCount: 120,
      competitorMedianReviewCount: 100,
      rating: 4.62,
      categoryRating: 4.4,
      lowStarRate: 5,
    },
    profitAds: {
      monthlyProfit: 1_000,
      profitMargin: 20,
      actualTacos: 0.7,
      breakEvenTacos: 1,
      actualCpc: 0.7,
      maxSafeCpc: 1,
    },
    risk: {
      stockCoverageDays: 60,
      listingSuppressed: false,
      ipTroRisk: "none",
    },
  };
}

describe("calculateListingScore", () => {
  it("keeps the six dimension weights at 100", () => {
    expect(Object.values(LISTING_SCORE_DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });

  it("returns a complete S result for a full strong sample", () => {
    const result = calculateListingScore(perfectInput());

    expect(result.totalScore).toBe(100);
    expect(result.dataCompleteness).toBe(100);
    expect(result.grade).toBe("S");
    expect(result.redlines).toEqual([]);
    expect(Object.values(result.dimensions).every((dimension) => dimension.score === 100)).toBe(true);
  });

  it("normalizes by completed weight without treating missing values as zero", () => {
    const input = perfectInput();
    input.conversion.cvr = null;
    input.conversion.categoryCvr = null;

    const result = calculateListingScore(input);
    expect(result.totalScore).toBe(100);
    expect(result.dataCompleteness).toBe(88);
    expect(result.grade).toBe("A");
    expect(result.dimensions.conversion.completeness).toBe(40);
  });

  it("caps an excellent but severely incomplete result at B", () => {
    const input = emptyInput();
    input.content.titleKeywordCoverage = 100;

    const result = calculateListingScore(input);
    expect(result.totalScore).toBe(100);
    expect(result.dataCompleteness).toBe(5);
    expect(result.grade).toBe("B");
  });

  it("honors the S/A/B/C score boundaries with complete data", () => {
    const sInput = perfectInput();
    sInput.conversion.cvr = 0;
    sInput.content.hasVideo = false;
    expect(calculateListingScore(sInput).totalScore).toBe(85);
    expect(calculateListingScore(sInput).grade).toBe("S");

    const aInput = perfectInput();
    aInput.conversion.cvr = 0;
    aInput.traffic.ctr = 0;
    aInput.content.titleKeywordCoverage = 0;
    expect(calculateListingScore(aInput).totalScore).toBe(75);
    expect(calculateListingScore(aInput).grade).toBe("A");

    const bInput = perfectInput();
    bInput.conversion.cvr = 0;
    bInput.traffic.ctr = 0;
    bInput.review.reviewCount = 0;
    bInput.content.titleKeywordCoverage = 0;
    bInput.content.bulletCompleteness = 0;
    bInput.content.hasVideo = false;
    expect(calculateListingScore(bInput).totalScore).toBe(60);
    expect(calculateListingScore(bInput).grade).toBe("B");

    bInput.review.lowStarRate = 30;
    expect(calculateListingScore(bInput).totalScore).toBe(56);
    expect(calculateListingScore(bInput).grade).toBe("C");
  });

  it("uses the displayed rounded score for grade boundaries", () => {
    const input = perfectInput();
    input.conversion.cvr = 0;
    input.content.hasVideo = false;
    input.content.titleKeywordCoverage = 99.2;

    const result = calculateListingScore(input);
    expect(result.totalScore).toBe(85);
    expect(result.grade).toBe("S");
  });

  it("does not grant S before suppression and IP/TRO risk are assessed", () => {
    const input = perfectInput();
    input.risk.listingSuppressed = null;
    input.risk.ipTroRisk = null;

    const result = calculateListingScore(input);
    expect(result.totalScore).toBe(100);
    expect(result.grade).toBe("A");
  });

  it.each([
    ["negative profit", (input: ListingScoreInput) => { input.profitAds.monthlyProfit = -1; }, "NEGATIVE_PROFIT"],
    ["listing suppression", (input: ListingScoreInput) => { input.risk.listingSuppressed = true; }, "LISTING_SUPPRESSED"],
    ["high IP/TRO risk", (input: ListingScoreInput) => { input.risk.ipTroRisk = "high"; }, "HIGH_IP_TRO_RISK"],
  ])("forces grade C for the %s redline", (_label, mutate, code) => {
    const input = perfectInput();
    mutate(input);
    const result = calculateListingScore(input);

    expect(result.grade).toBe("C");
    expect(result.redlines.map((redline) => redline.code)).toContain(code);
    expect(result.priorityActions.length).toBeGreaterThan(0);
  });

  it("keeps Rating and CVR improvements monotonic", () => {
    const base = emptyInput();
    base.conversion.cvr = 8;
    base.conversion.categoryCvr = 10;
    base.review.rating = 4.1;
    base.review.categoryRating = 4.4;

    const improved = emptyInput();
    improved.conversion.cvr = 10;
    improved.conversion.categoryCvr = 10;
    improved.review.rating = 4.5;
    improved.review.categoryRating = 4.4;

    expect(calculateListingScore(improved).totalScore).toBeGreaterThanOrEqual(calculateListingScore(base).totalScore);
  });

  it("never rewards a higher low-star rate or TACoS", () => {
    const safer = emptyInput();
    safer.review.lowStarRate = 5;
    safer.profitAds.actualTacos = 7;
    safer.profitAds.breakEvenTacos = 10;

    const riskier = emptyInput();
    riskier.review.lowStarRate = 20;
    riskier.profitAds.actualTacos = 11;
    riskier.profitAds.breakEvenTacos = 10;

    expect(calculateListingScore(riskier).totalScore).toBeLessThanOrEqual(calculateListingScore(safer).totalScore);
  });

  it("excludes invalid values, reports their paths, and always stays within 0-100", () => {
    const input = perfectInput();
    input.content.titleKeywordCoverage = Number.NaN;
    input.content.imageCount = -1;
    input.traffic.categoryCtr = 0;
    input.traffic.ctr = 105;
    input.conversion.cvr = 101;
    input.conversion.returnRate = 120;
    input.review.rating = 8;

    const result = calculateListingScore(input);
    expect(result.invalidFields).toEqual(expect.arrayContaining([
      "content.titleKeywordCoverage",
      "content.imageCount",
      "traffic.categoryCtr",
      "traffic.ctr",
      "conversion.cvr",
      "conversion.returnRate",
      "review.rating",
    ]));
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.dataCompleteness).toBeGreaterThanOrEqual(0);
    expect(result.dataCompleteness).toBeLessThanOrEqual(100);
    Object.values(result.dimensions).forEach((dimension) => {
      if (dimension.score !== null) {
        expect(dimension.score).toBeGreaterThanOrEqual(0);
        expect(dimension.score).toBeLessThanOrEqual(100);
      }
    });
  });

  it("returns an empty C result when every input is missing", () => {
    const result = calculateListingScore(emptyInput());
    expect(result.totalScore).toBe(0);
    expect(result.dataCompleteness).toBe(0);
    expect(result.grade).toBe("C");
    expect(Object.values(result.dimensions).every((dimension) => dimension.score === null)).toBe(true);
    expect(result.priorityActions.length).toBeGreaterThan(0);
  });
});
