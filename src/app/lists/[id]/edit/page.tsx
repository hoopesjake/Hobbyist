import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getList, getAllListItems } from "@/lib/lists";
import { listId } from "@/lib/list-validation";
import { getListCatalogItem, toLibraryOption } from "@/lib/list-catalog";
import { BackLink } from "@/components/layout/back-link";
import { ListBuilder } from "@/components/lists/list-builder";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = listId((await params).id); if (!id) notFound();
  const { list, owner, error } = await getList(id);
  if (error) return <p role="status" className="welcome-copy">{error}</p>;
  if (!list || !owner) notFound();
  const contents = await getAllListItems(id);
  if (contents.error) return <p role="status" className="welcome-copy">{contents.error}</p>;
  const catalogItems = await Promise.all(contents.items.map(getListCatalogItem));
  const items = catalogItems.map(toLibraryOption);
  return <><BackLink href={`/lists/${id}`}>Back to list</BackLink><ListBuilder mode="edit" listId={id} initial={{ name: list.name, description: list.description, visibility: list.visibility, items }}/></>;
}
