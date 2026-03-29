// ═══════════════════════════════════════════════════════════════════════
//  WASM LOADER & ENGINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════

let _wasm = null;
let _wasm_loading = null;

/**
 * Returns the engine instance if it's already loaded.
 */
export function getEngine() {
	return _wasm;
}

/**
 * Lazy-loads the No.JS Native Engine.
 */
export async function _initWasm() {
	if (_wasm) return _wasm;
	if (_wasm_loading) return _wasm_loading;

	_wasm_loading = (async () => {
		try {
			let bytes;
			// NATIVE_BIN is injected during build as a base64 string
			if (typeof NATIVE_BIN !== "undefined") {
				const binaryString = atob(NATIVE_BIN);
				bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
			} else {
				const response = await fetch("/wasm/nojs-core.wasm");
				bytes = await response.arrayBuffer();
			}

			const { instance } = await WebAssembly.instantiate(bytes);
			_wasm = instance.exports;
			console.log("[No.JS Native] Engine initialized (v" + _wasm.get_version() + ")");
			return _wasm;
		} catch (e) {
			console.warn("[No.JS Native] Falling back to JS.", e);
			return null;
		}
	})();

	return _wasm_loading;
}
