import { redirect } from "next/navigation";
export default function ReadingList() { redirect("/books/library?status=want_to_read"); }
