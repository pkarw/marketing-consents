import { z } from "zod";
import { getAuthFromRequest } from "@open-mercato/shared/lib/auth/server";
import { CommandBus, type CommandRuntimeContext } from "@open-mercato/shared/lib/commands";
import { createRequestContainer } from "@open-mercato/shared/lib/di/container";
import { runRouteMutationGuards } from "@open-mercato/shared/lib/crud/route-mutation-guard";
import { resolveOrganizationScopeForRequest } from "@open-mercato/core/modules/directory/utils/organizationScope";
import type { OpenApiMethodDoc, OpenApiRouteDoc } from "@open-mercato/shared/lib/openapi";
import { ConsentCommandError, type WithdrawConsentCommandResult } from "../../../../commands/consents";
import { withdrawConsentSchema } from "../../../../data/validators";
import { marketingConsentsTag } from "../../../openapi";
const idSchema = z.string().uuid();
const responseSchema = z.object({
    consentRecordId: z.string().uuid(),
    updatedAt: z.string(),
    withdrawal: z.object({
        id: z.string().uuid(),
        withdrawnAt: z.string(),
        actorSubject: z.string(),
        reason: z.string(),
    }),
    replayed: z.boolean(),
});
const errorSchema = z.object({ error: z.string(), code: z.string().optional() });
export const metadata = {
    POST: { requireAuth: true, requireFeatures: ['marketing_consents.view', 'marketing_consents.withdraw'] },
};
export async function POST(request: Request, context: {
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
    let body: unknown;
    try {
        body = await request.json();
    }
    catch {
        return Response.json({ error: 'Invalid withdrawal data', code: 'invalid_input' }, { status: 400 });
    }
    const parsed = withdrawConsentSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: 'Invalid withdrawal data', code: 'invalid_input' }, { status: 400 });
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
    const tenantId = organizationScope.tenantId;
    if (!tenantId || !organizationId) {
        return Response.json({ error: 'Organization scope required', code: 'scope_required' }, { status: 403 });
    }
    const guardResult = await runRouteMutationGuards({
        container,
        req: request,
        auth: { userId: auth.sub, tenantId, organizationId },
        input: {
            resourceKind: 'marketing_consents.consent_record',
            resourceId: id.data,
            operation: 'custom',
            // The withdrawal reason is encrypted evidence and is intentionally kept
            // out of mutation-guard contexts and post-commit callback metadata.
            mutationPayload: { updatedAt: parsed.data.updatedAt },
        },
    });
    if (!guardResult.ok)
        return guardResult.response;
    const finalInput = withdrawConsentSchema.safeParse({
        ...parsed.data,
        ...(guardResult.modifiedPayload ?? {}),
    });
    if (!finalInput.success) {
        return Response.json({ error: 'Invalid withdrawal data', code: 'invalid_input' }, { status: 400 });
    }
    const trustedAuth = { ...auth, tenantId, orgId: organizationId };
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
        const { result } = await commandBus.execute<{
            consentRecordId: string;
            updatedAt: string;
            reason: string;
        }, WithdrawConsentCommandResult>('marketing_consents.consents.withdraw', {
            input: { ...finalInput.data, consentRecordId: id.data },
            ctx,
            metadata: {
                tenantId,
                organizationId,
                actionLabel: 'Consent withdrawn',
                replayable: false,
                resourceKind: 'marketing_consents.consent_record',
                resourceId: id.data,
            },
        });
        if (!result.replayed)
            await guardResult.runAfterSuccess();
        return Response.json(result, { status: 200 });
    }
    catch (error) {
        if (error instanceof ConsentCommandError) {
            return Response.json({ error: 'Consent withdrawal could not be completed', code: error.code }, { status: error.status });
        }
        return Response.json({ error: 'Consent withdrawal could not be completed', code: 'internal_error' }, { status: 500 });
    }
}
const postDoc: OpenApiMethodDoc = {
    summary: 'Withdraw a granted consent while retaining its proof',
    description: 'Requires the consent record updatedAt version. The reason is encrypted; stale versions return 409 and never overwrite existing withdrawal evidence.',
    tags: [marketingConsentsTag],
    requestBody: { schema: withdrawConsentSchema },
    responses: [{ status: 200, description: 'The original withdrawal evidence; replayed indicates an idempotent retry.', schema: responseSchema }],
    errors: [
        { status: 400, description: 'Invalid withdrawal reason or version.', schema: errorSchema },
        { status: 401, description: 'Authentication required.', schema: errorSchema },
        { status: 403, description: 'Withdraw feature or organization scope is missing.', schema: errorSchema },
        { status: 404, description: 'No consent exists in the active organization.', schema: errorSchema },
        { status: 409, description: 'The consent changed since it was read.', schema: errorSchema },
        { status: 500, description: 'The withdrawal could not be committed.', schema: errorSchema },
    ],
};
export const openApi: OpenApiRouteDoc = {
    tag: marketingConsentsTag,
    summary: 'Withdraw consent',
    pathParams: z.object({ id: idSchema }),
    methods: { POST: postDoc },
};
