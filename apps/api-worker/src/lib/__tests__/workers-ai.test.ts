import { describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  classifyHazard,
  detectObjects,
  filterPersonDetections,
  type DetectedObject,
} from "../workers-ai";

function mockAi(result: unknown) {
  return { run: vi.fn().mockResolvedValue(result) } as unknown as Ai;
}

function mockAiError(err: Error) {
  return { run: vi.fn().mockRejectedValue(err) } as unknown as Ai;
}

const sampleImage = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;

describe("workers-ai", () => {
  describe("classifyHazard", () => {
    it("returns hazard type for a matching label (ladder → fall_hazard)", async () => {
      const ai = mockAi([
        { label: "ladder", score: 0.85 },
        { label: "person", score: 0.6 },
      ]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result).toEqual({
        hazardType: "fall_hazard",
        confidence: 0.85,
        rawLabel: "ladder",
      });
    });

    it("returns ppe_violation for safety vest label", async () => {
      const ai = mockAi([{ label: "safety_vest", score: 0.72 }]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result?.hazardType).toBe("ppe_violation");
    });

    it("returns electrical for wire label", async () => {
      const ai = mockAi([{ label: "Power-Line overhead", score: 0.5 }]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result?.hazardType).toBe("electrical");
    });

    it("returns fire for flame label", async () => {
      const ai = mockAi([{ label: "flame", score: 0.9 }]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result?.hazardType).toBe("fire");
    });

    it("returns machinery for crane label", async () => {
      const ai = mockAi([{ label: "crane machine", score: 0.65 }]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result?.hazardType).toBe("machinery");
    });

    it("returns null when no labels match hazard categories", async () => {
      const ai = mockAi([
        { label: "cat", score: 0.95 },
        { label: "dog", score: 0.8 },
      ]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result).toBeNull();
    });

    it("returns null when all scores are below threshold", async () => {
      const ai = mockAi([{ label: "ladder", score: 0.05 }]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result).toBeNull();
    });

    it("returns null for empty results", async () => {
      const ai = mockAi([]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result).toBeNull();
    });

    it("returns null when AI returns non-array", async () => {
      const ai = mockAi(null);
      const result = await classifyHazard(ai, sampleImage);
      expect(result).toBeNull();
    });

    it("returns null and logs error on AI failure", async () => {
      const ai = mockAiError(new Error("Model unavailable"));
      const result = await classifyHazard(ai, sampleImage);
      expect(result).toBeNull();
    });

    it("skips results with missing label or score", async () => {
      const ai = mockAi([
        { label: undefined, score: 0.9 },
        { label: "ladder", score: undefined },
        { label: "crane", score: 0.7 },
      ]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result?.hazardType).toBe("machinery");
      expect(result?.rawLabel).toBe("crane");
    });

    it("normalizes hyphenated and spaced labels", async () => {
      const ai = mockAi([{ label: "hard hat worker", score: 0.6 }]);
      const result = await classifyHazard(ai, sampleImage);
      expect(result?.hazardType).toBe("ppe_violation");
    });
  });

  describe("detectObjects", () => {
    it("returns detected objects above threshold", async () => {
      const detections: DetectedObject[] = [
        {
          label: "person",
          score: 0.92,
          box: { xmin: 10, ymin: 20, xmax: 100, ymax: 200 },
        },
        {
          label: "helmet",
          score: 0.45,
          box: { xmin: 30, ymin: 10, xmax: 60, ymax: 40 },
        },
      ];
      const ai = mockAi(detections);
      const result = await detectObjects(ai, sampleImage);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("person");
    });

    it("filters out low-confidence detections", async () => {
      const detections: DetectedObject[] = [
        {
          label: "person",
          score: 0.05,
          box: { xmin: 0, ymin: 0, xmax: 10, ymax: 10 },
        },
      ];
      const ai = mockAi(detections);
      const result = await detectObjects(ai, sampleImage);
      expect(result).toHaveLength(0);
    });

    it("returns empty array on AI error", async () => {
      const ai = mockAiError(new Error("timeout"));
      const result = await detectObjects(ai, sampleImage);
      expect(result).toEqual([]);
    });

    it("returns empty array for non-array response", async () => {
      const ai = mockAi({ error: "bad input" });
      const result = await detectObjects(ai, sampleImage);
      expect(result).toEqual([]);
    });
  });

  describe("filterPersonDetections", () => {
    it("filters only person-like detections", () => {
      const detections: DetectedObject[] = [
        {
          label: "person",
          score: 0.9,
          box: { xmin: 0, ymin: 0, xmax: 100, ymax: 200 },
        },
        {
          label: "helmet",
          score: 0.8,
          box: { xmin: 10, ymin: 5, xmax: 50, ymax: 30 },
        },
        {
          label: "face",
          score: 0.75,
          box: { xmin: 20, ymin: 10, xmax: 60, ymax: 50 },
        },
      ];
      const result = filterPersonDetections(detections);
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.label)).toEqual(["person", "face"]);
    });

    it("returns empty array when no person-like detections", () => {
      const detections: DetectedObject[] = [
        {
          label: "crane",
          score: 0.9,
          box: { xmin: 0, ymin: 0, xmax: 200, ymax: 300 },
        },
      ];
      const result = filterPersonDetections(detections);
      expect(result).toHaveLength(0);
    });
  });
});
