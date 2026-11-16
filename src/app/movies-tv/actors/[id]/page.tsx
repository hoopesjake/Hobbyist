import { redirect,notFound } from "next/navigation";
import { validId } from "@/lib/media-validation";
export default async function Legacy({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!validId(id))notFound();redirect(`/actors/${id}`);}
