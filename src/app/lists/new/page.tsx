import { requireUser } from "@/lib/auth";
import { BackLink } from "@/components/layout/back-link";
import { ListBuilder } from "@/components/lists/list-builder";
export default async function Page() {
  await requireUser();
  return <><BackLink href="/lists">Back to lists</BackLink><ListBuilder mode="create"/></>;
}
