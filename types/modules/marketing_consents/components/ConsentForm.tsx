'use client';
import * as React from "react";
import { Alert } from "@open-mercato/ui/primitives/alert";
import { Button } from "@open-mercato/ui/primitives/button";
import { Checkbox } from "@open-mercato/ui/primitives/checkbox";
import { Label } from "@open-mercato/ui/primitives/label";
export type ConsentDefinition = {
    code: string;
    name: string;
    text: string;
    contentUrl?: string;
};
export type ConsentConfirmation = {
    consent: ConsentDefinition;
    accepted: true;
    confirmationMethod: 'click';
    eventId: string;
};
export type ConsentFormLabels = {
    checkbox: string;
    submit: string;
    contentLink: string;
    success: string;
    error: string;
    required: string;
};
export type ConsentCheckboxLabels = Pick<ConsentFormLabels, 'checkbox' | 'contentLink'>;
export type ConsentFormProps = {
    consent: ConsentDefinition;
    onConfirm: (value: ConsentConfirmation) => Promise<void>;
    labels: ConsentFormLabels;
    disabled?: boolean;
};
export type ConsentCheckboxProps = {
    consent: ConsentDefinition;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    labels: ConsentCheckboxLabels;
    disabled?: boolean;
    error?: string;
};
function isHttpsUrl(value: string | undefined): value is string {
    if (!value)
        return false;
    try {
        return new URL(value).protocol === 'https:';
    }
    catch {
        return false;
    }
}
function createEventId(): string {
    return globalThis.crypto.randomUUID();
}
function definitionKey(consent: ConsentDefinition): string {
    return JSON.stringify([consent.code, consent.name, consent.text, consent.contentUrl ?? null]);
}
export const ConsentCheckbox = React.forwardRef<HTMLButtonElement, ConsentCheckboxProps>(function ConsentCheckbox({ consent, checked, onCheckedChange, labels, disabled = false, error, }, ref) {
    const id = React.useId();
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;
    const hasLink = isHttpsUrl(consent.contentUrl);
    return (<div className="space-y-2">
      <div className="flex min-w-0 items-start gap-3">
        <Checkbox ref={ref} id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} aria-invalid={Boolean(error)} aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId} className="mt-0.5" size="md"/>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={id} className="cursor-pointer leading-5">
            {labels.checkbox}
          </Label>
          <p id={descriptionId} className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">{consent.name}: </span>
            {consent.text}
          </p>
          {hasLink ? (<a href={consent.contentUrl} target="_blank" rel="noopener noreferrer" aria-label={`${labels.contentLink}: ${consent.name}`} className="text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {labels.contentLink}
            </a>) : null}
        </div>
      </div>
      {error ? (<p id={errorId} role="alert" className="text-sm text-status-error-foreground">
          {error}
        </p>) : null}
    </div>);
});
type DraftState = {
    definitionKey: string;
    checked: boolean;
    eventId: string | null;
    status: 'idle' | 'submitting' | 'success' | 'error';
};
export function ConsentForm({ consent, onConfirm, labels, disabled = false }: ConsentFormProps) {
    const currentDefinitionKey = definitionKey(consent);
    const [draft, setDraft] = React.useState<DraftState>(() => ({
        definitionKey: currentDefinitionKey,
        checked: false,
        eventId: null,
        status: 'idle',
    }));
    const [showRequired, setShowRequired] = React.useState(false);
    const checkboxRef = React.useRef<HTMLButtonElement>(null);
    const submittedConsentRef = React.useRef<ConsentDefinition | null>(null);
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
    const updateChecked = React.useCallback((nextChecked: boolean) => {
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
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
    return (<form onSubmit={(event) => void handleSubmit(event)} className="min-w-0 space-y-4">
      <ConsentCheckbox ref={checkboxRef} consent={visibleConsent} checked={checked} onCheckedChange={updateChecked} labels={labels} disabled={isBusy || status === 'success'} error={requiredError}/>
      {consentError ? (<Alert status="error" aria-live="assertive">
          {consentError}
        </Alert>) : null}
      {status === 'success' ? (<Alert status="success" aria-live="polite">
          {labels.success}
        </Alert>) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={isBusy || status === 'success'}>
          {labels.submit}
        </Button>
      </div>
    </form>);
}
