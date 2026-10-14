import type { PageMetadata } from "@open-mercato/shared/modules/registry";
export const metadata: PageMetadata = {
    requireAuth: true,
    requireFeatures: ['marketing_consents.view'],
    pageTitle: 'Consent register',
    pageTitleKey: 'marketing_consents.nav.register',
    pageGroup: 'Marketing',
    pageGroupKey: 'marketing_consents.nav.group',
    pagePriority: 40,
    pageOrder: 30,
    icon: 'file-check',
    breadcrumb: [
        { label: 'Consent register', labelKey: 'marketing_consents.nav.register' },
    ],
};
