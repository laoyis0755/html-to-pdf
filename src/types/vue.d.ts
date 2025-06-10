declare module 'vue' {
  interface ComponentOptions {
    template?: string;
    data?: () => any;
    methods?: { [key: string]: Function };
    computed?: { [key: string]: Function };
  }

  interface App {
    mount(el: Element | string): void;
    unmount(): void;
  }

  export function createApp(options: ComponentOptions): App;
}
