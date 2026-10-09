"use client";

import { useId } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import type { CompanyShowcaseItem } from "@/lib/api-types";
import { MAX_SHOWCASE_ITEMS, SHOWCASE_TYPE_LABELS } from "@/lib/company-showcase";
import styles from "./company-showcase-editor.module.css";

type Props = {
  items: CompanyShowcaseItem[];
  onChange: (items: CompanyShowcaseItem[]) => void;
  disabled?: boolean;
};

export function CompanyShowcaseEditor({ items, onChange, disabled = false }: Props) {
  const fieldId = useId();

  function updateItem(index: number, changes: Partial<CompanyShowcaseItem>) {
    onChange(items.map((item, position) => position === index ? { ...item, ...changes } : item));
  }

  function addItem() {
    if (items.length >= MAX_SHOWCASE_ITEMS) return;
    onChange([...items, { name: "", item_type: "product", description: "", image_url: "" }]);
  }

  return (
    <fieldset className={styles.editor} disabled={disabled}>
      <legend><Package size={18} aria-hidden="true" /> Mostruário da empresa</legend>
      <div className={styles.heading}><p>Apresente até 3 produtos, serviços ou soluções. Os visitantes poderão conhecer o que você oferece e entrar em contato.</p><span>{items.length}/{MAX_SHOWCASE_ITEMS}</span></div>
      {items.map((item, index) => (
        <div className={styles.item} key={index}>
          <div className={styles.itemHeading}><strong>Item {index + 1}</strong><button type="button" className={styles.remove} aria-label={`Remover item ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}><Trash2 size={16} /> Remover</button></div>
          <div className="form-grid">
            <label className="field" htmlFor={`${fieldId}-${index}-name`}><span>Nome do item <b aria-hidden="true">*</b></span><input id={`${fieldId}-${index}-name`} value={item.name} maxLength={120} required onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="Ex.: Consultoria empresarial" /></label>
            <label className="field" htmlFor={`${fieldId}-${index}-type`}><span>Tipo</span><select id={`${fieldId}-${index}-type`} value={item.item_type} onChange={(event) => updateItem(index, { item_type: event.target.value as CompanyShowcaseItem["item_type"] })}>{Object.entries(SHOWCASE_TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          </div>
          <label className="field" htmlFor={`${fieldId}-${index}-description`}><span>Descrição <small>Opcional</small></span><textarea id={`${fieldId}-${index}-description`} value={item.description} maxLength={600} rows={3} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="O que é e como pode ajudar o cliente?" /></label>
          <label className="field" htmlFor={`${fieldId}-${index}-price`}><span>Preço (R$) <small>Opcional</small></span><input id={`${fieldId}-${index}-price`} inputMode="decimal" maxLength={16} pattern="(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2})" title="Informe um preço positivo com até duas casas decimais, por exemplo 149,90." value={item.price ?? ""} onChange={(event) => updateItem(index, { price: event.target.value || null })} placeholder="Ex.: 149,90" /><small>Deixe vazio para exibir o item sem preço.</small></label>
          <label className="field" htmlFor={`${fieldId}-${index}-image`}><span>Imagem (URL) <small>Opcional</small></span><input id={`${fieldId}-${index}-image`} type="url" maxLength={2000} value={item.image_url} onChange={(event) => updateItem(index, { image_url: event.target.value })} placeholder="https://..." /></label>
        </div>
      ))}
      {items.length === 0 && <div className={styles.empty}>Seu mostruário está vazio. Adicione o primeiro item para destacar o que a empresa oferece.</div>}
      <button type="button" className="button button-secondary" onClick={addItem} disabled={items.length >= MAX_SHOWCASE_ITEMS}><Plus size={16} aria-hidden="true" /> Adicionar produto ou serviço</button>
      {items.length >= MAX_SHOWCASE_ITEMS && <small className={styles.limit} role="status">Limite de 3 itens atingido. Você pode editar ou remover um deles.</small>}
    </fieldset>
  );
}
