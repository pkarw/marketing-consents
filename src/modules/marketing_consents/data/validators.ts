import { isIP } from "node:net";
import { z } from "zod";
import { CONSENT_STATUSES } from "./entities.js";
const optionalNameSchema = z.string().trim().max(200).nullable().optional();
export const consentCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,99}$/);
export const recordConsentSchema = z.object({
    eventId: z.string().uuid(),
    email: z.string().trim().email().max(254),
    firstName: optionalNameSchema,
    lastName: optionalNameSchema,
    userIp: z.string().refine((value) => isIP(value) !== 0, 'Invalid IP address'),
    consentCode: consentCodeSchema,
    consentName: z.string().trim().min(1).max(200),
    consentText: z.string().superRefine((value, ctx) => {
        const bytes = new TextEncoder().encode(value).byteLength;
        if (bytes < 1 || bytes > 32768) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Consent text must be 1–32768 UTF-8 bytes' });
        }
    }),
    consentUrl: z.string().url().max(2048).refine((value) => {
        try {
            return new URL(value).protocol === 'https:';
        }
        catch {
            return false;
        }
    }, 'Consent URL must use HTTPS').nullable().optional(),
    contentSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    grantedAt: z.string().datetime({ offset: true }),
    accepted: z.literal(true),
    confirmationMethod: z.literal('click'),
}).strict();
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
const dateFilterSchema = z.string().datetime({ offset: true });
export const consentListSchema = z.object({
    code: consentCodeSchema.optional(),
    status: z.enum(CONSENT_STATUSES).optional(),
    grantedFrom: dateFilterSchema.optional(),
    grantedTo: dateFilterSchema.optional(),
    withdrawnFrom: dateFilterSchema.optional(),
    withdrawnTo: dateFilterSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sortField: z.enum(['grantedAt', 'withdrawnAt', 'status', 'consentCode']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
}).strict().superRefine((value, ctx) => {
    for (const [fromKey, toKey] of [
        ['grantedFrom', 'grantedTo'],
        ['withdrawnFrom', 'withdrawnTo'],
    ] as const) {
        const from = value[fromKey];
        const to = value[toKey];
        if (from && to && new Date(from).getTime() >= new Date(to).getTime()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [toKey],
                message: `${toKey} must be after ${fromKey}`,
            });
        }
    }
});
export type ConsentListQuery = z.infer<typeof consentListSchema>;
export const withdrawConsentSchema = z.object({
    updatedAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(1).max(1000),
}).strict();
export type WithdrawConsentInput = z.infer<typeof withdrawConsentSchema>;
export const withdrawConsentCommandSchema = withdrawConsentSchema.extend({
    consentRecordId: z.string().uuid(),
});
export type WithdrawConsentCommandInput = z.infer<typeof withdrawConsentCommandSchema>;
