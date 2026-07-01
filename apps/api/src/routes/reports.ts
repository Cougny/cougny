import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma, ReportReason } from '@cougny/db';
import {
  CreateReportRequestSchema,
  CreateReportResponseSchema,
  ErrorResponseSchema,
  type CreateReportResponse,
} from '@cougny/protocol';
import { requireSession } from '../auth.js';

const REASON_MAP: Record<string, ReportReason> = {
  nudity: ReportReason.NUDITY,
  harassment: ReportReason.HARASSMENT,
  minor: ReportReason.MINOR,
  spam: ReportReason.SPAM,
  other: ReportReason.OTHER,
};

/** File a moderation report against the peer from a call. */
export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/reports',
    {
      schema: {
        tags: ['moderation'],
        summary: 'Report a peer from a call',
        security: [{ bearerAuth: [] }],
        body: CreateReportRequestSchema,
        response: {
          200: CreateReportResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<CreateReportResponse | void> => {
      const sessionId = requireSession(request, reply);
      if (!sessionId) return;

      const { roomId, reportedPeerId, reason, details } = request.body;

      const call = await prisma.call.findUnique({ where: { roomId }, select: { id: true } });
      if (!call) {
        reply.code(404).send({ error: { code: 'not_found', message: 'Unknown call.' } });
        return;
      }

      const report = await prisma.report.create({
        data: {
          callId: call.id,
          reporterId: sessionId,
          reportedId: reportedPeerId,
          reason: REASON_MAP[reason] ?? ReportReason.OTHER,
          details: details ?? null,
        },
        select: { id: true },
      });

      return { reportId: report.id };
    },
  );
}
