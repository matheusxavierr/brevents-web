"use client";

import { useRef, useState } from "react";
import { Check, Expand, LayoutDashboard, MessageSquare, Radio, Users, X } from "lucide-react";
import { PRODUCT_PREVIEWS, type ProductPreviewKind } from "@/lib/product-previews";
import { ProductPreviewImage } from "./product-preview-image";
import styles from "./product-preview-gallery.module.css";

const previewIcons = { meeting: Users, event: Radio, networking: MessageSquare, organizer: LayoutDashboard };

export function ProductPreviewGallery({ kind }: { kind: "event" | "meeting" }) {
  const [selected, setSelected] = useState<ProductPreviewKind>(kind);
  const dialog = useRef<HTMLDialogElement>(null);
  const scenes: ProductPreviewKind[] = kind === "event" ? ["event", "networking", "organizer"] : ["meeting"];
  const active = scenes.includes(selected) ? selected : kind;
  const preview = PRODUCT_PREVIEWS[active];

  return (
    <section className={`container ${styles.gallery}`} aria-label={`Conheça ${kind === "event" ? "Web Events" : "Meetings"} por dentro`}>
      <div className={styles.intro}><p className="eyebrow">Por dentro do BR Events</p><h2>{kind === "event" ? "Do palco à próxima conexão." : "Sua próxima conversa, em uma sala completa."}</h2><p>Uma prévia do que sua equipe e seus participantes encontram na plataforma.</p></div>
      <div className={styles.layout}>
        <div className={styles.details}>
          {scenes.length > 1 && <nav className={styles.navigation} aria-label="Escolha uma prévia">{scenes.map(scene => {
            const Icon = previewIcons[scene];
            return <button type="button" key={scene} aria-pressed={active === scene} aria-controls="product-preview-figure" onClick={() => setSelected(scene)}><Icon size={19} aria-hidden="true" />{PRODUCT_PREVIEWS[scene].label}</button>;
          })}</nav>}
          <div className={styles.description} aria-live="polite"><h3>{preview.title}</h3><p>{preview.description}</p><ul>{preview.features.map(feature => <li key={feature}><Check size={16} aria-hidden="true" />{feature}</li>)}</ul></div>
        </div>
        <figure className={styles.figure} id="product-preview-figure">
          <div className={styles.imageFrame} key={active}><ProductPreviewImage kind={active} sizes="(max-width: 960px) 100vw, 70vw" className={styles.image} /><button type="button" className={styles.expand} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Expand size={15} aria-hidden="true" /> Ampliar prévia</button></div>
          <figcaption><span>Demonstração</span> Nomes, empresas e eventos fictícios.</figcaption>
        </figure>
      </div>
      <dialog className={styles.dialog} ref={dialog} aria-labelledby="product-preview-dialog-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className={styles.dialogHeader}><h2 id="product-preview-dialog-title">{preview.label}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar prévia"><X size={22} /></button></div>
        <div className={styles.expandedCanvas}><ProductPreviewImage kind={active} sizes="1200px" className={styles.expandedImage} /></div>
        <p>Demonstração com dados fictícios. <span>Deslize a imagem para ver os detalhes.</span></p>
      </dialog>
    </section>
  );
}
