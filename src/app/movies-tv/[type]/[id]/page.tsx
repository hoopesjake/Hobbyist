import { redirect,notFound } from "next/navigation";
import { validId,isMediaType } from "@/lib/media-validation";
export default async function Legacy({params}:{params:Promise<{type:string;id:string}>}){const {type,id}=await params;if(!validId(id)||!isMediaType(type))notFound();redirect(`${type==="movie"?"/movies":"/tv"}/${id}`);}
