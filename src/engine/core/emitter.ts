type Handler<T> = (payload: T) => void

/** Minimal typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {}

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const set = (this.handlers[event] ??= new Set())
    set.add(handler)
    return () => set.delete(handler)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.handlers[event]?.forEach((h) => h(payload))
  }
}
