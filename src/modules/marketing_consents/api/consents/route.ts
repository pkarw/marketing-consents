import { z } from "zod";
import { createLogger } from "@open-mercato/shared/lib/logger";
import type { EntityManager } from "@mikro-orm/postgresql";
import { getAuthFromRequest } from "@open-mercato/shared/lib/auth/server";
import { createRequestContainer } from "@open-mercato/shared/lib/di/container";
import { CommandBus, type CommandRuntimeContext } from "@open-mercato/shared/lib/commands";
import { makeCrudRoute, type CrudCtx } from "@open-mercato/shared/lib/crud/factory";
import { CrudHttpError } from "@open-mercato/shared/lib/crud/errors";
import { findOneWithDecryption } from "@open-mercato/shared/lib/encryption/find";
import { resolveOrganizationScopeForRequest } from "@open-mercato/core/modules/directory/utils/organizationScope";
import type { OpenApiMethodDoc, OpenApiRouteDoc } from "@open-mercato/shared/lib/openapi";
import { ConsentRecord } from "../../data/entities";
import { consentListSchema, recordConsentSchema, type ConsentListQuery, type RecordConsentInput } from "../../data/validators";
import { ConsentCommandError, type RecordConsentCommandResult } from "../../commands/consents";
import { marketingConsentsTag } from "../openapi";
const ENTITY_ID = 'marketing_consents:consent_record';
const logger = createLogger('marketing_consents').child({ component: 'api' });
const listItemSchema = z.object({
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
});
const listResponseSchema = z.object({
    items: z.array(listItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
});
const withdrawalSchema = z.object({
    id: z.string().uuid(),
    withdrawnAt: z.string(),
    actorSubject: z.string(),
    reason: z.string(),
});
const detailSchema = listItemSchema.extend({
    userIp: z.string(),
    consentText: z.string(),
    consentUrl: z.string().nullable(),
    contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
    receivedAt: z.string(),
    confirmationMethod: z.literal('click'),
    sourceSubject: z.string(),
    withdrawal: withdrawalSchema.nullable(),
});
const createdSchema = z.object({
    consent: detailSchema,
    replayed: z.boolean(),
});
const errorSchema = z.object({ error: z.string(), code: z.string().optional() });
function iso(value: Date | string | null | undefined): string | null {
    if (value == null)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function mapListItem(item: ConsentRecord | Record<string, unknown>) {
    const row = item as unknown as Record<string, unknown>;
    const field = (camel: string, snake: string) => row[camel] ?? row[snake];
    return {
        id: String(row.id),
        email: String(row.email ?? ''),
        firstName: (field('firstName', 'first_name') as string | null | undefined) ?? null,
        lastName: (field('lastName', 'last_name') as string | null | undefined) ?? null,
        consentCode: String(field('consentCode', 'consent_code') ?? ''),
        consentName: String(field('consentName', 'consent_name') ?? ''),
        grantedAt: iso(field('grantedAt', 'granted_at') as Date | string)!,
        status: String(row.status) as ConsentRecord['status'],
        withdrawnAt: iso(field('withdrawnAt', 'withdrawn_at') as Date | string | null | undefined),
        updatedAt: iso(field('updatedAt', 'updated_at') as Date | string)!,
    };
}
function mapDetail(item: ConsentRecord) {
    return {
        ...mapListItem(item),
        userIp: item.userIp,
        consentText: item.consentText,
        consentUrl: item.consentUrl ?? null,
        contentSha256: item.contentSha256.trim(),
        receivedAt: iso(item.receivedAt)!,
        confirmationMethod: 'click' as const,
        sourceSubject: item.sourceSubject,
        withdrawal: null,
    };
}
function queryFilters(query: ConsentListQuery) {
    const filters: Record<string, unknown> = {};
    if (query.code)
        filters.consent_code = query.code;
    if (query.status)
        filters.status = query.status;
    if (query.grantedFrom || query.grantedTo) {
        filters.granted_at = {
            ...(query.grantedFrom ? { $gte: new Date(query.grantedFrom) } : {}),
            ...(query.grantedTo ? { $lt: new Date(query.grantedTo) } : {}),
        };
    }
    if (query.withdrawnFrom || query.withdrawnTo) {
        filters.withdrawn_at = {
            ...(query.withdrawnFrom ? { $gte: new Date(query.withdrawnFrom) } : {}),
            ...(query.withdrawnTo ? { $lt: new Date(query.withdrawnTo) } : {}),
        };
    }
    return filters;
}
const crudList = makeCrudRoute<never, never, ConsentListQuery>({
    metadata: { GET: { requireAuth: true, requireFeatures: ['marketing_consents.view'] } },
    orm: {
        entity: ConsentRecord,
        idField: 'id',
        orgField: 'organizationId',
        tenantField: 'tenantId',
        softDeleteField: null,
    },
    list: {
        schema: consentListSchema,
        entityId: ENTITY_ID,
        fields: [
            'id', 'tenant_id', 'organization_id', 'email', 'first_name', 'last_name',
            'consent_code', 'consent_name', 'granted_at', 'status', 'withdrawn_at', 'updated_at',
        ],
        sortFieldMap: {
            grantedAt: 'granted_at',
            withdrawnAt: 'withdrawn_at',
            status: 'status',
            consentCode: 'consent_code',
        },
        defaultSort: { field: 'grantedAt', dir: 'desc' },
        tiebreakSortField: 'id',
        buildFilters: (query) => queryFilters(query) as never,
        transformItem: (item: ConsentRecord) => mapListItem(item),
    },
    hooks: {
        beforeList: (_query: ConsentListQuery, ctx: CrudCtx) => {
            if (!ctx.auth?.tenantId || !ctx.selectedOrganizationId) {
                throw new CrudHttpError(403, { error: 'Organization scope required', code: 'scope_required' });
            }
        },
    },
});
export const metadata = {
    GET: crudList.metadata.GET,
    POST: { requireAuth: true, requireFeatures: ['marketing_consents.record'] },
};
export const GET = crudList.GET;
function safeCommandError(error: unknown): Response | null {
    if (error instanceof ConsentCommandError) {
        return Response.json({ error: 'Consent request could not be completed', code: error.code }, { status: error.status });
    }
    return null;
}
export async function POST(request: Request) {
    const auth = await getAuthFromRequest(request);
    if (!auth?.tenantId || !auth.sub) {
        return Response.json({ error: 'Authentication required', code: 'unauthorized' }, { status: 401 });
    }
    let body: unknown;
    try {
        body = await request.json();
    }
    catch {
        return Response.json({ error: 'Invalid request body', code: 'invalid_input' }, { status: 400 });
    }
    const parsed = recordConsentSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: 'Invalid consent data', code: 'invalid_input' }, { status: 400 });
    }
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
    const trustedAuth = { ...auth, tenantId: organizationScope.tenantId, orgId: organizationId };
    const ctx: CommandRuntimeContext = {
        container,
        auth: trustedAuth,
        organizationScope,
        selectedOrganizationId: organizationId,
        organizationIds: [organizationId],
        request,
    };
    try {
        const commandBus = container.resolve('commandBus') as CommandBus;
        const { result } = await commandBus.execute<RecordConsentInput, RecordConsentCommandResult>('marketing_consents.consents.record', {
            input: parsed.data,
            ctx,
            metadata: {
                tenantId: organizationScope.tenantId,
                organizationId,
                actionLabel: 'Consent recorded',
                replayable: false,
                resourceKind: 'marketing_consents.consent_record',
            },
        });
        const em = container.resolve('em') as EntityManager;
        const encryption = container.resolve('tenantEncryptionService');
        const consent = await findOneWithDecryption(em, ConsentRecord, {
            id: result.id,
            tenantId: organizationScope.tenantId,
            organizationId,
        }, undefined, {
            tenantId: organizationScope.tenantId,
            organizationId,
            encryptionService: encryption as never,
        });
        if (!consent)
            return Response.json({ error: 'Consent record unavailable', code: 'internal_error' }, { status: 500 });
        return Response.json({ consent: mapDetail(consent), replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
    }
    catch (error) {
        const response = safeCommandError(error);
        if (response)
            return response;
        const diagnostic = error && typeof error === 'object'
            ? error as {
                name?: unknown;
                code?: unknown;
                constraint?: unknown;
                cause?: {
                    code?: unknown;
                    constraint?: unknown;
                };
            }
            : {};
        const safeToken = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value) ? value : undefined;
        logger.error('Consent record command failed', {
            errorName: safeToken(diagnostic.name),
            errorCode: safeToken(diagnostic.code ?? diagnostic.cause?.code),
            constraint: safeToken(diagnostic.constraint ?? diagnostic.cause?.constraint),
        });
        return Response.json({ error: 'Consent request could not be completed', code: 'internal_error' }, { status: 500 });
    }
}
const getDoc: OpenApiMethodDoc = {
    summary: 'List consent records in the active organization',
    tags: [marketingConsentsTag],
    responses: [{ status: 200, description: 'Scoped consent page.', schema: listResponseSchema }],
    errors: [
        { status: 400, description: 'Invalid filters.', schema: errorSchema },
        { status: 401, description: 'Authentication required.', schema: errorSchema },
        { status: 403, description: 'View feature or organization scope is missing.', schema: errorSchema },
    ],
};
const postDoc: OpenApiMethodDoc = {
    summary: 'Record an immutable marketing consent proof',
    description: 'Server-to-server endpoint. Tenant, organization and source subject come from the authenticated principal, never the request body.',
    tags: [marketingConsentsTag],
    requestBody: { schema: recordConsentSchema },
    responses: [
        { status: 201, description: 'New proof recorded.', schema: createdSchema },
        { status: 200, description: 'Idempotent retry returned the original proof.', schema: createdSchema },
    ],
    errors: [
        { status: 400, description: 'Invalid input or supplied hash mismatch.', schema: errorSchema },
        { status: 401, description: 'Authentication required.', schema: errorSchema },
        { status: 403, description: 'Record feature or organization scope is unavailable.', schema: errorSchema },
        { status: 409, description: 'The event id was already used with different consent data.', schema: errorSchema },
        { status: 500, description: 'Encryption or another internal service failed.', schema: errorSchema },
    ],
};
export const openApi: OpenApiRouteDoc = {
    tag: marketingConsentsTag,
    summary: 'Marketing consent records',
    methods: { GET: getDoc, POST: postDoc },
};
