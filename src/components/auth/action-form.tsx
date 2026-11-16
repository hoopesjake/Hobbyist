"use client";
import { useActionState, type ReactNode } from "react";
export type FormState = { error?: string; message?: string };
export function ActionForm({ action, children, label }: { action: (state: FormState, form: FormData) => Promise<FormState>; children?: ReactNode; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form className="account-form" action={formAction}>{children}{state.error && <p role="alert" className="form-error">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}<button className="account-button" disabled={pending}>{pending ? "Please wait..." : label}</button></form>;
}
