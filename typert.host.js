/**
 * dsh-token-meter — Typert Host manifest.
 *
 * 声明 Host 半发布的 `tokenUsage` Remote 服务，浏览器端通过
 * `ctx.remote.tokenUsage.getOverview() / getSessionTurns(id)` 调用。
 * 方法与 index.js、client.js 中的 id / service / namespace / method 保持一致。
 */
import { z } from "zod";

const createAny = () => z.any();
const createString = () => z.string();

const overviewResult = z.union([
  z.object({ ok: z.literal(true), value: z.any() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string().optional() }) }),
]);

const sessionResult = z.union([
  z.object({ ok: z.literal(true), value: z.any() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string().optional() }) }),
]);

export const TYPERT = {
  package: "dsh-token-insight",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "dsh-token-insight#tokenUsage/getOverview",
      service: "tokenUsage",
      namespace: "tokenUsage",
      method: "getOverview",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-token-insight#TokenUsageOverviewResult",
        schema: overviewResult,
        create: () => overviewResult,
      },
      sourceLocation: { file: "index.js", line: 1, column: 1 },
    },
    {
      id: "dsh-token-insight#tokenUsage/getSessionTurns",
      service: "tokenUsage",
      namespace: "tokenUsage",
      method: "getSessionTurns",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "sessionId",
          wire: "sessionId",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "dsh-token-insight#tokenUsage/getSessionTurns:sessionId",
            schema: z.string(),
            create: createString,
          },
        },
      ],
      result: {
        mode: "strict",
        typeSymbol: "dsh-token-insight#TokenUsageSessionResult",
        schema: sessionResult,
        create: () => sessionResult,
      },
      sourceLocation: { file: "index.js", line: 1, column: 1 },
    },
  ],
  model: {
    services: [
      {
        key: "tokenUsage",
        exportName: "TokenUsageService",
        description:
          "Token usage statistics: per-day/per-model totals, workspace and session breakdowns, and per-turn usage with deliverables.",
        summary: "Token usage statistics service.",
        tags: [],
        jsDoc: "/**\n * Token usage aggregation derived from the durable session log.\n */",
        members: [
          {
            kind: "method",
            name: "getOverview",
            signature: "@Remote('getOverview') async getOverview(): Promise<TokenUsageOverviewResult>",
            summary: "Whole-dataset snapshot: daily per-model totals, models, sessions and workspaces.",
            jsDoc: "/**\n * @returns success with the aggregated overview or a business failure.\n */",
          },
          {
            kind: "method",
            name: "getSessionTurns",
            signature:
              "@Remote('getSessionTurns') async getSessionTurns(sessionId: string): Promise<TokenUsageSessionResult>",
            summary: "One session's per-turn usage, prompt/reply previews and delivered artifacts.",
            jsDoc: "/**\n * @param sessionId - target session id.\n * @returns success with the session detail or a business failure.\n */",
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
};
