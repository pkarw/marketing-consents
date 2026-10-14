import { jsx as _jsx } from "react/jsx-runtime";
import { Page, PageBody } from "@open-mercato/ui/backend/Page";
import ConsentsTable from "../../components/ConsentsTable.js";
export default function MarketingConsentsPage() {
    return (_jsx(Page, { children: _jsx(PageBody, { children: _jsx(ConsentsTable, {}) }) }));
}
