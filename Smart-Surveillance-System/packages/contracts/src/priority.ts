import type { HandoffEvent, Priority } from "./enums";

/**
 * Priority rules (set by the platform, never by the edge):
 *  - fire, smoke                  -> CRITICAL
 *  - helmet_missing, vest_missing -> HIGH
 *  - compliant (metrics only)     -> LOW
 */
export function priorityFor(event: HandoffEvent): Priority {
  switch (event) {
    case "fire":
    case "smoke":
      return "CRITICAL";
    case "helmet_missing":
    case "vest_missing":
      return "HIGH";
    case "compliant":
      return "LOW";
  }
}
