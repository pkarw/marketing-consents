"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DataTable } from "@open-mercato/ui/backend/DataTable";
import { RowActions } from "@open-mercato/ui/backend/RowActions";
import { Alert } from "@open-mercato/ui/primitives/alert";
import { StatusBadge } from "@open-mercato/ui/primitives/status-badge";
import { fetchCrudList } from "@open-mercato/ui/backend/utils/crud";
import { useOrganizationScopeVersion } from "@open-mercato/shared/lib/frontend/useOrganizationScope";
import { useT } from "@open-mercato/shared/lib/i18n/context";
function formatTimestamp(value, empty) {
    if (!value)
        return empty;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return empty;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function dateBoundary(value, endExclusive) {
    if (typeof value !== 'string' || !value)
        return undefined;
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
    if (!Number.isFinite(date.getTime()))
        return undefined;
    if (dateOnly && endExclusive)
        date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
}
export default function ConsentsTable() {
    const t = useT();
    const router = useRouter();
    const [search, setSearch] = React.useState('');
    const [filters, setFilters] = React.useState({});
    const [sorting, setSorting] = React.useState([{ id: 'grantedAt', desc: true }]);
    const [page, setPage] = React.useState(1);
    const scopeVersion = useOrganizationScopeVersion();
    const filterDefinitions = React.useMemo(() => [
        {
            id: 'status',
            label: t('marketing_consents.list.filters.status'),
            type: 'select',
            options: [
                { value: 'granted', label: t('marketing_consents.status.granted') },
                { value: 'withdrawn', label: t('marketing_consents.status.withdrawn') },
            ],
        },
        { id: 'grantedAt', label: t('marketing_consents.list.filters.grantedAt'), type: 'dateRange' },
        { id: 'withdrawnAt', label: t('marketing_consents.list.filters.withdrawnAt'), type: 'dateRange' },
    ], [t]);
    const queryParams = React.useMemo(() => {
        const params = new URLSearchParams({
            page: String(page),
            pageSize: '25',
            sortField: sorting[0]?.id ?? 'grantedAt',
            sortDir: sorting[0]?.desc ? 'desc' : 'asc',
        });
        const code = search.trim();
        if (code)
            params.set('code', code);
        if (filters.status === 'granted' || filters.status === 'withdrawn')
            params.set('status', filters.status);
        const grantedAt = filters.grantedAt;
        const withdrawnAt = filters.withdrawnAt;
        const grantedFrom = dateBoundary(grantedAt?.from, false);
        const grantedTo = dateBoundary(grantedAt?.to, true);
        const withdrawnFrom = dateBoundary(withdrawnAt?.from, false);
        const withdrawnTo = dateBoundary(withdrawnAt?.to, true);
        if (grantedFrom)
            params.set('grantedFrom', grantedFrom);
        if (grantedTo)
            params.set('grantedTo', grantedTo);
        if (withdrawnFrom)
            params.set('withdrawnFrom', withdrawnFrom);
        if (withdrawnTo)
            params.set('withdrawnTo', withdrawnTo);
        return params.toString();
    }, [filters, page, search, sorting]);
    const { data, isLoading, error } = useQuery({
        queryKey: ['marketing-consents', queryParams, scopeVersion],
        queryFn: async () => fetchCrudList('marketing_consents/consents', Object.fromEntries(new URLSearchParams(queryParams))),
    });
    const columns = React.useMemo(() => [
        {
            accessorKey: 'email',
            header: t('marketing_consents.table.recipient'),
            meta: { priority: 1, truncate: true, maxWidth: '18rem' },
        },
        {
            accessorKey: 'consentName',
            header: t('marketing_consents.table.consent'),
            meta: { priority: 2, truncate: true, maxWidth: '18rem' },
            cell: ({ row }) => (_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-medium", children: row.original.consentName }), _jsx("div", { className: "truncate text-sm text-muted-foreground", children: row.original.consentCode })] })),
        },
        {
            accessorKey: 'status',
            header: t('marketing_consents.table.status'),
            meta: { priority: 1 },
            cell: ({ row }) => (_jsx(StatusBadge, { variant: row.original.status === 'granted' ? 'success' : 'neutral', dot: true, children: t(`marketing_consents.status.${row.original.status}`) })),
        },
        {
            accessorKey: 'grantedAt',
            header: t('marketing_consents.table.grantedAt'),
            meta: { priority: 2, truncate: true, maxWidth: '12rem' },
            cell: ({ row }) => formatTimestamp(row.original.grantedAt, t('common.notAvailable', '—')),
        },
        {
            accessorKey: 'withdrawnAt',
            header: t('marketing_consents.table.withdrawnAt'),
            meta: { priority: 4, truncate: true, maxWidth: '12rem' },
            cell: ({ row }) => formatTimestamp(row.original.withdrawnAt, t('common.notAvailable', '—')),
        },
    ], [t]);
    if (error) {
        return (_jsx(Alert, { status: "error", children: t('marketing_consents.list.error') }));
    }
    return (_jsx(DataTable, { title: t('marketing_consents.list.title'), titleHeadingLevel: 1, columns: columns, data: data?.items ?? [], searchValue: search, searchPlaceholder: t('marketing_consents.list.searchPlaceholder'), onSearchChange: (value) => {
            setSearch(value);
            setPage(1);
        }, filters: filterDefinitions, filterValues: filters, onFiltersApply: (value) => {
            setFilters(value);
            setPage(1);
        }, onFiltersClear: () => {
            setFilters({});
            setSearch('');
            setPage(1);
        }, entityId: "marketing_consents:consent_record", extensionTableId: "marketing_consents.consents", sortable: true, sorting: sorting, onSortingChange: (value) => {
            setSorting(value);
            setPage(1);
        }, rowActions: (row) => (_jsx(RowActions, { items: [
                {
                    label: t('marketing_consents.table.actions.view'),
                    href: `/backend/marketing_consents/${row.id}`,
                },
            ] })), onRowClick: (row) => router.push(`/backend/marketing_consents/${row.id}`), pagination: {
            page,
            pageSize: 25,
            total: data?.total ?? 0,
            totalPages: data?.totalPages ?? 0,
            totalIsCapped: data?.totalIsCapped === true,
            onPageChange: setPage,
        }, isLoading: isLoading, emptyState: (_jsx("div", { className: "py-8 text-center text-sm text-muted-foreground", role: "status", children: t('marketing_consents.list.empty') })) }));
}
