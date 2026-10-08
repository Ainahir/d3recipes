/* tslint:disable */
/* eslint-disable */

/**
 * Loaded game tables; create once, then start any number of searches.
 */
export class Engine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * classes, slots (with per-class availability) and the affix labels, as JSON
     */
    describe(): string;
    constructor(data_json: string);
    search(query_json: string): SearchHandle;
    /**
     * Highest value the first line of each stat family can roll on an item (same keys as `stems`): {stem: max}. Percent
     * stats are fractions, as in `Want::min`. A stat with no roll (a socket) is left out.
     */
    stat_max(_class: number, slot: string, item_id: number): string;
    /**
     * Stat families that can appear on items of a slot for a class, or on one item when `item_id` is not 0: {stem: sample label}
     */
    stems(_class: number, slot: string, item_id: number): string;
}

export class SearchHandle {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    results(): string;
    /**
     * process up to `max_nodes` queue entries; true when finished
     */
    run(max_nodes: number): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_engine_free: (a: number, b: number) => void;
    readonly __wbg_searchhandle_free: (a: number, b: number) => void;
    readonly engine_describe: (a: number) => [number, number];
    readonly engine_new: (a: number, b: number) => [number, number, number];
    readonly engine_search: (a: number, b: number, c: number) => [number, number, number];
    readonly engine_stat_max: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly engine_stems: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly searchhandle_results: (a: number) => [number, number];
    readonly searchhandle_run: (a: number, b: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
