"use client";
import Link from "next/link";
import { useRef } from "react";
import { X } from "lucide-react";
import { ActionForm } from "@/components/auth/action-form";
import { addListItem } from "@/app/lists/actions";
import type { MediaList } from "@/lib/lists";
const idField: Record<string, string> = { game: "igdb_id", book: "ol_id" };
export function AddToList({ id, kind, lists, error }: { id: number; kind: "movie" | "tv" | "game" | "book"; lists: MediaList[]; error: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button type="button" className="account-button add-to-list-trigger" onClick={() => dialog.current?.showModal()}>Add to list</button><dialog ref={dialog} className="review-dialog list-picker" aria-labelledby={`list-picker-${kind}-${id}`} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}><div className="review-dialog-content"><header className="review-dialog-header"><h2 id={`list-picker-${kind}-${id}`}>Add to list</h2><button type="button" className="icon-button" aria-label="Close lists" onClick={() => dialog.current?.close()}><X size={20}/></button></header>{error ? <p role="status">{error}</p> : lists.length ? <ActionForm action={addListItem} label="Add to list"><input type="hidden" name="media_type" value={kind}/><input type="hidden" name={idField[kind] || "tmdb_id"} value={id}/><label>List<select name="list_id" required>{lists.map(list => <option key={list.id} value={list.id}>{list.name}{list.visibility === "private" ? " · Private" : " · Public"}</option>)}</select></label></ActionForm> : <p className="welcome-copy">No lists yet</p>}<Link className="text-link" href="/lists/new">Create new list</Link></div></dialog></>;
}
