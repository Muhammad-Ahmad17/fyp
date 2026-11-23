/**
 * Minimal in-memory Redis double for the subset the platform uses:
 * streams with consumer groups (XADD, XRANGE, XGROUP CREATE, XREADGROUP, XACK, XPENDING)
 * and pub/sub (PUBLISH, SUBSCRIBE).
 *
 * ioredis-mock does not implement consumer groups, and no Redis server is available
 * in every environment. The same code paths run against a real Redis in
 * test/integration (CI service containers).
 *
 * Several FakeRedis clients created from one server share data, like real connections.
 */

interface Entry {
  id: string;
  fields: string[];
}
interface Group {
  /** index into entries of the next undelivered entry */
  cursor: number;
  /** consumer -> (entry id -> delivery count) */
  pending: Map<string, Map<string, number>>;
}
interface Stream {
  entries: Entry[];
  groups: Map<string, Group>;
}

export class FakeRedisServer {
  readonly streams = new Map<string, Stream>();
  readonly clients = new Set<FakeRedis>();
  private lastMs = 0;
  private seq = 0;

  nextId(): string {
    const ms = Date.now();
    if (ms > this.lastMs) {
      this.lastMs = ms;
      this.seq = 0;
    } else {
      this.seq += 1;
    }
    return `${this.lastMs}-${this.seq}`;
  }

  stream(key: string): Stream {
    let s = this.streams.get(key);
    if (!s) {
      s = { entries: [], groups: new Map() };
      this.streams.set(key, s);
    }
    return s;
  }
}

const cmpId = (a: string, b: string): number => {
  const [am = 0, as = 0] = a.split("-").map(Number);
  const [bm = 0, bs = 0] = b.split("-").map(Number);
  return am - bm || as - bs;
};

type Listener = (channel: string, message: string) => void;

export class FakeRedis {
  private channels = new Set<string>();
  private listeners: Listener[] = [];

  constructor(readonly server: FakeRedisServer = new FakeRedisServer()) {
    server.clients.add(this);
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  disconnect(): void {
    this.server.clients.delete(this);
  }

  /* ----------------------------- streams ---------------------------- */

  async xadd(key: string, ...args: (string | number)[]): Promise<string | null> {
    let i = 0;
    // optional MAXLEN [~] n (trimming is a no-op in the fake)
    if (String(args[i]).toUpperCase() === "MAXLEN") {
      i += 1;
      if (args[i] === "~" || args[i] === "=") i += 1;
      i += 1;
    }
    const idArg = String(args[i]);
    i += 1;
    const rest = args.slice(i).map(String);
    if (rest.length === 0 || rest.length % 2 !== 0) throw new Error("ERR wrong number of arguments for 'xadd' command");
    const id = idArg === "*" ? this.server.nextId() : idArg;
    this.server.stream(key).entries.push({ id, fields: rest });
    return id;
  }

  async xrange(key: string, _start: string, _end: string): Promise<[string, string[]][]> {
    return (this.server.streams.get(key)?.entries ?? []).map((e) => [e.id, e.fields]);
  }

  async xlen(key: string): Promise<number> {
    return this.server.streams.get(key)?.entries.length ?? 0;
  }

  async xgroup(sub: string, key: string, group: string, id: string, ...opts: string[]): Promise<"OK"> {
    if (sub.toUpperCase() !== "CREATE") throw new Error(`ERR unsupported XGROUP subcommand ${sub}`);
    const exists = this.server.streams.has(key);
    if (!exists && !opts.some((o) => o.toUpperCase() === "MKSTREAM")) {
      throw new Error("ERR The XGROUP subcommand requires the key to exist.");
    }
    const stream = this.server.stream(key);
    if (stream.groups.has(group)) throw new Error("BUSYGROUP Consumer Group name already exists");
    stream.groups.set(group, { cursor: id === "$" ? stream.entries.length : 0, pending: new Map() });
    return "OK";
  }

  async xreadgroup(...args: (string | number)[]): Promise<[string, [string, string[]][]][] | null> {
    const a = args.map(String);
    if (a[0]?.toUpperCase() !== "GROUP") throw new Error("ERR syntax error");
    const group = a[1] as string;
    const consumer = a[2] as string;
    let count = Number.POSITIVE_INFINITY;
    let i = 3;
    while (i < a.length && (a[i] as string).toUpperCase() !== "STREAMS") {
      const opt = (a[i] as string).toUpperCase();
      if (opt === "COUNT") count = Number(a[i + 1]);
      i += 2; // COUNT n / BLOCK ms (block is not simulated)
    }
    const rest = a.slice(i + 1);
    const half = rest.length / 2;
    const keys = rest.slice(0, half);
    const ids = rest.slice(half);

    const out: [string, [string, string[]][]][] = [];
    keys.forEach((key, idx) => {
      const stream = this.server.streams.get(key);
      const g = stream?.groups.get(group);
      if (!stream || !g) throw new Error(`NOGROUP No such key '${key}' or consumer group '${group}'`);
      const mine = g.pending.get(consumer) ?? new Map<string, number>();
      g.pending.set(consumer, mine);

      if (ids[idx] === ">") {
        const fresh = stream.entries.slice(g.cursor, g.cursor + Math.min(count, stream.entries.length));
        g.cursor += fresh.length;
        for (const e of fresh) mine.set(e.id, 1);
        if (fresh.length) out.push([key, fresh.map((e) => [e.id, e.fields])]);
      } else {
        const ids2 = [...mine.keys()].sort(cmpId).slice(0, count);
        const entries = ids2.map((id) => stream.entries.find((e) => e.id === id)).filter((e): e is Entry => Boolean(e));
        for (const id of ids2) mine.set(id, (mine.get(id) ?? 1) + 1);
        out.push([key, entries.map((e) => [e.id, e.fields])]);
      }
    });
    const anyNew = args.map(String).includes(">");
    if (anyNew && out.length === 0) return null;
    return out;
  }

  async xack(key: string, group: string, ...ids: string[]): Promise<number> {
    const g = this.server.streams.get(key)?.groups.get(group);
    if (!g) return 0;
    let n = 0;
    for (const m of g.pending.values()) for (const id of ids) if (m.delete(id)) n += 1;
    return n;
  }

  async xpending(key: string, group: string): Promise<[number, string | null, string | null, [string, string][]]> {
    const g = this.server.streams.get(key)?.groups.get(group);
    if (!g) throw new Error(`NOGROUP No such key '${key}' or consumer group '${group}'`);
    const all = [...g.pending.values()].flatMap((m) => [...m.keys()]).sort(cmpId);
    return [all.length, all[0] ?? null, all[all.length - 1] ?? null, []];
  }

  /* ----------------------------- pub/sub ---------------------------- */

  async subscribe(channel: string): Promise<number> {
    this.channels.add(channel);
    return this.channels.size;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.channels.delete(channel);
    return this.channels.size;
  }

  on(event: "message", listener: Listener): this {
    if (event === "message") this.listeners.push(listener);
    return this;
  }

  async publish(channel: string, message: string): Promise<number> {
    let delivered = 0;
    for (const client of this.server.clients) {
      if (!client.channels.has(channel)) continue;
      delivered += 1;
      setImmediate(() => client.listeners.forEach((l) => l(channel, message)));
    }
    return delivered;
  }
}
