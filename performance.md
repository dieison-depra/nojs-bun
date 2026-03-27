# Plano de Otimização de Performance: nojs-bun vs. Estado da Arte

> **Nota de Contexto:** Este plano foca em otimizações na camada de **Runtime (Core/Engine)**. Para otimizações na camada de **Build/Compilação (CLI)**, consulte o [Plano de Performance do nojs-cli](../../nojs-cli-bun/docs/performance-nojs-cli.md).

Este documento detalha os gargalos identificados no `nojs-bun` em comparação com frameworks de alta performance (Svelte, SolidJS, Vue 3) e propõe um plano de implementação para atingir métricas competitivas no `js-framework-benchmark`.

## 1. Análise Comparativa e Gargalos

| Recurso | Técnica de Mercado (Svelte/Solid/Vue) | Estado Atual (nojs-bun) | Impacto na Performance |
| :--- | :--- | :--- | :--- |
| **Reatividade** | **Fine-grained (Signals):** Apenas o nó vinculado à variável específica é atualizado. | **Coarse-grained (Proxy):** Notifica *todos* os listeners do contexto se qualquer chave mudar. | **Alto:** Re-avaliações desnecessárias de diretivas não afetadas. |
| **Expressões** | **Pre-compilation:** Atributos viram funções JS puras em tempo de build. | **Runtime AST:** Tokenizer + Parser + Walker executados em tempo real (mesmo com cache). | **Altíssimo:** O custo de percorrer a AST é ~10x maior que executar JS puro. |
| **Eventos** | **Event Delegation:** Um único listener no root gerencia eventos de milhares de itens. | **Individual Listeners:** `addEventListener` para cada elemento/diretiva. | **Médio:** Alto uso de memória e CPU em listas grandes (1.000+ itens). |
| **Loops** | **Keyed Diffing / Block Updates:** Manipulação direta de fragmentos sem wrappers. | **Wrapper-based (`display: contents`):** Cria um `div` extra para cada item do loop. | **Médio:** Aumenta a profundidade do DOM e o custo de layout/recalculo de estilos. |
| **Sanitização** | **Trust-based / Static Sanitization:** Sanitiza apenas uma vez ou confia no build. | **Runtime DOMParser:** Cria um novo documento `HTML` para cada update de `bind-html`. | **Baixo/Médio:** Bloqueia a Main Thread em atualizações frequentes de HTML. |

---

## 2. Plano de Implementação (Priorizado)

### Fase 1: Reatividade de Grão Fino (Fine-Grained)
*   **Mudança:** Alterar o sistema de subscrição para ser baseado em chaves (`Map<Key, Set<Fn>>`) em vez de um `Set` único por contexto.
*   **Arquivos Impactados:** `src/context.js`, `src/globals.js`.
*   **Esforço (1-5):** 3
*   **Ganho Esperado:** Redução de 40-60% no tempo de CPU em componentes com múltiplos bindings.

### Fase 2: JIT Expression Compiler
*   **Mudança:** Em vez de apenas salvar a AST no cache, transformar a AST em uma `new Function('ctx', 'return ...')`.
*   **Arquivos Impactados:** `src/evaluate.js`.
*   **Esforço (1-5):** 4
*   **Ganho Esperado:** Execução de expressões quase instantânea (próxima ao JS nativo).

### Fase 3: Event Delegation Root
*   **Mudança:** Implementar um `GlobalEventManager` que escuta eventos comuns (click, input, change) no `document.body` e despacha para as diretivas via `event.target.closest()`.
*   **Arquivos Impactados:** `src/directives/events.js`, `src/index.js`.
*   **Esforço (1-5):** 2
*   **Ganho Esperado:** Melhora significativa no benchmark de "Criação de 1.000 linhas" (uso de memória).

### Fase 4: Otimização de Loops (Reconciliação Seletiva)
*   **Mudança:** Evitar a re-atualização de metadados `$index`, `$first`, `$last` se a posição do item na lista não mudou. Remover a dependência de wrappers `div` sempre que possível.
*   **Arquivos Impactados:** `src/directives/loops.js`.
*   **Esforço (1-5):** 5
*   **Ganho Esperado:** Melhora em benchmarks de "Troca de linhas" e "Remoção de item".

### Fase 5: Cache de Sanitização e SEO (SSR Bridge)
*   **Mudança:** Criar um cache LRU para strings sanitizadas e adicionar suporte básico para `template shadowing` para facilitar hidratação.
*   **Arquivos Impactados:** `src/dom.js`, `src/directives/binding.js`.
*   **Esforço (1-5):** 2
*   **Ganho Esperado:** Estabilidade em métricas de SEO e redução de lag em `bind-html`.

---

## 3. Resumo de Prioridades para Execução

1.  **Reatividade por Chave (Foundation):** Sem isso, todas as outras otimizações são limitadas pelo broadcast do Proxy.
2.  **JIT Compiler (CPU Killer):** É a mudança mais técnica, mas que remove o maior "freio" do framework.
3.  **Event Delegation (Memory):** Rápido de implementar e resolve problemas de escalabilidade de memória.
4.  **Loop Diffing (Precision):** Crítico para vencer benchmarks específicos de manipulação de lista.

## 4. Métricas de Sucesso
*   Redução do tempo de execução do `loops-benchmark.test.js` em pelo menos 50%.
*   Redução do `Heap Size` no Chrome DevTools após renderizar 10.000 itens.
*   Passar nos testes de regressão de reatividade existente.
