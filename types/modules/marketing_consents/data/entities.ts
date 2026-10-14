import { Entity, Index, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
export const CONSENT_STATUSES = ['granted', 'withdrawn'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];
@Entity({ tableName: 'marketing_consent_records' })
@Unique({
    name: 'marketing_consent_records_event_scope_uq',
    properties: ['tenantId', 'organizationId', 'sourceSubject', 'eventId'],
})
@Index({
    name: 'marketing_consent_records_scope_granted_idx',
    properties: ['tenantId', 'organizationId', 'grantedAt', 'id'],
})
@Index({
    name: 'marketing_consent_records_scope_code_status_idx',
    properties: ['tenantId', 'organizationId', 'consentCode', 'status', 'grantedAt'],
})
@Index({
    name: 'marketing_consent_records_scope_withdrawn_idx',
    properties: ['tenantId', 'organizationId', 'withdrawnAt'],
})
export class ConsentRecord {
    @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
    id!: string;
    @Property({ name: 'tenant_id', type: 'uuid' })
    tenantId!: string;
    @Property({ name: 'organization_id', type: 'uuid' })
    organizationId!: string;
    @Property({ type: 'text' })
    email!: string;
    @Property({ name: 'first_name', type: 'text', nullable: true })
    firstName?: string | null;
    @Property({ name: 'last_name', type: 'text', nullable: true })
    lastName?: string | null;
    @Property({ name: 'user_ip', type: 'text' })
    userIp!: string;
    @Property({ name: 'consent_code', type: 'text' })
    consentCode!: string;
    @Property({ name: 'consent_name', type: 'text' })
    consentName!: string;
    @Property({ name: 'consent_text', type: 'text' })
    consentText!: string;
    @Property({ name: 'consent_url', type: 'text', nullable: true })
    consentUrl?: string | null;
    @Property({
        name: 'content_sha256',
        type: 'string',
        columnType: 'char(64)',
    })
    contentSha256!: string;
    @Property({ name: 'granted_at', type: Date })
    grantedAt!: Date;
    @Property({ name: 'received_at', type: Date, onCreate: () => new Date() })
    receivedAt: Date = new Date();
    @Property({ name: 'confirmation_method', type: 'text', default: 'click' })
    confirmationMethod: 'click' = 'click';
    @Property({ name: 'event_id', type: 'uuid' })
    eventId!: string;
    /** Authenticated backend principal; never an asserted recipient identity. */
    @Property({ name: 'source_subject', type: 'text' })
    sourceSubject!: string;
    @Property({ type: 'text', default: 'granted' })
    status: ConsentStatus = 'granted';
    @Property({ name: 'withdrawn_at', type: Date, nullable: true })
    withdrawnAt?: Date | null;
    @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
    createdAt: Date = new Date();
    @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
    updatedAt: Date = new Date();
}
@Entity({ tableName: 'marketing_consent_withdrawal_evidence' })
@Unique({
    name: 'marketing_consent_withdrawal_record_scope_uq',
    properties: ['tenantId', 'organizationId', 'consentRecordId'],
})
@Index({
    name: 'marketing_consent_withdrawal_scope_time_idx',
    properties: ['tenantId', 'organizationId', 'withdrawnAt', 'consentRecordId'],
})
export class WithdrawalEvidence {
    @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
    id!: string;
    @Property({ name: 'tenant_id', type: 'uuid' })
    tenantId!: string;
    @Property({ name: 'organization_id', type: 'uuid' })
    organizationId!: string;
    /** Scalar same-module link keeps the withdrawal proof independently auditable. */
    @Property({ name: 'consent_record_id', type: 'uuid' })
    consentRecordId!: string;
    @Property({ name: 'withdrawn_at', type: Date, onCreate: () => new Date() })
    withdrawnAt: Date = new Date();
    @Property({ name: 'actor_subject', type: 'text' })
    actorSubject!: string;
    @Property({ type: 'text' })
    reason!: string;
    @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
    createdAt: Date = new Date();
}
