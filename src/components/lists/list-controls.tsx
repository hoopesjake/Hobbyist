"use client";
import { useState } from "react";
import { ActionForm, type FormState } from "@/components/auth/action-form";
import { deleteList } from "@/app/lists/actions";
export function ShareList() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="list-share"><button className="account-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`); setCopied(true); setFailed(false); } catch { setFailed(true); } }}>{copied ? "Link copied" : "Copy public link"}</button>{failed && <p role="status">Copy this page’s address to share your list.</p>}</div>;
}
export function DeleteList({ id }: { id: string }) {
  async function remove(state: FormState, form: FormData) {
    if (!window.confirm("Delete this list and all its entries?")) return {};
    return deleteList(state, form);
  }
  return <ActionForm action={remove} label="Delete list"><input type="hidden" name="list_id" value={id}/></ActionForm>;
}
