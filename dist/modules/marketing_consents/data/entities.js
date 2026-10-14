var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c, _d, _e, _f, _g, _h;
import { Entity, Index, PrimaryKey, Property, Unique } from "@mikro-orm/decorators/legacy";
export const CONSENT_STATUSES = ['granted', 'withdrawn'];
let ConsentRecord = class ConsentRecord {
    constructor() {
        this.receivedAt = new Date();
        this.confirmationMethod = 'click';
        this.status = 'granted';
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }
};
__decorate([
    PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "id", void 0);
__decorate([
    Property({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "tenantId", void 0);
__decorate([
    Property({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "organizationId", void 0);
__decorate([
    Property({ type: 'text' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "email", void 0);
__decorate([
    Property({ name: 'first_name', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ConsentRecord.prototype, "firstName", void 0);
__decorate([
    Property({ name: 'last_name', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ConsentRecord.prototype, "lastName", void 0);
__decorate([
    Property({ name: 'user_ip', type: 'text' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "userIp", void 0);
__decorate([
    Property({ name: 'consent_code', type: 'text' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "consentCode", void 0);
__decorate([
    Property({ name: 'consent_name', type: 'text' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "consentName", void 0);
__decorate([
    Property({ name: 'consent_text', type: 'text' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "consentText", void 0);
__decorate([
    Property({ name: 'consent_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ConsentRecord.prototype, "consentUrl", void 0);
__decorate([
    Property({
        name: 'content_sha256',
        type: 'string',
        columnType: 'char(64)',
    }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "contentSha256", void 0);
__decorate([
    Property({ name: 'granted_at', type: Date }),
    __metadata("design:type", typeof (_a = typeof Date !== "undefined" && Date) === "function" ? _a : Object)
], ConsentRecord.prototype, "grantedAt", void 0);
__decorate([
    Property({ name: 'received_at', type: Date, onCreate: () => new Date() }),
    __metadata("design:type", typeof (_b = typeof Date !== "undefined" && Date) === "function" ? _b : Object)
], ConsentRecord.prototype, "receivedAt", void 0);
__decorate([
    Property({ name: 'confirmation_method', type: 'text', default: 'click' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "confirmationMethod", void 0);
__decorate([
    Property({ name: 'event_id', type: 'uuid' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "eventId", void 0);
__decorate([
    Property({ name: 'source_subject', type: 'text' }),
    __metadata("design:type", String)
], ConsentRecord.prototype, "sourceSubject", void 0);
__decorate([
    Property({ type: 'text', default: 'granted' }),
    __metadata("design:type", typeof (_c = typeof ConsentStatus !== "undefined" && ConsentStatus) === "function" ? _c : Object)
], ConsentRecord.prototype, "status", void 0);
__decorate([
    Property({ name: 'withdrawn_at', type: Date, nullable: true }),
    __metadata("design:type", Object)
], ConsentRecord.prototype, "withdrawnAt", void 0);
__decorate([
    Property({ name: 'created_at', type: Date, onCreate: () => new Date() }),
    __metadata("design:type", typeof (_e = typeof Date !== "undefined" && Date) === "function" ? _e : Object)
], ConsentRecord.prototype, "createdAt", void 0);
__decorate([
    Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() }),
    __metadata("design:type", typeof (_f = typeof Date !== "undefined" && Date) === "function" ? _f : Object)
], ConsentRecord.prototype, "updatedAt", void 0);
ConsentRecord = __decorate([
    Entity({ tableName: 'marketing_consent_records' }),
    Unique({
        name: 'marketing_consent_records_event_scope_uq',
        properties: ['tenantId', 'organizationId', 'sourceSubject', 'eventId'],
    }),
    Index({
        name: 'marketing_consent_records_scope_granted_idx',
        properties: ['tenantId', 'organizationId', 'grantedAt', 'id'],
    }),
    Index({
        name: 'marketing_consent_records_scope_code_status_idx',
        properties: ['tenantId', 'organizationId', 'consentCode', 'status', 'grantedAt'],
    }),
    Index({
        name: 'marketing_consent_records_scope_withdrawn_idx',
        properties: ['tenantId', 'organizationId', 'withdrawnAt'],
    })
], ConsentRecord);
export { ConsentRecord };
let WithdrawalEvidence = class WithdrawalEvidence {
    constructor() {
        this.withdrawnAt = new Date();
        this.createdAt = new Date();
    }
};
__decorate([
    PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' }),
    __metadata("design:type", String)
], WithdrawalEvidence.prototype, "id", void 0);
__decorate([
    Property({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], WithdrawalEvidence.prototype, "tenantId", void 0);
__decorate([
    Property({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], WithdrawalEvidence.prototype, "organizationId", void 0);
__decorate([
    Property({ name: 'consent_record_id', type: 'uuid' }),
    __metadata("design:type", String)
], WithdrawalEvidence.prototype, "consentRecordId", void 0);
__decorate([
    Property({ name: 'withdrawn_at', type: Date, onCreate: () => new Date() }),
    __metadata("design:type", typeof (_g = typeof Date !== "undefined" && Date) === "function" ? _g : Object)
], WithdrawalEvidence.prototype, "withdrawnAt", void 0);
__decorate([
    Property({ name: 'actor_subject', type: 'text' }),
    __metadata("design:type", String)
], WithdrawalEvidence.prototype, "actorSubject", void 0);
__decorate([
    Property({ type: 'text' }),
    __metadata("design:type", String)
], WithdrawalEvidence.prototype, "reason", void 0);
__decorate([
    Property({ name: 'created_at', type: Date, onCreate: () => new Date() }),
    __metadata("design:type", typeof (_h = typeof Date !== "undefined" && Date) === "function" ? _h : Object)
], WithdrawalEvidence.prototype, "createdAt", void 0);
WithdrawalEvidence = __decorate([
    Entity({ tableName: 'marketing_consent_withdrawal_evidence' }),
    Unique({
        name: 'marketing_consent_withdrawal_record_scope_uq',
        properties: ['tenantId', 'organizationId', 'consentRecordId'],
    }),
    Index({
        name: 'marketing_consent_withdrawal_scope_time_idx',
        properties: ['tenantId', 'organizationId', 'withdrawnAt', 'consentRecordId'],
    })
], WithdrawalEvidence);
export { WithdrawalEvidence };
