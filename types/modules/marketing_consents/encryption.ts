import type { ModuleEncryptionMap } from "@open-mercato/shared/modules/encryption";
export const defaultEncryptionMaps: ModuleEncryptionMap[] = [
    {
        entityId: 'marketing_consents:consent_record',
        fields: [
            { field: 'email' },
            { field: 'first_name' },
            { field: 'last_name' },
            { field: 'user_ip' },
            { field: 'consent_text' },
        ],
    },
    {
        entityId: 'marketing_consents:withdrawal_evidence',
        fields: [{ field: 'reason' }],
    },
];
export default defaultEncryptionMaps;
