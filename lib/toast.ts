/**
 * Simple toast notification utility
 * Uses native browser alert for now - can be upgraded to a proper toast library later
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
}

// Simple in-memory toast container
let toastContainer: HTMLDivElement | null = null;

function getToastContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(options: ToastOptions) {
  const container = getToastContainer();
  const toast = document.createElement('div');

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  };

  toast.className = `${colors[options.type]} text-white px-4 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 opacity-100`;
  toast.textContent = options.message;
  toast.style.cssText = `
    background-color: ${options.type === 'success' ? '#16a34a' : options.type === 'error' ? '#dc2626' : options.type === 'warning' ? '#d97706' : '#2563eb'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    transform: translateX(0);
    opacity: 1;
    font-size: 14px;
    font-weight: 500;
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Remove after duration
  const duration = options.duration || 3000;
  setTimeout(() => {
    toast.style.transform = 'translateX(400px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, duration);
}

export const toast = {
  success: (message: string, duration?: number) => {
    showToast({ type: 'success', message, duration });
  },
  error: (message: string, duration?: number) => {
    showToast({ type: 'error', message, duration });
  },
  info: (message: string, duration?: number) => {
    showToast({ type: 'info', message, duration });
  },
  warning: (message: string, duration?: number) => {
    showToast({ type: 'warning', message, duration });
  },
};
