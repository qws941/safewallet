/**
 * Barrel re-export for backward compatibility.
 * All hooks have been split into domain-specific modules.
 * New code should import from the specific module directly.
 */
export * from "./use-api-base";
export * from "./use-admin-api";
export * from "./use-posts-api";
export * from "./use-actions-api";
export * from "./use-attendance-api";
export * from "./use-points-api";
export * from "./use-education-api";
export * from "./use-sites-api";
export * from "./use-monitoring-api";
export * from "./use-rewards";
