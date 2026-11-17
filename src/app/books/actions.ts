"use server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBook, getBookEdition, openLibraryWorkId } from "@/lib/open-library";
import { parseBookTracking } from "@/lib/book-validation";
import type { FormState } from "@/components/auth/action-form";

export async function saveBook(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser(); if (!user) return { error: "Sign in to save books." };
  const id = openLibraryWorkId(form.get("work_id")); if (!id) return { error: "Choose a valid book." };
  const parsed = parseBookTracking(form); if (parsed.error) return { error: parsed.error };
  const client = await createClient();
  const previous = await client.from("book_tracking").select("*").eq("user_id", user.id).eq("ol_work_id", id).maybeSingle();
  if (previous.error) return { error: "Your book could not be saved. Please try again shortly." };
  try {
    const book = previous.data ? { title: previous.data.title, authors: previous.data.authors, cover_url: previous.data.cover_url } : await getBook(id);
    if (parsed.fields.edition_id && parsed.fields.edition_id !== previous.data?.edition_id) await getBookEdition(id, parsed.fields.edition_id);
    const fields = { ...parsed.fields };
    if (previous.data && form.get("progress_changed") !== "on") fields.manual_current_page = previous.data.manual_current_page;
    if (previous.data && form.get("dates_changed") !== "on") {
      fields.started_on = previous.data.started_on;
      fields.finished_on = previous.data.finished_on;
    }
    if (previous.data && form.get("status_changed") !== "on" && form.get("dates_changed") !== "on") fields.status = previous.data.status;
    if (fields.finished_on) fields.status = "finished";
    else if (fields.started_on && fields.status !== "finished") fields.status = "reading";
    if (fields.total_pages !== null) {
      let sessions = client.from("calendar_entries").select("reading_end_page").eq("user_id", user.id).eq("media_type", "book").eq("provider_id", id).eq("kind", "actual");
      sessions = fields.edition_id ? sessions.eq("reading_edition_id", fields.edition_id) : sessions.is("reading_edition_id", null);
      const progress = await sessions.order("reading_end_page", {ascending:false,nullsFirst:false}).limit(1).maybeSingle();
      if (progress.error) return { error: "Reading progress could not be checked. Please try again." };
      if (progress.data?.reading_end_page > fields.total_pages) return { error: "This page count is lower than recorded reading progress for this edition." };
    }
    const values = { title: book.title.slice(0,500), authors: book.authors, cover_url: book.cover_url, ...fields, status_explicit: form.get("status_changed") === "on" || form.get("dates_changed") === "on" ? true : previous.data?.status_explicit || false };
    // PostgREST upsert includes identity columns in its UPDATE clause, but
    // book_tracking deliberately grants updates only to editable columns.
    const result = previous.data
      ? await client.from("book_tracking").update(values).eq("user_id", user.id).eq("ol_work_id", id)
      : await client.from("book_tracking").insert({ user_id: user.id, ol_work_id: id, ...values });
    if (result.error) {
      console.error("Book tracking write failed:", result.error.code);
      return { error: result.error.code === "23505" ? "This book was just added. Refresh to edit your reading record." : "Your reading record could not be saved. Please try again." };
    }
  } catch { return { error: "This book or edition could not be verified. Please try again." }; }
  revalidatePath("/books", "layout"); revalidatePath("/calendar"); revalidatePath("/");
  return { message: "Book saved." };
}
