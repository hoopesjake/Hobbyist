import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/auth/action-form";
import { BackLink } from "@/components/layout/back-link";
import { ListFields } from "@/components/lists/list-fields";
import { createList } from "@/app/lists/actions";
export default async function Page() {
  await requireUser();
  return <><BackLink href="/lists">Back to lists</BackLink><section className="list-editor"><h2>Create a list</h2><ActionForm action={createList} label="Create list"><ListFields/></ActionForm></section></>;
}
