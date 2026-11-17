import type { MediaList } from "@/lib/lists";
export function ListFields({ list }: { list?: MediaList }) {
  return <><label>List name<input name="name" required maxLength={100} defaultValue={list?.name || ""} placeholder="Rainy day favorites"/></label><label>Description<textarea name="description" maxLength={2000} rows={3} defaultValue={list?.description||""}/></label><label className="list-visibility-toggle"><span>Public list</span><input type="checkbox" role="switch" name="is_public" defaultChecked={list?.visibility === "public"}/></label></>;
}
