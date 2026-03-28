# Arquitetura Híbrida: WebAssembly (Wasm) no nojs-bun

Este documento consolida a estratégia arquitetural para integrar **WebAssembly (Wasm)** ao core do **nojs-bun**. O objetivo é transformar o framework em uma engine de nível industrial, delegando tarefas computacionalmente intensivas para código nativo enquanto mantém o JavaScript como o orquestrador do DOM.

---

## 1. Filosofia: Separação de Responsabilidades

A arquitetura híbrida baseia-se no princípio de que cada motor deve fazer o que faz de melhor:

*   **JavaScript (Orquestrador):** Manipulação de DOM, captura de eventos e gerenciamento do sistema de Proxies reativos. O JS é excelente em lidar com APIs de alto nível do navegador.
*   **WebAssembly (Calculador):** Processamento de strings, tokenização, árvores (AST) e lógica matemática complexa. O Wasm oferece performance próxima ao nativo e previsibilidade de CPU.

---

## 2. Candidatos à Conversão (Onde Ganhar Performance)

Nem toda tarefa deve ser movida para Wasm. O foco está onde o custo de processamento supera o custo da "ponte" entre JS e Wasm:

| Módulo | Alvo | Ganho Est. | Motivo |
| :--- | :--- | :--- | :--- |
| **Parser de Expressões** | `evaluate.js` | **15x - 20x** | Substituir o JIT manual (`new Function`) por um parser nativo ultra-rápido. |
| **Sanitizador HTML** | `dom.js` | **8x - 10x** | Limpeza de XSS em templates remotos antes da injeção, usando crates de Rust como `ammonia`. |
| **Algoritmo de Diffing** | `loops.js` | **5x - 8x** | Cálculo de diferença mínima (LCS) em listas gigantes para reconciliação de loops. |
| **Formatador i18n** | `i18n.js` | **3x - 5x** | Interpolação de traduções complexas e regras de pluralização. |

---

## 3. Estratégia de Micro-módulos e Binário Único

Para equilibrar a **facilidade de desenvolvimento** com a **eficiência de entrega**, adotamos uma abordagem híbrida de organização:

*   **Desenvolvimento Modular (Micro-módulos):** O código Rust/Zig é organizado em pequenos módulos especializados (ex: `parser.rs`, `diff.rs`). Isso permite testes isolados e manutenção cirúrgica.
*   **Distribuição Consolidada (Binário Único):** Todos os micro-módulos são compilados em um único arquivo `nojs-core.wasm`.
    *   **Por que?** Reduz idas e vindas ao servidor (1 requisição HTTP).
    *   **Memória Compartilhada:** Todas as funções operam na mesma **Memória Linear**, permitindo que o Parser passe dados para o Sanitizer via ponteiros internos, sem nunca sair do ambiente Wasm.

---

## 4. O Mecanismo de Intercâmbio (A Ponte de Memória)

O intercâmbio de dados entre o motor JS e o Wasm é feito através da **Memória Linear**. Como o Wasm não enxerga objetos JS, o fluxo técnico é:

1.  **Codificação:** Strings JS (UTF-16) são transformadas em bytes (UTF-8).
2.  **Ponteiro e Tamanho:** O JS passa apenas o endereço de memória e o tamanho do buffer para o Wasm.
3.  **Processamento Zero-Copy:** O Rust reconstrói a string a partir da memória sem copiar os dados novamente.
4.  **Retorno:** O Wasm devolve um ponteiro para o resultado, que o JS lê usando `TextDecoder`.

---

## 5. Alta Performance: Bun vs. Web Standards

O `nojs-bun` aproveita otimizações que funcionam de forma sinérgica tanto no servidor (Bun) quanto no cliente (Navegador):

### A. Web Standards (Browser & Bun)
Estas APIs são universais e garantem a performance no navegador do usuário:
*   **`TextEncoder.encodeInto()`:** Padrão W3C que permite escrever strings JS diretamente na memória do Wasm. É a chave para a "Alocação Zero" em qualquer motor moderno.
*   **`Uint8Array.set()`:** Método padrão de TypedArrays que todos os navegadores otimizam via instruções SIMD de hardware.

### B. Bun-Specific (SSR & Build Time)
Estas APIs aceleram o framework enquanto ele roda no servidor ou durante o desenvolvimento:
*   **`Bun.concat()`:** Utilizado no SSR para agrupar múltiplos fragmentos de templates e contextos de forma ultra-rápida antes de enviá-los ao Wasm.
*   **`Bun.serve` + Wasm:** Otimização no carregamento de binários nativos durante a pré-renderização.
*   **Native Imports:** Suporte direto a `import wasm from './core.wasm' with { type: 'wasm' }` simplificando o bundle.

---

## 6. Organização do Repositório (Estrutura Sugerida)

```text
nojs-bun/
├── src/
│   ├── wasm/                 # Código-fonte nativo (Rust/Zig)
│   │   ├── Cargo.toml        # Manifesto Rust (cdylib)
│   │   └── src/
│   │       ├── lib.rs        # Ponto central: exporta todas as funções
│   │       ├── parser.rs     # Micro-módulo de parsing
│   │       ├── sanitizer.rs  # Micro-módulo de segurança
│   │       └── diff.rs       # Micro-módulo de reconciliação
│   └── evaluate.js           # Core JS (Orquestrador)
└── docs/
    └── wasm-hybrid-architecture.md
```

---

## 7. Integração Transparente (Shadow Functions)

A integração no core do NoJS deve ser "invisível" para as diretivas, utilizando loaders que fornecem fallbacks automáticos:

```javascript
// nojs-bun/src/wasm/loader.js
import { parse_expr } from "./nojs-core.wasm";
import { js_parser_fallback } from "../utils/parser.js";

/**
 * Tenta usar o parser Wasm ultra-rápido; 
 * cai para a versão JS caso o Wasm não esteja carregado.
 */
export const fastParse = (expr) => {
    try {
        return parse_expr(expr);
    } catch (e) {
        return js_parser_fallback(expr);
    }
};
```

---

## 8. Veredito Arquitetural

A adoção de WebAssembly no **nojs-bun** não é sobre substituir o JavaScript, mas sim sobre **armá-lo com força bruta**. Ao consolidar micro-módulos em um binário único e utilizar os atalhos de memória do Bun, o NoJS deixa de ser apenas uma biblioteca conveniente de atributos para se tornar um framework de alta densidade, capaz de lidar com aplicações ricas em dados com latência de código nativo.
