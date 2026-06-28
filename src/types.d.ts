// Ambient type declarations for the daskeyboard-applet SDK, which is a
// CommonJS module without bundled type information. Declared here so that
// `tsc --checkJs` can verify our code against the SDK's actual shape.

declare module 'daskeyboard-applet' {
  export interface Point {
    color: string;
    effect: string;
  }

  export interface Signal {
    points: Point[][];
    name?: string;
    message?: string;
    isMuted?: boolean;
    action?: string;
    errors?: string[];
    link?: { url: string; label: string };
    data?: unknown;
  }

  export class DesktopApp {
    pollingInterval: number;
    config: Record<string, any>;
    geometry: { width: number; height: number; origin: { x: number; y: number } };
    authorization: Record<string, any>;
    store: { get(key: string): unknown; put(key: string, value: unknown): void };

    constructor();
    signal(signal: Signal): Promise<unknown>;
    signalError(messages: string[]): Promise<unknown>;
    options(fieldName: string, search?: string): Promise<Array<{ key: string; value: string }>>;
    run(): Promise<Signal | null>;
    applyConfig(): Promise<boolean | void>;
    shutdown(): Promise<unknown>;
  }

  export const Point: {
    new (color: string, effect?: string): Point;
  };

  export const Signal: {
    new (opts: Partial<Signal>): Signal;
    error(messages: string[]): Signal;
  };

  export const Effects: Record<string, string>;

  export const logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
  };

  const q: {
    DesktopApp: typeof DesktopApp;
    Point: typeof Point;
    Signal: typeof Signal;
    Effects: typeof Effects;
    logger: typeof logger;
  };
  export default q;
}
