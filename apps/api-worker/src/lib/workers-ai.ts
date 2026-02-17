import { createLogger } from "./logger";

const logger = createLogger("workers-ai");

export const HAZARD_CATEGORIES = [
  "fall_hazard",
  "electrical",
  "chemical",
  "fire",
  "confined_space",
  "ppe_violation",
  "structural",
  "machinery",
  "general",
] as const;

export type HazardCategory = (typeof HAZARD_CATEGORIES)[number];

const LABEL_TO_HAZARD: Record<string, HazardCategory> = {
  hard_hat: "ppe_violation",
  helmet: "ppe_violation",
  safety_vest: "ppe_violation",
  goggles: "ppe_violation",
  mask: "ppe_violation",
  ladder: "fall_hazard",
  scaffold: "fall_hazard",
  scaffolding: "fall_hazard",
  harness: "fall_hazard",
  railing: "fall_hazard",
  roof: "fall_hazard",
  cliff: "fall_hazard",
  cable: "electrical",
  wire: "electrical",
  plug: "electrical",
  switch: "electrical",
  power_line: "electrical",
  electric: "electrical",
  barrel: "chemical",
  tank: "chemical",
  container: "chemical",
  bottle: "chemical",
  canister: "chemical",
  fire: "fire",
  flame: "fire",
  smoke: "fire",
  extinguisher: "fire",
  torch: "fire",
  tunnel: "confined_space",
  manhole: "confined_space",
  pipe: "confined_space",
  crane: "machinery",
  forklift: "machinery",
  excavator: "machinery",
  bulldozer: "machinery",
  truck: "machinery",
  tractor: "machinery",
  demolition: "structural",
  crack: "structural",
  collapse: "structural",
  rubble: "structural",
  beam: "structural",
  construction: "general",
  construction_site: "general",
  building: "general",
};

const SCORE_THRESHOLD = 0.15;

export interface HazardClassificationResult {
  hazardType: HazardCategory;
  confidence: number;
  rawLabel: string;
}

export async function classifyHazard(
  ai: Ai,
  imageData: ArrayBuffer,
): Promise<HazardClassificationResult | null> {
  try {
    const imageArray = Array.from(new Uint8Array(imageData));

    const results = await ai.run("@cf/microsoft/resnet-50", {
      image: imageArray,
    });

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    for (const result of results) {
      if (!result.label || typeof result.score !== "number") continue;
      if (result.score < SCORE_THRESHOLD) continue;

      const normalizedLabel = result.label.toLowerCase().replace(/[\s-]/g, "_");

      for (const [keyword, category] of Object.entries(LABEL_TO_HAZARD)) {
        if (normalizedLabel.includes(keyword)) {
          return {
            hazardType: category,
            confidence: result.score,
            rawLabel: result.label,
          };
        }
      }
    }

    return null;
  } catch (err) {
    logger.error("Hazard classification failed", {
      error: {
        name: "AiClassificationError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

export interface DetectedObject {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

export async function detectObjects(
  ai: Ai,
  imageData: ArrayBuffer,
): Promise<DetectedObject[]> {
  try {
    const imageArray = Array.from(new Uint8Array(imageData));

    const results = (await ai.run(
      "@cf/facebook/detr-resnet-50" as Parameters<typeof ai.run>[0],
      { image: imageArray },
    )) as unknown as DetectedObject[];

    if (!Array.isArray(results)) {
      return [];
    }

    return results.filter(
      (r) =>
        r.label &&
        typeof r.score === "number" &&
        r.score >= SCORE_THRESHOLD &&
        r.box,
    );
  } catch (err) {
    logger.error("Object detection failed", {
      error: {
        name: "AiDetectionError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return [];
  }
}

export function filterPersonDetections(
  detections: DetectedObject[],
): DetectedObject[] {
  const personLabels = ["person", "face", "human", "man", "woman", "child"];
  return detections.filter((d) => personLabels.includes(d.label.toLowerCase()));
}
