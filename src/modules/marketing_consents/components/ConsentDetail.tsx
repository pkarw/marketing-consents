"use client";
import * as React from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "@open-mercato/shared/lib/i18n/context";
import { readApiResultOrThrow } from "@open-mercato/ui/backend/utils/apiCall";
import { useGuardedMutation } from "@open-mercato/ui/backend/injection/useGuardedMutation";
import { useDialogKeyHandler } from "@open-mercato/ui/hooks/useDialogKeyHandler";
import { FormHeader } from "@open-mercato/ui/backend/forms/FormHeader";
import { CrudForm, type CrudField } from "@open-mercato/ui/backend/CrudForm";
import { AccessDeniedMessage, DetailFieldsSection, ErrorMessage, LoadingMessage, RecordNotFoundState, type DetailFieldConfig, } from "@open-mercato/ui/backend/detail";
import { flash } from "@open-mercato/ui/backend/FlashMessages";
import { Alert } from "@open-mercato/ui/primitives/alert";
import { Button } from "@open-mercato/ui/primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@open-mercato/ui/primitives/dialog";
import { StatusBadge } from "@open-mercato/ui/primitives/status-badge";
type Withdrawal = {
    id: string;
    withdrawnAt: string;
    actorSubject: string;
    reason: string;
};
type ConsentDetailResponse = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    consentCode: string;
    consentName: string;
    grantedAt: string;
    status: 'granted' | 'withdrawn';
    withdrawnAt: string | null;
    updatedAt: string;
    userIp: string;
    consentText: string;
    consentUrl: string | null;
    contentSha256: string;
    receivedAt: string;
    confirmationMethod: 'click';
    sourceSubject: string;
    withdrawal: Withdrawal | null;
};
type WithdrawalResponse = {
    consentRecordId: string;
    updatedAt: string;
    withdrawal: Withdrawal;
    replayed: boolean;
};
type WithdrawalFormValues = {
    reason: string;
};
type MutationContext = {
    resourceType: string;
    resourceId: string | null;
};
function formatTimestamp(value: string, empty: string): string {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
        : empty;
}
function detailField(key: string, label: string, value: React.ReactNode, gridClassName?: string): DetailFieldConfig {
    return {
        kind: 'custom',
        key,
        label,
        emptyLabel: '—',
        gridClassName,
        render: () => (<div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="min-w-0 break-words text-sm text-muted-foreground">{value ?? '—'}</div>
      </div>),
    };
}
function errorStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object')
        return null;
    const status = (error as {
        status?: unknown;
    }).status;
    return typeof status === 'number' ? status : null;
}
export default function ConsentDetail({ id }: {
    id: string;
}) {
    const t = useT();
    const queryClient = useQueryClient();
    const [withdrawOpen, setWithdrawOpen] = React.useState(false);
    const dialogContentRef = React.useRef<HTMLDivElement>(null);
    const { runMutation } = useGuardedMutation<MutationContext>({ contextId: 'marketing-consents.withdraw' });
    const { data: record, error, isLoading, refetch, } = useQuery<ConsentDetailResponse>({
        queryKey: ['marketing-consent', id],
        queryFn: async () => readApiResultOrThrow<ConsentDetailResponse>(`/api/marketing_consents/consents/${encodeURIComponent(id)}`, undefined, { errorMessage: t('marketing_consents.detail.loadError') }),
    });
    const withdrawalSchema = React.useMemo(() => z.object({
        reason: z.string()
            .trim()
            .min(1, t('marketing_consents.withdraw.validation.required'))
            .max(1000, t('marketing_consents.withdraw.validation.maxLength')),
    }), [t]);
    const withdrawalFormFields = React.useMemo<CrudField[]>(() => [
        {
            id: 'reason',
            label: t('marketing_consents.withdraw.reason'),
            placeholder: t('marketing_consents.withdraw.reasonPlaceholder'),
            description: t('marketing_consents.withdraw.reasonHelp'),
            type: 'textarea',
            required: true,
            maxLength: 1000,
            showCount: true,
            layout: 'full',
        },
    ], [t]);
    const submitWithdrawal = React.useCallback(async (values: WithdrawalFormValues) => {
        if (!record)
            return;
        try {
            await runMutation({
                operation: async () => readApiResultOrThrow<WithdrawalResponse>(`/api/marketing_consents/consents/${encodeURIComponent(record.id)}/withdraw`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ reason: values.reason, updatedAt: record.updatedAt }),
                }, { errorMessage: t('marketing_consents.withdraw.error') }),
                context: { resourceType: 'marketing_consents.consent_record', resourceId: record.id },
                mutationPayload: { updatedAt: record.updatedAt },
            });
            flash(t('marketing_consents.withdraw.success'), 'success');
            setWithdrawOpen(false);
            await queryClient.invalidateQueries({ queryKey: ['marketing-consents'] });
            await refetch();
        }
        catch (mutationError) {
            if (errorStatus(mutationError) === 409)
                await refetch();
            throw mutationError;
        }
    }, [record, refetch, queryClient, runMutation, t]);
    const requestFormSubmit = React.useCallback(() => {
        dialogContentRef.current?.querySelector('form')?.requestSubmit();
    }, []);
    const closeWithdrawDialog = React.useCallback(() => setWithdrawOpen(false), []);
    const handleDialogKeyDown = useDialogKeyHandler({
        onConfirm: requestFormSubmit,
        onCancel: closeWithdrawDialog,
    });
    if (isLoading) {
        return <LoadingMessage label={t('marketing_consents.detail.loading')}/>;
    }
    if (!record && errorStatus(error) === 403) {
        return <AccessDeniedMessage label={t('marketing_consents.detail.denied')}/>;
    }
    if (!record && errorStatus(error) === 404) {
        return (<RecordNotFoundState label={t('marketing_consents.detail.notFound')} description={t('marketing_consents.detail.notFoundDescription')} backHref="/backend/marketing_consents" backLabel={t('marketing_consents.detail.back')}/>);
    }
    if (!record) {
        return (<ErrorMessage label={t('marketing_consents.detail.loadError')} action={(<Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {t('marketing_consents.detail.retry')}
          </Button>)}/>);
    }
    const name = [record.firstName, record.lastName].filter(Boolean).join(' ');
    const empty = t('common.notAvailable', '—');
    const recordFields: DetailFieldConfig[] = [
        detailField('recipient', t('marketing_consents.detail.fields.recipient'), record.email),
        detailField('name', t('marketing_consents.detail.fields.name'), name || empty),
        detailField('consentCode', t('marketing_consents.detail.fields.code'), record.consentCode),
        detailField('consentName', t('marketing_consents.detail.fields.nameOfConsent'), record.consentName),
        detailField('status', t('marketing_consents.table.status'), (<StatusBadge variant={record.status === 'granted' ? 'success' : 'neutral'} dot>
        {t(`marketing_consents.status.${record.status}`)}
      </StatusBadge>)),
        detailField('grantedAt', t('marketing_consents.detail.fields.grantedAt'), formatTimestamp(record.grantedAt, empty)),
        detailField('receivedAt', t('marketing_consents.detail.fields.receivedAt'), formatTimestamp(record.receivedAt, empty)),
        detailField('userIp', t('marketing_consents.detail.fields.ip'), record.userIp),
        detailField('sourceSubject', t('marketing_consents.detail.fields.source'), record.sourceSubject),
        detailField('confirmationMethod', t('marketing_consents.detail.fields.confirmation'), t('marketing_consents.confirmation.click')),
        detailField('contentSha256', t('marketing_consents.detail.fields.hash'), (<code className="break-all font-mono text-xs">{record.contentSha256}</code>), 'sm:col-span-2 md:col-span-3'),
        detailField('consentUrl', t('marketing_consents.detail.fields.url'), record.consentUrl ? (<a className="break-all text-primary underline-offset-4 hover:underline" href={record.consentUrl} rel="noreferrer" target="_blank">
        {record.consentUrl}
      </a>) : empty, 'sm:col-span-2 md:col-span-3'),
        detailField('consentText', t('marketing_consents.detail.fields.text'), (<pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono text-sm">
        {record.consentText}
      </pre>), 'sm:col-span-2 md:col-span-3'),
    ];
    const withdrawalFields = record.withdrawal ? [
        detailField('withdrawnAt', t('marketing_consents.detail.fields.withdrawnAt'), formatTimestamp(record.withdrawal.withdrawnAt, empty)),
        detailField('withdrawalActor', t('marketing_consents.detail.fields.withdrawalActor'), record.withdrawal.actorSubject),
        detailField('withdrawalReason', t('marketing_consents.detail.fields.withdrawalReason'), (<p className="whitespace-pre-wrap break-words">{record.withdrawal.reason}</p>), 'sm:col-span-2 md:col-span-3'),
    ] : [];
    return (<div className="space-y-6">
      <FormHeader mode="detail" backHref="/backend/marketing_consents" backLabel={t('marketing_consents.detail.back')} entityTypeLabel={t('marketing_consents.detail.entityType')} title={record.consentName} subtitle={record.email} statusBadge={(<StatusBadge variant={record.status === 'granted' ? 'success' : 'neutral'} dot>
            {t(`marketing_consents.status.${record.status}`)}
          </StatusBadge>)} actionsContent={record.status === 'granted' ? (<Button type="button" variant="destructive" onClick={() => setWithdrawOpen(true)}>
            {t('marketing_consents.detail.actions.withdraw')}
          </Button>) : null}/>

      <Alert status="information">
        {t('marketing_consents.detail.clickEvidenceNotice')}
      </Alert>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6" aria-labelledby="marketing-consent-proof-heading">
        <h2 id="marketing-consent-proof-heading" className="text-lg font-semibold">
          {t('marketing_consents.detail.sections.proof')}
        </h2>
        <DetailFieldsSection fields={recordFields}/>
      </section>

      {record.withdrawal ? (<section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6" aria-labelledby="marketing-consent-withdrawal-heading">
          <h2 id="marketing-consent-withdrawal-heading" className="text-lg font-semibold">
            {t('marketing_consents.detail.sections.withdrawal')}
          </h2>
          <DetailFieldsSection fields={withdrawalFields}/>
        </section>) : null}

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent size="default" onKeyDown={handleDialogKeyDown} ref={dialogContentRef}>
          <DialogHeader>
            <DialogTitle>{t('marketing_consents.withdraw.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('marketing_consents.withdraw.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <CrudForm<WithdrawalFormValues> embedded schema={withdrawalSchema} fields={withdrawalFormFields} initialValues={{ reason: '' }} submitLabel={t('marketing_consents.detail.actions.confirmWithdrawal')} extraActions={(<Button type="button" variant="outline" onClick={closeWithdrawDialog}>
                {t('marketing_consents.withdraw.cancel')}
              </Button>)} onSubmit={submitWithdrawal}/>
        </DialogContent>
      </Dialog>
    </div>);
}
