import React from 'react';
import {
  Button,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { AdminIcon } from './icons';
import { focusRing } from './ui';

interface AdminToast {
  title: string;
  description?: string;
  kind?: 'ok' | 'error';
}

export const adminToasts = new ToastQueue<AdminToast>({ maxVisibleToasts: 3 });

/** Short confirmation after an action; errors stay until dismissed. */
export function notify(title: string, options: { description?: string; kind?: 'ok' | 'error' } = {}) {
  const kind = options.kind ?? 'ok';
  adminToasts.add({ title, description: options.description, kind }, kind === 'ok' ? { timeout: 5000 } : undefined);
}

export function AdminToastRegion() {
  return (
    <ToastRegion queue={adminToasts} className="fixed inset-x-4 bottom-24 z-[60] flex flex-col items-end gap-2 outline-none lg:inset-x-auto lg:right-6 lg:bottom-6">
      {({ toast }) => (
        <Toast toast={toast} className={`flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white p-4 text-navy shadow-lift ${toast.content.kind === 'error' ? 'border-[#b42318]' : 'border-line'} ${focusRing}`}>
          <span className={`grid size-8 shrink-0 place-items-center rounded-full ${toast.content.kind === 'error' ? 'bg-[#fdecea] text-[#b42318]' : 'bg-basil-50 text-basil-700'}`}>
            <AdminIcon name={toast.content.kind === 'error' ? 'todo' : 'check'} />
          </span>
          <ToastContent className="min-w-0 flex-1 pt-1">
            <Text slot="title" className="block font-bold">{toast.content.title}</Text>
            {toast.content.description && <Text slot="description" className="block text-sm text-muted">{toast.content.description}</Text>}
          </ToastContent>
          <Button slot="close" aria-label="Chiudi notifica" className={`grid size-8 place-items-center rounded-full text-muted data-[hovered]:bg-cyan-50 ${focusRing}`}>
            <AdminIcon name="x" className="size-4" />
          </Button>
        </Toast>
      )}
    </ToastRegion>
  );
}
