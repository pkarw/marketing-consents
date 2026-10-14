import { jsx as _jsx } from "react/jsx-runtime";
import { Page, PageBody } from "@open-mercato/ui/backend/Page";
import ConsentDetail from "../../../components/ConsentDetail.js";
export default async function MarketingConsentDetailPage({ params }) {
    const { id } = await params;
    return (_jsx(Page, { children: _jsx(PageBody, { children: _jsx(ConsentDetail, { id: id }) }) }));
}
