import { Migration } from "@mikro-orm/migrations";
import { buildEncryptionMapBackfillSql } from "@open-mercato/shared/lib/encryption/migration-backfill";
export class Migration20261012142842_marketing_consents extends Migration {
    constructor() {
        super(...arguments);
        this.name = 'Migration20261012142842';
    }
    up() {
        this.addSql(`create table "marketing_consent_records" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "email" text not null, "first_name" text null, "last_name" text null, "user_ip" text not null, "consent_code" text not null, "consent_name" text not null, "consent_text" text not null, "consent_url" text null, "content_sha256" char(64) not null, "granted_at" timestamptz not null, "received_at" timestamptz not null, "confirmation_method" text not null default 'click', "event_id" uuid not null, "source_subject" text not null, "status" text not null default 'granted', "withdrawn_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
        this.addSql(`create index "marketing_consent_records_scope_withdrawn_idx" on "marketing_consent_records" ("tenant_id", "organization_id", "withdrawn_at");`);
        this.addSql(`create index "marketing_consent_records_scope_code_status_idx" on "marketing_consent_records" ("tenant_id", "organization_id", "consent_code", "status", "granted_at");`);
        this.addSql(`create index "marketing_consent_records_scope_granted_idx" on "marketing_consent_records" ("tenant_id", "organization_id", "granted_at", "id");`);
        this.addSql(`alter table "marketing_consent_records" add constraint "marketing_consent_records_event_scope_uq" unique ("tenant_id", "organization_id", "source_subject", "event_id");`);
        this.addSql(`create table "marketing_consent_withdrawal_evidence" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "consent_record_id" uuid not null, "withdrawn_at" timestamptz not null, "actor_subject" text not null, "reason" text not null, "created_at" timestamptz not null, primary key ("id"));`);
        this.addSql(`create index "marketing_consent_withdrawal_scope_time_idx" on "marketing_consent_withdrawal_evidence" ("tenant_id", "organization_id", "withdrawn_at", "consent_record_id");`);
        this.addSql(`alter table "marketing_consent_withdrawal_evidence" add constraint "marketing_consent_withdrawal_record_scope_uq" unique ("tenant_id", "organization_id", "consent_record_id");`);
        this.addSql(buildEncryptionMapBackfillSql({
            entityId: 'marketing_consents:consent_record',
            fields: [
                { field: 'email' },
                { field: 'first_name' },
                { field: 'last_name' },
                { field: 'user_ip' },
                { field: 'consent_text' },
            ],
        }));
        this.addSql(buildEncryptionMapBackfillSql({
            entityId: 'marketing_consents:withdrawal_evidence',
            fields: [{ field: 'reason' }],
        }));
    }
}
