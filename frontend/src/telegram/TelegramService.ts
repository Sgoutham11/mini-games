import WebApp from '@twa-dev/sdk';

export interface TelegramContext {
  initData: string;
  userId: number | null;
  username: string;
  displayName: string;
  isDark: boolean;
  colorScheme: 'light' | 'dark';
}

class TelegramService {
  private ctx: TelegramContext = {
    initData: '',
    userId: null,
    username: 'Player',
    displayName: 'Player',
    isDark: true,
    colorScheme: 'dark',
  };

  init(): TelegramContext {
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#0a0a0f');
      WebApp.setBackgroundColor('#0a0a0f');

      const user = WebApp.initDataUnsafe?.user;
      this.ctx = {
        initData: WebApp.initData || '',
        userId: user?.id ?? null,
        username: user?.username ?? 'Player',
        displayName: user?.first_name ?? 'Player',
        isDark: WebApp.colorScheme === 'dark',
        colorScheme: WebApp.colorScheme,
      };
    } catch {
      // Running outside Telegram — dev mode
      this.ctx.initData = '';
    }
    return this.ctx;
  }

  getContext(): TelegramContext {
    return this.ctx;
  }

  getInitData(): string {
    return this.ctx.initData;
  }

  showMainButton(text: string, onClick: () => void): void {
    WebApp.MainButton.setText(text);
    WebApp.MainButton.show();
    WebApp.MainButton.onClick(onClick);
  }

  hideMainButton(): void {
    WebApp.MainButton.hide();
    WebApp.MainButton.offClick(() => {});
  }

  haptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
    try {
      if (type === 'light') WebApp.HapticFeedback.impactOccurred('light');
      else if (type === 'medium') WebApp.HapticFeedback.impactOccurred('medium');
      else WebApp.HapticFeedback.impactOccurred('heavy');
    } catch { /* noop */ }
  }

  close(): void {
    try { WebApp.close(); } catch { /* noop */ }
  }
}

export const telegram = new TelegramService();
