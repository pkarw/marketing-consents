import { createHash } from "node:crypto";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { CommandHandler, CommandRuntimeContext } from "@open-mercato/shared/lib/commands";
import { registerCommand } from "@open-mercato/shared/lib/commands";
import type { TenantDataEncryptionService } from "@open-mercato/shared/lib/encryption/tenantDataEncryptionService";
import { findOneWithDecryption } from "@open-mercato/shared/lib/encryption/find";
import { enforceCommandOptimisticLock } from "@open-mercato/shared/lib/crud/optimistic-lock-command";
import { ConsentRecord, WithdrawalEvidence } from "../data/entities.js";
import { recordConsentSchema, withdrawConsentCommandSchema, type RecordConsentInput, type WithdrawConsentCommandInput, } from "../data/validators.js";
const ENTITY_ID = 'marketing_consents:consent_record';
export class ConsentCommandError extends Error {
    constructor(readonly status: 400 | 403 | 404 | 409 | 500, readonly code: 'invalid_input' | 'scope_required' | 'hash_mismatch' | 'idempotency_conflict' | 'not_found' | 'optimistic_lock_conflict' | 'withdrawal_evidence_missing' | 'encryption_unavailable') {
        super(code);
        this.name = 'ConsentCommandError';
    }
}
export type RecordConsentCommandResult = {
    id: string;
    replayed: boolean;
};
function isUniqueConstraintViolation(error: unknown, constraint: string): boolean {
    let current = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
        const value = current as {
            code?: unknown;
            constraint?: unknown;
            cause?: unknown;
        };
        if (value.code === '23505' && value.constraint === constraint)
            return true;
        current = value.cause;
    }
    return false;
}
function scopeFromContext(ctx: CommandRuntimeContext) {
    const auth = ctx.auth;
    if (!auth?.tenantId || !auth.orgId || !auth.sub) {
        throw new ConsentCommandError(403, 'scope_required');
    }
    return {
        tenantId: String(auth.tenantId),
        organizationId: String(auth.orgId),
        sourceSubject: String(auth.sub),
    };
}
function normalizeInput(input: RecordConsentInput, now: Date) {
    const email = input.email.trim();
    const firstName = input.firstName?.trim() || null;
    const lastName = input.lastName?.trim() || null;
    const consentName = input.consentName.trim();
    const consentUrl = input.consentUrl?.trim() || null;
    const grantedAt = new Date(input.grantedAt);
    if (!Number.isFinite(grantedAt.getTime()) || grantedAt.getTime() > now.getTime() + 5 * 60000) {
        throw new ConsentCommandError(400, 'invalid_input');
    }
    const contentSha256 = createHash('sha256').update(Buffer.from(input.consentText, 'utf8')).digest('hex');
    if (input.contentSha256 && input.contentSha256 !== contentSha256) {
        throw new ConsentCommandError(400, 'hash_mismatch');
    }
    return {
        eventId: input.eventId,
        email,
        firstName,
        lastName,
        userIp: input.userIp,
        consentCode: input.consentCode,
        consentName,
        consentText: input.consentText,
        consentUrl,
        contentSha256,
        grantedAt,
        confirmationMethod: 'click' as const,
    };
}
function isSameRecord(existing: ConsentRecord, incoming: ReturnType<typeof normalizeInput>) {
    return existing.email === incoming.email
        && (existing.firstName ?? null) === incoming.firstName
        && (existing.lastName ?? null) === incoming.lastName
        && existing.userIp === incoming.userIp
        && existing.consentCode === incoming.consentCode
        && existing.consentName === incoming.consentName
        && existing.consentText === incoming.consentText
        && (existing.consentUrl ?? null) === incoming.consentUrl
        && existing.contentSha256.trim() === incoming.contentSha256
        && existing.grantedAt.getTime() === incoming.grantedAt.getTime()
        && existing.confirmationMethod === incoming.confirmationMethod;
}
function resolveEncryption(ctx: CommandRuntimeContext): TenantDataEncryptionService {
    try {
        const service = ctx.container.resolve('tenantEncryptionService') as TenantDataEncryptionService;
        if (!service || typeof service.encryptEntityPayload !== 'function')
            throw new Error('missing');
        return service;
    }
    catch {
        throw new ConsentCommandError(500, 'encryption_unavailable');
    }
}
async function recordConsent(inputRaw: unknown, ctx: CommandRuntimeContext): Promise<RecordConsentCommandResult> {
    const parsed = recordConsentSchema.safeParse(inputRaw);
    if (!parsed.success)
        throw new ConsentCommandError(400, 'invalid_input');
    const scope = scopeFromContext(ctx);
    const now = new Date();
    const input = normalizeInput(parsed.data, now);
    const em = ctx.container.resolve('em') as EntityManager;
    const encryption = resolveEncryption(ctx);
    const where = {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        sourceSubject: scope.sourceSubject,
        eventId: input.eventId,
    };
    try {
        return await em.transactional(async (tx) => {
            // Serializes only requests with the same trusted scope, authenticated source and event id.
            // The database unique constraint remains the final guard if another writer omits this command.
            const lockKey = JSON.stringify([scope.tenantId, scope.organizationId, scope.sourceSubject, input.eventId]);
            await tx.getConnection().execute('select pg_advisory_xact_lock(hashtextextended(?, 0))', [lockKey]);
            const existing = await findOneWithDecryption(tx, ConsentRecord, where, undefined, {
                tenantId: scope.tenantId,
                organizationId: scope.organizationId,
                encryptionService: encryption,
            });
            if (existing) {
                if (!isSameRecord(existing, input))
                    throw new ConsentCommandError(409, 'idempotency_conflict');
                return { id: String(existing.id), replayed: true };
            }
            const encrypted = await encryption.encryptEntityPayload(ENTITY_ID, {
                email: input.email,
                first_name: input.firstName,
                last_name: input.lastName,
                user_ip: input.userIp,
                consent_text: input.consentText,
            }, scope.tenantId, scope.organizationId);
            for (const [field, plaintext] of Object.entries({
                email: input.email,
                user_ip: input.userIp,
                consent_text: input.consentText,
            })) {
                if (typeof encrypted[field] !== 'string' || encrypted[field] === plaintext) {
                    throw new ConsentCommandError(500, 'encryption_unavailable');
                }
            }
            for (const [field, plaintext] of Object.entries({ first_name: input.firstName, last_name: input.lastName })) {
                if (plaintext !== null && (typeof encrypted[field] !== 'string' || encrypted[field] === plaintext)) {
                    throw new ConsentCommandError(500, 'encryption_unavailable');
                }
            }
            const entity = tx.create(ConsentRecord, {
                tenantId: scope.tenantId,
                organizationId: scope.organizationId,
                email: String(encrypted.email),
                firstName: encrypted.first_name as string | null,
                lastName: encrypted.last_name as string | null,
                userIp: String(encrypted.user_ip),
                consentCode: input.consentCode,
                consentName: input.consentName,
                consentText: String(encrypted.consent_text),
                consentUrl: input.consentUrl,
                contentSha256: input.contentSha256,
                grantedAt: input.grantedAt,
                receivedAt: now,
                confirmationMethod: 'click',
                eventId: input.eventId,
                sourceSubject: scope.sourceSubject,
                status: 'granted',
                withdrawnAt: null,
                createdAt: now,
                updatedAt: now,
            });
            await tx.flush();
            return { id: String(entity.id), replayed: false };
        });
    }
    catch (error) {
        // The scoped unique constraint is the final idempotency guard if a racing
        // request commits before the advisory lock becomes visible to its peer.
        if (!isUniqueConstraintViolation(error, 'marketing_consent_records_event_scope_uq'))
            throw error;
        const retryEm = em.fork();
        const existing = await findOneWithDecryption(retryEm, ConsentRecord, where, undefined, {
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
            encryptionService: encryption,
        });
        if (!existing)
            throw error;
        if (!isSameRecord(existing, input))
            throw new ConsentCommandError(409, 'idempotency_conflict');
        return { id: String(existing.id), replayed: true };
    }
}
export type WithdrawConsentCommandResult = {
    consentRecordId: string;
    updatedAt: string;
    withdrawal: {
        id: string;
        withdrawnAt: string;
        actorSubject: string;
        reason: string;
    };
    replayed: boolean;
};
function toIso(value: Date): string {
    return value.toISOString();
}
async function withdrawConsent(inputRaw: unknown, ctx: CommandRuntimeContext): Promise<WithdrawConsentCommandResult> {
    const parsed = withdrawConsentCommandSchema.safeParse(inputRaw);
    if (!parsed.success)
        throw new ConsentCommandError(400, 'invalid_input');
    const scope = scopeFromContext(ctx);
    const organizationId = ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId;
    if (!organizationId)
        throw new ConsentCommandError(403, 'scope_required');
    const encryption = resolveEncryption(ctx);
    const em = ctx.container.resolve<EntityManager>('em').fork();
    const expectedUpdatedAt = new Date(parsed.data.updatedAt);
    const consentRecordId = parsed.data.consentRecordId;
    try {
        return await em.transactional(async (tx) => {
            const lockKey = JSON.stringify([scope.tenantId, organizationId, consentRecordId]);
            await tx.getConnection().execute('select pg_advisory_xact_lock(hashtextextended(?, 0))', [lockKey]);
            const record = await findOneWithDecryption(tx, ConsentRecord, {
                id: consentRecordId,
                tenantId: scope.tenantId,
                organizationId,
            }, undefined, {
                tenantId: scope.tenantId,
                organizationId,
                encryptionService: encryption,
            });
            if (!record)
                throw new ConsentCommandError(404, 'not_found');
            if (record.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
                throw new ConsentCommandError(409, 'optimistic_lock_conflict');
            }
            enforceCommandOptimisticLock({
                resourceKind: 'marketing_consents.consent_record',
                resourceId: consentRecordId,
                current: record.updatedAt,
                expected: expectedUpdatedAt,
                request: ctx.request,
            });
            const evidenceWhere = { consentRecordId, tenantId: scope.tenantId, organizationId };
            const existingEvidence = await findOneWithDecryption(tx, WithdrawalEvidence, evidenceWhere, undefined, {
                tenantId: scope.tenantId,
                organizationId,
                encryptionService: encryption,
            });
            if (record.status === 'withdrawn') {
                if (!existingEvidence)
                    throw new ConsentCommandError(500, 'withdrawal_evidence_missing');
                return {
                    consentRecordId,
                    updatedAt: toIso(record.updatedAt),
                    withdrawal: {
                        id: String(existingEvidence.id),
                        withdrawnAt: toIso(existingEvidence.withdrawnAt),
                        actorSubject: existingEvidence.actorSubject,
                        reason: existingEvidence.reason,
                    },
                    replayed: true,
                };
            }
            if (existingEvidence)
                throw new ConsentCommandError(500, 'withdrawal_evidence_missing');
            const now = new Date();
            const reason = parsed.data.reason.trim();
            let encryptedReason: unknown;
            try {
                const encrypted = await encryption.encryptEntityPayload('marketing_consents:withdrawal_evidence', {
                    reason,
                }, scope.tenantId, organizationId);
                encryptedReason = encrypted.reason;
            }
            catch {
                throw new ConsentCommandError(500, 'encryption_unavailable');
            }
            if (typeof encryptedReason !== 'string' || encryptedReason === reason) {
                throw new ConsentCommandError(500, 'encryption_unavailable');
            }
            const evidence = tx.create(WithdrawalEvidence, {
                tenantId: scope.tenantId,
                organizationId,
                consentRecordId,
                withdrawnAt: now,
                actorSubject: scope.sourceSubject,
                reason: encryptedReason,
                createdAt: now,
            });
            record.status = 'withdrawn';
            record.withdrawnAt = now;
            record.updatedAt = new Date(Math.max(now.getTime(), record.updatedAt.getTime() + 1));
            tx.persist(evidence);
            tx.persist(record);
            await tx.flush();
            return {
                consentRecordId,
                updatedAt: toIso(record.updatedAt),
                withdrawal: {
                    id: String(evidence.id),
                    withdrawnAt: toIso(now),
                    actorSubject: scope.sourceSubject,
                    reason,
                },
                replayed: false,
            };
        });
    }
    catch (error) {
        if (isUniqueConstraintViolation(error, 'marketing_consent_withdrawal_record_scope_uq')) {
            throw new ConsentCommandError(409, 'optimistic_lock_conflict');
        }
        throw error;
    }
}
const recordConsentCommand: CommandHandler<RecordConsentInput, RecordConsentCommandResult> = {
    id: 'marketing_consents.consents.record',
    isUndoable: false,
    async execute(input, ctx) {
        return recordConsent(input, ctx);
    },
    buildLog({ result }) {
        return {
            replayable: false,
            resourceKind: 'marketing_consents.consent_record',
            resourceId: result.id,
            actionLabel: result.replayed ? 'Consent retry accepted' : 'Consent recorded',
        };
    },
};
registerCommand(recordConsentCommand);
const withdrawConsentCommand: CommandHandler<WithdrawConsentCommandInput, WithdrawConsentCommandResult> = {
    id: 'marketing_consents.consents.withdraw',
    isUndoable: false,
    async execute(input, ctx) {
        return withdrawConsent(input, ctx);
    },
    buildLog({ result }) {
        return {
            replayable: false,
            resourceKind: 'marketing_consents.consent_record',
            resourceId: result.consentRecordId,
            actionLabel: result.replayed ? 'Consent withdrawal retry accepted' : 'Consent withdrawn',
        };
    },
};
registerCommand(withdrawConsentCommand);
export const __consentCommandTestHooks = { normalizeInput, isSameRecord };
