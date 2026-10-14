'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Alert } from "@open-mercato/ui/primitives/alert";
import { Button } from "@open-mercato/ui/primitives/button";
import { Checkbox } from "@open-mercato/ui/primitives/checkbox";
import { Label } from "@open-mercato/ui/primitives/label";
function isHttpsUrl(value) {
    if (!value)
        return false;
    try {
        return new URL(value).protocol === 'https:';
    }
    catch {
        return false;
    }
}
function createEventId() {
    return globalThis.crypto.randomUUID();
}
function definitionKey(consent) {
    return JSON.stringify([consent.code, consent.name, consent.text, consent.contentUrl ?? null]);
}
export const ConsentCheckbox = React.forwardRef(function ConsentCheckbox({ consent, checked, onCheckedChange, labels, disabled = false, error, }, ref) {
    const id = React.useId();
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;
    const hasLink = isHttpsUrl(consent.contentUrl);
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx(Checkbox, { ref: ref, id: id, checked: checked, disabled: disabled, onCheckedChange: (value) => onCheckedChange(value === true), "aria-invalid": Boolean(error), "aria-describedby": error ? `${descriptionId} ${errorId}` : descriptionId, className: "mt-0.5", size: "md" }), _jsxs("div", { className: "min-w-0 space-y-2", children: [_jsx(Label, { htmlFor: id, className: "cursor-pointer leading-5", children: labels.checkbox }), _jsxs("p", { id: descriptionId, className: "whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground", children: [_jsxs("span", { className: "font-medium text-foreground", children: [consent.name, ": "] }), consent.text] }), hasLink ? (_jsx("a", { href: consent.contentUrl, target: "_blank", rel: "noopener noreferrer", "aria-label": `${labels.contentLink}: ${consent.name}`, className: "text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", children: labels.contentLink })) : null] })] }), error ? (_jsx("p", { id: errorId, role: "alert", className: "text-sm text-status-error-foreground", children: error })) : null] }));
});
export function ConsentForm({ consent, onConfirm, labels, disabled = false }) {
    const currentDefinitionKey = definitionKey(consent);
    const [draft, setDraft] = React.useState(() => ({
        definitionKey: currentDefinitionKey,
        checked: false,
        eventId: null,
        status: 'idle',
    }));
    const [showRequired, setShowRequired] = React.useState(false);
    const checkboxRef = React.useRef(null);
    const submittedConsentRef = React.useRef(null);
    const definitionChanged = draft.definitionKey !== currentDefinitionKey;
    const isSubmitting = draft.status === 'submitting';
    const needsReset = definitionChanged && !isSubmitting;
    const checked = needsReset ? false : draft.checked;
    const eventId = needsReset ? null : draft.eventId;
    const status = needsReset ? 'idle' : draft.status;
    const requiredError = showRequired && !needsReset ? labels.required : undefined;
    const visibleConsent = isSubmitting ? (submittedConsentRef.current ?? consent) : consent;
    React.useEffect(() => {
        if (!definitionChanged || isSubmitting)
            return;
        setDraft({ definitionKey: currentDefinitionKey, checked: false, eventId: null, status: 'idle' });
        setShowRequired(false);
    }, [currentDefinitionKey, definitionChanged, isSubmitting]);
    const updateChecked = React.useCallback((nextChecked) => {
        setShowRequired(false);
        setDraft((current) => {
            const sameDefinition = current.definitionKey === currentDefinitionKey;
            const retainedEventId = sameDefinition ? current.eventId : null;
            return {
                definitionKey: currentDefinitionKey,
                checked: nextChecked,
                eventId: nextChecked ? (retainedEventId ?? createEventId()) : retainedEventId,
                status: 'idle',
            };
        });
    }, [currentDefinitionKey]);
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (disabled || status === 'submitting' || status === 'success')
            return;
        if (!checked) {
            setShowRequired(true);
            checkboxRef.current?.focus();
            return;
        }
        const submittedConsent = { ...consent };
        const submittedEventId = eventId ?? createEventId();
        submittedConsentRef.current = submittedConsent;
        setShowRequired(false);
        setDraft({
            definitionKey: currentDefinitionKey,
            checked: true,
            eventId: submittedEventId,
            status: 'submitting',
        });
        try {
            await onConfirm({
                consent: submittedConsent,
                accepted: true,
                confirmationMethod: 'click',
                eventId: submittedEventId,
            });
            setDraft((current) => ({ ...current, status: 'success' }));
        }
        catch {
            setDraft((current) => ({ ...current, status: 'error' }));
        }
        finally {
            submittedConsentRef.current = null;
        }
    };
    const isBusy = disabled || status === 'submitting';
    const consentError = status === 'error' ? labels.error : undefined;
    return (_jsxs("form", { onSubmit: (event) => void handleSubmit(event), className: "min-w-0 space-y-4", children: [_jsx(ConsentCheckbox, { ref: checkboxRef, consent: visibleConsent, checked: checked, onCheckedChange: updateChecked, labels: labels, disabled: isBusy || status === 'success', error: requiredError }), consentError ? (_jsx(Alert, { status: "error", "aria-live": "assertive", children: consentError })) : null, status === 'success' ? (_jsx(Alert, { status: "success", "aria-live": "polite", children: labels.success })) : null, _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "submit", disabled: isBusy || status === 'success', children: labels.submit }) })] }));
}
