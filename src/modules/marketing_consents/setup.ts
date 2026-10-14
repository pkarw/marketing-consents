import type { ModuleSetupConfig } from "@open-mercato/shared/modules/setup";
export const setup: ModuleSetupConfig = {
    defaultRoleFeatures: {
        superadmin: ['marketing_consents.*'],
        admin: ['marketing_consents.view', 'marketing_consents.withdraw'],
        employee: ['marketing_consents.view'],
    },
};
export default setup;
