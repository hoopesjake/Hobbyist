import Link from "next/link";
import { notFound } from "next/navigation";
import { getList,getListItems } from "@/lib/lists";
import { listId } from "@/lib/list-validation";
import { getListCatalogItem,type ListCatalogItem } from "@/lib/list-catalog";
import { ListCatalogCard } from "@/components/lists/list-catalog-card";
import { ActionForm } from "@/components/auth/action-form";
import { BackLink } from "@/components/layout/back-link";
import { DeleteList,ShareList } from "@/components/lists/list-controls";
import { removeListItem } from "@/app/lists/actions";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 const id=listId((await params).id);if(!id)notFound();const {list,owner,error}=await getList(id);if(error)return <p role="status" className="welcome-copy">{error}</p>;if(!list)notFound();
 const filters=await searchParams,page=Math.max(1,Math.min(100000,parseInt(filters.page||"1",10)||1));
 const contents=await getListItems(id,page),items:ListCatalogItem[]=[];
 for(let offset=0;offset<contents.items.length;offset+=8)items.push(...await Promise.all(contents.items.slice(offset,offset+8).map(getListCatalogItem)));
 const fields=(item:ListCatalogItem)=><><input type="hidden" name="list_id" value={id}/><input type="hidden" name="media_type" value={item.media_type}/><input type="hidden" name={item.media_type==="game"?"igdb_id":item.media_type==="book"?"ol_id":"tmdb_id"} value={item.id}/></>;
 const pages=Math.max(1,Math.ceil(contents.total/20));
 return <><BackLink href="/lists">Back to lists</BackLink><div className="list-title-row"><div><span className="list-visibility">{list.visibility==="public"?"Public":"Private"}</span><h2>{list.name}</h2>{list.description&&<p className="list-description">{list.description}</p>}<p className="welcome-copy">{contents.total} {contents.total===1?"title":"titles"}</p></div><div className="list-title-actions">{list.visibility==="public"&&<ShareList/>}{owner&&<Link className="account-button" href={`/lists/${id}/edit`}>Edit list</Link>}</div></div>
 {owner&&<details className="list-settings"><summary>Delete list</summary><div className="list-editor"><DeleteList id={id}/></div></details>}
 <section className="dashboard-section">{contents.error?<p role="status">{contents.error}</p>:items.length?<div className="catalog-grid">{items.map(item=><article key={`${item.media_type}-${item.id}`} className="list-item-card"><ListCatalogCard item={item}/>{owner&&<ActionForm action={removeListItem} label="Remove from list">{fields(item)}</ActionForm>}</article>)}</div>:<div className="media-empty"><p>Nothing on this list yet.</p>{owner&&<Link className="account-button" href={`/lists/${id}/edit`}>Add media</Link>}</div>}{!contents.error&&pages>1&&<nav className="catalog-pagination" aria-label="List contents pages">{page>1&&<Link href={`?page=${page-1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link href={`?page=${page+1}`}>Next</Link>}</nav>}</section></>;
}
