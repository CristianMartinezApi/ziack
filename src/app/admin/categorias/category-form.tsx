"use client";

import { useActionState } from "react";
import { Check, Plus, Save } from "lucide-react";
import { saveCategory, toggleCategory, type CategoryActionState } from "./actions";

const initialState: CategoryActionState = { message: "", success: false };

export function CategoryForm({ category }: { category?: { id: string; name: string } }) {
  const [state, formAction, pending] = useActionState(saveCategory, initialState);

  return (
    <form action={formAction} className="category-form">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label className="category-name-field">{category ? "Nome da categoria" : "Nova categoria"}
        <input name="name" defaultValue={category?.name} minLength={2} maxLength={50} required />
      </label>
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Salvando..." : category ? "Salvar" : "Adicionar"} {category ? <Save size={14} /> : <Plus size={14} />}</button>
      {state.message && <p className={state.success ? "settings-feedback settings-feedback-success" : "settings-feedback settings-feedback-error"} role={state.success ? "status" : "alert"}>{state.success && <Check size={14} />}{state.message}</p>}
    </form>
  );
}

export function CategoryToggle({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleCategory, initialState);

  return (
    <form action={formAction} className="category-toggle-form">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending}>{pending ? "Aguarde..." : active ? "Desativar" : "Reativar"}</button>
      {state.message && <p className={state.success ? "settings-feedback settings-feedback-success" : "settings-feedback settings-feedback-error"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
