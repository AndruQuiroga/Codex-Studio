import { z } from 'zod'

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "tool"]),
  text: z.string().default(""),
  createdAt: z.string(),
})

export const SessionEventSchema = z.object({
  type: z.enum(["event", "partial", "final", "tool_request", "tool_result", "error"]),
  sessionId: z.string(),
  messageId: z.string(),
  payload: z.record(z.any()),
})

export type SessionEvent = z.infer<typeof SessionEventSchema>

