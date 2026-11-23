import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { handoffToMessage, topicFor, type CVHandoff } from "../src";

interface Case {
  name: string;
  handoff: CVHandoff;
  expect: {
    error?: boolean;
    type?: string;
    topic?: string;
    priority?: string;
    worker_id?: number | null;
    worker_count?: number;
    violation_count?: number;
    compliance_score?: number;
  };
}

const { cases } = JSON.parse(
  readFileSync(resolve(__dirname, "../../../contracts/fixtures/handoff_cases.json"), "utf8"),
) as { cases: Case[] };

const ctx = { device_id: "jetson-01", session_id: "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44", source: "edge" as const };

describe("golden handoff cases (shared with the Python edge agent)", () => {
  it("has cases", () => expect(cases.length).toBeGreaterThan(5));

  for (const c of cases) {
    it(c.name, () => {
      if (c.expect.error) {
        expect(() => handoffToMessage(c.handoff, ctx)).toThrow();
        return;
      }
      const msg = handoffToMessage(c.handoff, ctx);
      expect(msg.type).toBe(c.expect.type);
      expect(topicFor(msg)).toBe(c.expect.topic);
      if (msg.type === "alert") {
        expect(msg.priority).toBe(c.expect.priority);
        expect(msg.worker_id).toBe(c.expect.worker_id);
      } else if (msg.type === "metrics") {
        expect(msg.worker_count).toBe(c.expect.worker_count);
        expect(msg.violation_count).toBe(c.expect.violation_count);
        expect(msg.compliance_score).toBe(c.expect.compliance_score);
      }
    });
  }
});
