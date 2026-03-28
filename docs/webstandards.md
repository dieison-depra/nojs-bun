# Análise: Conversão para Web Standards (Custom Elements & Shadow DOM)

Esta análise avalia os ganhos técnicos de converter componentes do **nojs-bun** (como o `route-view` ou templates customizados) para padrões nativos da web, considerando que este fork é focado no runtime **Bun**.

## 1. Suporte a Declarative Shadow DOM (DSD) — Ganhos em SSR
Como o `nojs-bun` visa rodar nativamente no Bun, o maior benefício está no **Server-Side Rendering (SSR)**.

*   **Estado Atual:** O NoJS depende de o JavaScript carregar e realizar o scan do DOM (`TreeWalker`) para "ativar" as diretivas, o que pode causar um delay na interatividade (Time to Interactive).
*   **Ganho com Web Standards:** O Bun pode servir o HTML já com as tags `<template shadowrootmode="open">`. O navegador renderiza o componente e seus estilos instantaneamente, antes mesmo do framework terminar de carregar, eliminando o "flash" de conteúdo não estilizado.

## 2. Encapsulamento Real via Shadow DOM
Atualmente, o NoJS lida com estilos de forma global ou via utilitários de classe.

*   **Ganho:** Ao adotar Shadow DOM, ganha-se isolamento de CSS real. Estilos definidos dentro de um componente não vazam para o resto da aplicação, e o CSS global não afeta o componente acidentalmente. Isso elimina a necessidade de seletores complexos e metodologias como BEM.

## 3. Ciclo de Vida Nativo (Lifecycle Hooks)
O gerenciamento manual de limpeza de memória (listeners e proxies) é um ponto sensível no core atual (`src/registry.js`).

*   **Ganho:** Custom Elements possuem os hooks `connectedCallback` e `disconnectedCallback`. O motor do navegador gerencia a entrada e saída de elementos do DOM de forma muito mais performática do que o rastreamento manual via `MutationObserver` ou `TreeWalker`, garantindo que recursos sejam liberados corretamente.

## 4. Interoperabilidade e Reuso
Componentes baseados em atributos são proprietários do ecossistema NoJS.

*   **Ganho:** Ao converter para Custom Elements (ex: `<no-router-view>`), os componentes tornam-se agnósticos. Eles podem ser utilizados em qualquer projeto (React, Vue, ou HTML puro), mantendo sua reatividade interna mas comportando-se como tags HTML padrão.

## 5. Sintaxe de "Slots" Padronizada
O NoJS utiliza lógica própria para templates e transclusão de conteúdo.

*   **Ganho:** O uso da tag `<slot>` nativa é otimizado no nível do motor do navegador (C++), sendo significativamente mais rápido para composição de conteúdo do que a manipulação manual de fragmentos de DOM que o framework realiza hoje em `dom.js`.

---

## Conclusão
Para o objetivo do **nojs-bun** — que é performance extrema no runtime Bun — a migração para **Web Components** é o caminho arquitetural ideal. Ela reduz a carga do "scanner" inicial de DOM e aproveita as otimizações nativas que os navegadores modernos já possuem para componentes desacoplados.
