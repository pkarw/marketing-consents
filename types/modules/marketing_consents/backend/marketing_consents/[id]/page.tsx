import { Page, PageBody } from "@open-mercato/ui/backend/Page";
import ConsentDetail from "../../../components/ConsentDetail.js";
type Props = {
    params: Promise<{
        id: string;
    }> | {
        id: string;
    };
};
export default async function MarketingConsentDetailPage({ params }: Props) {
    const { id } = await params;
    return (<Page>
      <PageBody>
        <ConsentDetail id={id}/>
      </PageBody>
    </Page>);
}
