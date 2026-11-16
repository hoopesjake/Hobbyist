"use server";
import type { FormState } from "@/components/auth/action-form";
export { followActor } from "@/app/actors/actions";
// Old tracking forms must reload instead of writing to the read-only archive.
export async function saveViewing(state:FormState,form:FormData):Promise<FormState>{void state;void form;return {error:"Movies and TV now have separate libraries. Refresh this page to continue."};}
export async function removeViewing(state:FormState,form:FormData):Promise<FormState>{void state;void form;return {error:"Movies and TV now have separate libraries. Refresh this page to continue."};}
