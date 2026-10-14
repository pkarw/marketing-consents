"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "@open-mercato/shared/lib/i18n/context";
import { readApiResultOrThrow } from "@open-mercato/ui/backend/utils/apiCall";
import { useGuardedMutation } from "@open-mercato/ui/backend/injection/useGuardedMutation";
import { useDialogKeyHandler } from "@open-mercato/ui/hooks/useDialogKeyHandler";
import { FormHeader } from "@open-mercato/ui/backend/forms/FormHeader";
import { CrudForm } from "@open-mercato/ui/backend/CrudForm";
import { AccessDeniedMessage, DetailFieldsSection, ErrorMessage, LoadingMessage, RecordNotFoundState, } from "@open-mercato/ui/backend/detail";
import { flash } from "@open-mercato/ui/backend/FlashMessages";
import { Alert } from "@open-mercato/ui/primitives/alert";
import { Button } from "@open-mercato/ui/primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@open-mercato/ui/primitives/dialog";
import { StatusBadge } from "@open-mercato/ui/primitives/status-badge";
function formatTimestamp(value, empty) {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
        : empty;
}
function detailField(key, label, value, gridClassName) {
    return {
        kind: 'custom',
        key,
        label,
        emptyLabel: '—',
        gridClassName,
        render: () => (_jsxs("div", { className: "min-w-0 space-y-1", children: [_jsx("div", { className: "text-sm font-medium", children: label }), _jsx("div", { className: "min-w-0 break-words text-sm text-muted-foreground", children: value ?? '—' })] })),
    };
}
function errorStatus(error) {
    if (!error || typeof error !== 'object')
        return null;
    const status = error.status;
    return typeof status === 'number' ? status : null;
}
export default function ConsentDetail({ id }) {
    const t = useT();
    const queryClient = useQueryClient();
    const [withdrawOpen, setWithdrawOpen] = React.useState(false);
    const dialogContentRef = React.useRef(null);
    const { runMutation } = useGuardedMutation({ contextId: 'marketing-consents.withdraw' });
    const { data: record, error, isLoading, refetch, } = useQuery({
        queryKey: ['marketing-consent', id],
        queryFn: async () => readApiResultOrThrow(`/api/marketing_consents/consents/${encodeURIComponent(id)}`, undefined, { errorMessage: t('marketing_consents.detail.loadError') }),
    });
    const withdrawalSchema = React.useMemo(() => z.object({
        reason: z.string()
            .trim()
            .min(1, t('marketing_consents.withdraw.validation.required'))
            .max(1000, t('marketing_consents.withdraw.validation.maxLength')),
    }), [t]);
    const withdrawalFormFields = React.useMemo(() => [
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
    const submitWithdrawal = React.useCallback(async (values) => {
        if (!record)
            return;
        try {
            await runMutation({
                operation: async () => readApiResultOrThrow(`/api/marketing_consents/consents/${encodeURIComponent(record.id)}/withdraw`, {
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
        return _jsx(LoadingMessage, { label: t('marketing_consents.detail.loading') });
    }
    if (!record && errorStatus(error) === 403) {
        return _jsx(AccessDeniedMessage, { label: t('marketing_consents.detail.denied') });
    }
    if (!record && errorStatus(error) === 404) {
        return (_jsx(RecordNotFoundState, { label: t('marketing_consents.detail.notFound'), description: t('marketing_consents.detail.notFoundDescription'), backHref: "/backend/marketing_consents", backLabel: t('marketing_consents.detail.back') }));
    }
    if (!record) {
        return (_jsx(ErrorMessage, { label: t('marketing_consents.detail.loadError'), action: (_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => void refetch(), children: t('marketing_consents.detail.retry') })) }));
    }
    const name = [record.firstName, record.lastName].filter(Boolean).join(' ');
    const empty = t('common.notAvailable', '—');
    const recordFields = [
        detailField('recipient', t('marketing_consents.detail.fields.recipient'), record.email),
        detailField('name', t('marketing_consents.detail.fields.name'), name || empty),
        detailField('consentCode', t('marketing_consents.detail.fields.code'), record.consentCode),
        detailField('consentName', t('marketing_consents.detail.fields.nameOfConsent'), record.consentName),
        detailField('status', t('marketing_consents.table.status'), (_jsx(StatusBadge, { variant: record.status === 'granted' ? 'success' : 'neutral', dot: true, children: t(`marketing_consents.status.${record.status}`) }))),
        detailField('grantedAt', t('marketing_consents.detail.fields.grantedAt'), formatTimestamp(record.grantedAt, empty)),
        detailField('receivedAt', t('marketing_consents.detail.fields.receivedAt'), formatTimestamp(record.receivedAt, empty)),
        detailField('userIp', t('marketing_consents.detail.fields.ip'), record.userIp),
        detailField('sourceSubject', t('marketing_consents.detail.fields.source'), record.sourceSubject),
        detailField('confirmationMethod', t('marketing_consents.detail.fields.confirmation'), t('marketing_consents.confirmation.click')),
        detailField('contentSha256', t('marketing_consents.detail.fields.hash'), (_jsx("code", { className: "break-all font-mono text-xs", children: record.contentSha256 })), 'sm:col-span-2 md:col-span-3'),
        detailField('consentUrl', t('marketing_consents.detail.fields.url'), record.consentUrl ? (_jsx("a", { className: "break-all text-primary underline-offset-4 hover:underline", href: record.consentUrl, rel: "noreferrer", target: "_blank", children: record.consentUrl })) : empty, 'sm:col-span-2 md:col-span-3'),
        detailField('consentText', t('marketing_consents.detail.fields.text'), (_jsx("pre", { className: "max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono text-sm", children: record.consentText })), 'sm:col-span-2 md:col-span-3'),
    ];
    const withdrawalFields = record.withdrawal ? [
        detailField('withdrawnAt', t('marketing_consents.detail.fields.withdrawnAt'), formatTimestamp(record.withdrawal.withdrawnAt, empty)),
        detailField('withdrawalActor', t('marketing_consents.detail.fields.withdrawalActor'), record.withdrawal.actorSubject),
        detailField('withdrawalReason', t('marketing_consents.detail.fields.withdrawalReason'), (_jsx("p", { className: "whitespace-pre-wrap break-words", children: record.withdrawal.reason })), 'sm:col-span-2 md:col-span-3'),
    ] : [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(FormHeader, { mode: "detail", backHref: "/backend/marketing_consents", backLabel: t('marketing_consents.detail.back'), entityTypeLabel: t('marketing_consents.detail.entityType'), title: record.consentName, subtitle: record.email, statusBadge: (_jsx(StatusBadge, { variant: record.status === 'granted' ? 'success' : 'neutral', dot: true, children: t(`marketing_consents.status.${record.status}`) })), actionsContent: record.status === 'granted' ? (_jsx(Button, { type: "button", variant: "destructive", onClick: () => setWithdrawOpen(true), children: t('marketing_consents.detail.actions.withdraw') })) : null }), _jsx(Alert, { status: "information", children: t('marketing_consents.detail.clickEvidenceNotice') }), _jsxs("section", { className: "space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6", "aria-labelledby": "marketing-consent-proof-heading", children: [_jsx("h2", { id: "marketing-consent-proof-heading", className: "text-lg font-semibold", children: t('marketing_consents.detail.sections.proof') }), _jsx(DetailFieldsSection, { fields: recordFields })] }), record.withdrawal ? (_jsxs("section", { className: "space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6", "aria-labelledby": "marketing-consent-withdrawal-heading", children: [_jsx("h2", { id: "marketing-consent-withdrawal-heading", className: "text-lg font-semibold", children: t('marketing_consents.detail.sections.withdrawal') }), _jsx(DetailFieldsSection, { fields: withdrawalFields })] })) : null, _jsx(Dialog, { open: withdrawOpen, onOpenChange: setWithdrawOpen, children: _jsxs(DialogContent, { size: "default", onKeyDown: handleDialogKeyDown, ref: dialogContentRef, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: t('marketing_consents.withdraw.dialogTitle') }), _jsx(DialogDescription, { children: t('marketing_consents.withdraw.dialogDescription') })] }), _jsx(CrudForm, { embedded: true, schema: withdrawalSchema, fields: withdrawalFormFields, initialValues: { reason: '' }, submitLabel: t('marketing_consents.detail.actions.confirmWithdrawal'), extraActions: (_jsx(Button, { type: "button", variant: "outline", onClick: closeWithdrawDialog, children: t('marketing_consents.withdraw.cancel') })), onSubmit: submitWithdrawal })] }) })] }));
}
