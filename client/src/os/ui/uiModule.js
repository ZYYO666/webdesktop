import { createDiscreteApi, NButton } from 'naive-ui';
import { h } from 'vue';

const { message: discreteMessage, dialog: discreteDialog } = createDiscreteApi(['message', 'dialog'], {
  messageProviderProps: {
    placement: 'top',
    duration: 2200,
    keepAliveOnHover: true,
    max: 3,
    closable: false,
    containerClass: 'apple-toast-container',
  },
});

const toast = {
  info: (msg, duration) => discreteMessage.info(msg, { duration: duration ?? 2200, showIcon: false }),
  success: (msg, duration) => discreteMessage.success(msg, { duration: duration ?? 2200, showIcon: false }),
  error: (msg, duration) => discreteMessage.error(msg, { duration: duration ?? 2200, showIcon: false }),
  warning: (msg, duration) => discreteMessage.warning(msg, { duration: duration ?? 2200, showIcon: false }),
};

const dialog = {
  alert: (message, title) => {
    return new Promise((resolve) => {
      const d = discreteDialog.create({
        title: title || `提示`,
        content: message,
        showIcon: false,
        closable: false,
        maskClosable: false,
        action: () =>
          h(
            'div',
            { class: 'flex justify-end' },
            h(
              NButton,
              {
                type: 'primary',
                onClick: () => {
                  d.destroy();
                  resolve(true);
                },
              },
              { default: () => `确认` }
            )
          ),
      });
    });
  },
  confirm: (message, title) => {
    return new Promise((resolve) => {
      const d = discreteDialog.create({
        title: title || `确认`,
        content: () => h('div', { class: 'text-gray-600' }, message),
        showIcon: false,
        closable: false,
        maskClosable: false,
        style: { width: '400px' },
        action: () =>
          h('div', { class: 'flex justify-end gap-3' }, [
            h(
              NButton,
              {
                onClick: () => {
                  d.destroy();
                  resolve(false);
                },
              },
              { default: () => `取消` }
            ),
            h(
              NButton,
              {
                type: 'primary',
                onClick: () => {
                  d.destroy();
                  resolve(true);
                },
              },
              { default: () => `确认` }
            ),
          ]),
      });
    });
  },
};

const copyToClipboard = (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    void err;
  }
  document.body.removeChild(textArea);
  return Promise.resolve();
};

export const uiModule = {
  toast,
  dialog,
  message: discreteMessage,
  modal: discreteDialog,
  copyToClipboard,
};

