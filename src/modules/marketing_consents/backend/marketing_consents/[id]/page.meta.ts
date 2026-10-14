import type { PageMetadata } from "@open-mercato/shared/modules/registry";
export const metadata: PageMetadata = {
    requireAuth: true,
    requireFeatures: ['marketing_consents.view'],
    pageTitle: 'Consent details',
    pageTitleKey: 'marketing_consents.detail.title',
    pageGroup: 'Marketing',
    pageGroupKey: 'marketing_consents.nav.group',
    pagePriority: 40,
    pageOrder: 31,
    navHidden: true,
    breadcrumb: [
        { label: 'Consent register', labelKey: 'marketing_consents.nav.register', href: '/backend/marketing_consents' },
        { label: 'Consent details', labelKey: 'marketing_consents.detail.title' },
    ],
};
