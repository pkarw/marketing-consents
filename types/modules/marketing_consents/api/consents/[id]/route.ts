import { z } from "zod";
import { getAuthFromRequest } from "@open-mercato/shared/lib/auth/server";
import { createRequestContainer } from "@open-mercato/shared/lib/di/container";
import { findOneWithDecryption } from "@open-mercato/shared/lib/encryption/find";
import { resolveOrganizationScopeForRequest } from "@open-mercato/core/modules/directory/utils/organizationScope";
import type { OpenApiMethodDoc, OpenApiRouteDoc } from "@open-mercato/shared/lib/openapi";
import { ConsentRecord, WithdrawalEvidence } from "../../../data/entities.js";
import { marketingConsentsTag } from "../../openapi.js";
const idSchema = z.string().uuid();
const itemSchema = z.object({
    id: z.string().uuid(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    consentCode: z.string(),
    consentName: z.string(),
    grantedAt: z.string(),
    status: z.enum(['granted', 'withdrawn']),
    withdrawnAt: z.string().nullable(),
    updatedAt: z.string(),
    userIp: z.string(),
    consentText: z.string(),
    consentUrl: z.string().nullable(),
    contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
    receivedAt: z.string(),
    confirmationMethod: z.literal('click'),
    sourceSubject: z.string(),
    withdrawal: z.object({
        id: z.string().uuid(),
        withdrawnAt: z.string(),
        actorSubject: z.string(),
        reason: z.string(),
    }).nullable(),
});
const errorSchema = z.object({ error: z.string(), code: z.string().optional() });
export const metadata = {
    GET: { requireAuth: true, requireFeatures: ['marketing_consents.view'] },
};
function toIso(value: Date | string | null | undefined): string | null {
    if (value == null)
        return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
export async function GET(request: Request, context: {
    params: Promise<{
        id: string;
    }> | {
        id: string;
    };
}) {
    const auth = await getAuthFromRequest(request);
    if (!auth?.tenantId || !auth.sub) {
        return Response.json({ error: 'Authentication required', code: 'unauthorized' }, { status: 401 });
    }
    const params = await context.params;
    const id = idSchema.safeParse(params.id);
    if (!id.success)
        return Response.json({ error: 'Consent not found', code: 'not_found' }, { status: 404 });
    const container = await createRequestContainer();
    let organizationScope: Awaited<ReturnType<typeof resolveOrganizationScopeForRequest>>;
    try {
        organizationScope = await resolveOrganizationScopeForRequest({ container, auth, request });
    }
    catch {
        return Response.json({ error: 'Organization scope required', code: 'scope_required' }, { status: 403 });
    }
    const organizationId = organizationScope.selectedId;
    if (!organizationScope.tenantId || !organizationId) {
        return Response.json({ error: 'Organization scope required', code: 'scope_required' }, { status: 403 });
    }
    try {
        const em = container.resolve('em') as import("@mikro-orm/postgresql").EntityManager;
        const encryption = container.resolve('tenantEncryptionService');
        const record = await findOneWithDecryption(em, ConsentRecord, {
            id: id.data,
            tenantId: organizationScope.tenantId,
            organizationId,
        }, undefined, {
            tenantId: organizationScope.tenantId,
            organizationId,
            encryptionService: encryption as never,
        });
        if (!record)
            return Response.json({ error: 'Consent not found', code: 'not_found' }, { status: 404 });
        const withdrawal = await findOneWithDecryption(em, WithdrawalEvidence, {
            consentRecordId: id.data,
            tenantId: organizationScope.tenantId,
            organizationId,
        }, undefined, {
            tenantId: organizationScope.tenantId,
            organizationId,
            encryptionService: encryption as never,
        });
        return Response.json({
            id: String(record.id),
            email: record.email,
            firstName: record.firstName ?? null,
            lastName: record.lastName ?? null,
            consentCode: record.consentCode,
            consentName: record.consentName,
            grantedAt: toIso(record.grantedAt),
            status: record.status,
            withdrawnAt: toIso(record.withdrawnAt),
            updatedAt: toIso(record.updatedAt),
            userIp: record.userIp,
            consentText: record.consentText,
            consentUrl: record.consentUrl ?? null,
            contentSha256: record.contentSha256.trim(),
            receivedAt: toIso(record.receivedAt),
            confirmationMethod: 'click',
            sourceSubject: record.sourceSubject,
            withdrawal: withdrawal ? {
                id: String(withdrawal.id),
                withdrawnAt: toIso(withdrawal.withdrawnAt),
                actorSubject: withdrawal.actorSubject,
                reason: withdrawal.reason,
            } : null,
        });
    }
    catch {
        return Response.json({ error: 'Consent record could not be read', code: 'internal_error' }, { status: 500 });
    }
}
const getDoc: OpenApiMethodDoc = {
    summary: 'Read a complete consent proof',
    tags: [marketingConsentsTag],
    responses: [{ status: 200, description: 'The scoped consent proof.', schema: itemSchema }],
    errors: [
        { status: 401, description: 'Authentication required.', schema: errorSchema },
        { status: 403, description: 'View feature or organization scope is missing.', schema: errorSchema },
        { status: 404, description: 'No record exists in this organization.', schema: errorSchema },
        { status: 500, description: 'Decryption or another internal service failed.', schema: errorSchema },
    ],
};
export const openApi: OpenApiRouteDoc = {
    tag: marketingConsentsTag,
    summary: 'Marketing consent detail',
    pathParams: z.object({ id: idSchema }),
    methods: { GET: getDoc },
};
