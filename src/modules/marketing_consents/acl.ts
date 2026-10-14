export const features = [
    { id: 'marketing_consents.record', title: 'Record marketing consent', module: 'marketing_consents' },
    { id: 'marketing_consents.view', title: 'View marketing consent records', module: 'marketing_consents' },
    {
        id: 'marketing_consents.withdraw',
        title: 'Withdraw marketing consent',
        module: 'marketing_consents',
        dependsOn: ['marketing_consents.view'],
    },
];
export default features;
