export interface ToastMessage {
  id: string;
  text: string;
  type: 'error' | 'success' | 'info';
}

function createToastState() {
  let toasts = $state<ToastMessage[]>([]);

  function show(text: string, type: 'error' | 'success' | 'info' = 'info') {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, text, type }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 4000);
  }

  function error(text: string) { show(text, 'error'); }
  function success(text: string) { show(text, 'success'); }
  function info(text: string) { show(text, 'info'); }

  return {
    get toasts() { return toasts; },
    show,
    error,
    success,
    info,
  };
}

export const toastState = createToastState();
