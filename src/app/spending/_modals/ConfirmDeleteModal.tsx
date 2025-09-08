"use client";

import React from "react";
import Modal from "@/components/ui/Modal";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
};

export default function ConfirmDeleteModal({
                                             open, title, message, confirmLabel="Eliminar", onClose, onConfirm
                                           }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}
           footer={
             <div className="flex justify-end">
               <button className="rounded-md border px-4 py-2" onClick={onClose}>Cancelar</button>
               <button
                 className="ml-2 rounded-md border px-4 py-2 bg-rose-600 text-white"
                 onClick={async () => { await onConfirm(); onClose(); }}
               >
                 {confirmLabel}
               </button>
             </div>
           }
    >
      <p className="text-sm opacity-80">{message ?? "Esta acción no se puede deshacer."}</p>
    </Modal>
  );
}
