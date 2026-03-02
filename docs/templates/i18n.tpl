<!-- i18n — from i18n.md -->

<section class="hero-section">
  <span class="badge">Guides</span>
  <h1 class="hero-title">Internationalization (i18n)</h1>
  <p class="hero-subtitle">Multi-language support with translations, pluralization, and locale-aware formatting</p>
</section>

<div class="doc-content">

  <!-- Setup -->
  <div class="doc-section">
    <h2 class="doc-title">Setup</h2>
    <div class="code-block"><pre><span class="hl-tag">&lt;script&gt;</span>
  <span class="hl-fn">NoJS</span>.<span class="hl-fn">i18n</span>({
    <span class="hl-attr">defaultLocale</span>: <span class="hl-str">'en'</span>,
    <span class="hl-attr">locales</span>: {
      <span class="hl-attr">en</span>: {
        <span class="hl-attr">welcome</span>: <span class="hl-str">'Welcome to No.JS'</span>,
        <span class="hl-attr">greeting</span>: <span class="hl-str">'Hello, {name}!'</span>,
        <span class="hl-attr">items</span>: <span class="hl-str">'{count} item | {count} items'</span>,  <span class="hl-cmt">// Pluralization</span>
        <span class="hl-attr">nav</span>: { <span class="hl-attr">home</span>: <span class="hl-str">'Home'</span>, <span class="hl-attr">docs</span>: <span class="hl-str">'Documentation'</span> }
      },
      <span class="hl-attr">es</span>: {
        <span class="hl-attr">welcome</span>: <span class="hl-str">'Bienvenido a No.JS'</span>,
        <span class="hl-attr">greeting</span>: <span class="hl-str">'¡Hola, {name}!'</span>,
        <span class="hl-attr">items</span>: <span class="hl-str">'{count} elemento | {count} elementos'</span>,
        <span class="hl-attr">nav</span>: { <span class="hl-attr">home</span>: <span class="hl-str">'Inicio'</span>, <span class="hl-attr">docs</span>: <span class="hl-str">'Documentación'</span> }
      },
      <span class="hl-attr">fr</span>: {
        <span class="hl-attr">welcome</span>: <span class="hl-str">'Bienvenue sur No.JS'</span>,
        <span class="hl-attr">greeting</span>: <span class="hl-str">'Bonjour, {name} !'</span>,
        <span class="hl-attr">items</span>: <span class="hl-str">'{count} élément | {count} éléments'</span>,
        <span class="hl-attr">nav</span>: { <span class="hl-attr">home</span>: <span class="hl-str">'Accueil'</span>, <span class="hl-attr">docs</span>: <span class="hl-str">'Documentation'</span> }
      },
      <span class="hl-attr">pt</span>: {
        <span class="hl-attr">welcome</span>: <span class="hl-str">'Bem-vindo ao No.JS'</span>,
        <span class="hl-attr">greeting</span>: <span class="hl-str">'Olá, {name}!'</span>,
        <span class="hl-attr">items</span>: <span class="hl-str">'{count} item | {count} itens'</span>,
        <span class="hl-attr">nav</span>: { <span class="hl-attr">home</span>: <span class="hl-str">'Início'</span>, <span class="hl-attr">docs</span>: <span class="hl-str">'Documentação'</span> }
      }
    }
  });
<span class="hl-tag">&lt;/script&gt;</span></pre></div>
  </div>

  <!-- Usage -->
  <div class="doc-section">
    <h2 class="doc-title">Usage</h2>
    <div class="code-block"><pre><span class="hl-cmt">&lt;!-- Simple translation --&gt;</span>
<span class="hl-tag">&lt;h1</span> <span class="hl-attr">t</span>=<span class="hl-str">"welcome"</span><span class="hl-tag">&gt;&lt;/h1&gt;</span>
<span class="hl-cmt">&lt;!-- Output: "Welcome to No.JS" / "Bienvenido a No.JS" / "Bienvenue sur No.JS" --&gt;</span>

<span class="hl-cmt">&lt;!-- Interpolation --&gt;</span>
<span class="hl-tag">&lt;h1</span> <span class="hl-attr">t</span>=<span class="hl-str">"greeting"</span> <span class="hl-attr">t-name</span>=<span class="hl-str">"user.name"</span><span class="hl-tag">&gt;&lt;/h1&gt;</span>
<span class="hl-cmt">&lt;!-- Output: "Hello, John!" / "¡Hola, John!" / "Bonjour, John !" / "Olá, John!" --&gt;</span>

<span class="hl-cmt">&lt;!-- Nested keys --&gt;</span>
<span class="hl-tag">&lt;a</span> <span class="hl-attr">route</span>=<span class="hl-str">"/"</span> <span class="hl-attr">t</span>=<span class="hl-str">"nav.home"</span><span class="hl-tag">&gt;&lt;/a&gt;</span>

<span class="hl-cmt">&lt;!-- Pluralization --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">t</span>=<span class="hl-str">"items"</span> <span class="hl-attr">t-count</span>=<span class="hl-str">"cart.items.length"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>
<span class="hl-cmt">&lt;!-- Output: "1 item" or "5 items" --&gt;</span>

<span class="hl-cmt">&lt;!-- Switch locale --&gt;</span>
<span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'es'"</span><span class="hl-tag">&gt;</span>Español<span class="hl-tag">&lt;/button&gt;</span>
<span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'en'"</span><span class="hl-tag">&gt;</span>English<span class="hl-tag">&lt;/button&gt;</span>
<span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'pt'"</span><span class="hl-tag">&gt;</span>Português<span class="hl-tag">&lt;/button&gt;</span>

<span class="hl-cmt">&lt;!-- Current locale --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"$i18n.locale"</span><span class="hl-tag">&gt;&lt;/span&gt;</span></pre></div>
  </div>

  <!-- Number & Date Formatting -->
  <div class="doc-section">
    <h2 class="doc-title">Number &amp; Date Formatting</h2>
    <div class="code-block"><pre><span class="hl-cmt">&lt;!-- Currency --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"price | currency"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>           <span class="hl-cmt">&lt;!-- $1,234.56 --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"price | currency:'BRL'"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>     <span class="hl-cmt">&lt;!-- R$ 1.234,56 --&gt;</span>

<span class="hl-cmt">&lt;!-- Date --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"createdAt | date"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>            <span class="hl-cmt">&lt;!-- 02/25/2026 --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"createdAt | date:'long'"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>     <span class="hl-cmt">&lt;!-- February 25, 2026 --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"createdAt | datetime"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>        <span class="hl-cmt">&lt;!-- 02/25/2026 3:45 PM --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"createdAt | relative"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>        <span class="hl-cmt">&lt;!-- 2 hours ago --&gt;</span>

<span class="hl-cmt">&lt;!-- Number --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"value | number"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>              <span class="hl-cmt">&lt;!-- 1,235 (default: 0 decimals) --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"value | number:2"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>            <span class="hl-cmt">&lt;!-- 1,234.56 --&gt;</span>
<span class="hl-tag">&lt;span</span> <span class="hl-attr">bind</span>=<span class="hl-str">"value | percent"</span><span class="hl-tag">&gt;&lt;/span&gt;</span>             <span class="hl-cmt">&lt;!-- 45% --&gt;</span></pre></div>
  </div>

  <!-- Live Demo -->
  <div class="doc-section">
    <h2 class="doc-title">Live Demo — Locale Switcher</h2>
    <div class="demo-split">
      <div class="demo-code">
        <div class="code-block"><pre><span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'en'"</span><span class="hl-tag">&gt;</span>EN<span class="hl-tag">&lt;/button&gt;</span>
<span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'es'"</span><span class="hl-tag">&gt;</span>ES<span class="hl-tag">&lt;/button&gt;</span>
<span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'fr'"</span><span class="hl-tag">&gt;</span>FR<span class="hl-tag">&lt;/button&gt;</span>
<span class="hl-tag">&lt;button</span> <span class="hl-attr">on:click</span>=<span class="hl-str">"$i18n.locale = 'pt'"</span><span class="hl-tag">&gt;</span>PT<span class="hl-tag">&lt;/button&gt;</span>
<span class="hl-tag">&lt;h2</span> <span class="hl-attr">t</span>=<span class="hl-str">"welcome"</span><span class="hl-tag">&gt;&lt;/h2&gt;</span>
<span class="hl-tag">&lt;p</span> <span class="hl-attr">t</span>=<span class="hl-str">"greeting"</span> <span class="hl-attr">t-name</span>=<span class="hl-str">"'World'"</span><span class="hl-tag">&gt;&lt;/p&gt;</span></pre></div>
      </div>
      <div class="demo-preview">
        <span class="demo-result-label">Result</span>
        <div state="{ lang: 'pt' }">
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button class="btn btn-sm" class-btn-primary="lang === 'en'" class-btn-secondary="lang !== 'en'" on:click="lang = 'en'; $i18n.locale = 'en'">EN</button>
            <button class="btn btn-sm" class-btn-primary="lang === 'es'" class-btn-secondary="lang !== 'es'" on:click="lang = 'es'; $i18n.locale = 'es'">ES</button>
            <button class="btn btn-sm" class-btn-primary="lang === 'fr'" class-btn-secondary="lang !== 'fr'" on:click="lang = 'fr'; $i18n.locale = 'fr'">FR</button>
            <button class="btn btn-sm" class-btn-primary="lang === 'pt'" class-btn-secondary="lang !== 'pt'" on:click="lang = 'pt'; $i18n.locale = 'pt'">PT</button>
          </div>
          <h3 t="welcome" style="margin-bottom: 8px;"></h3>
          <p t="greeting" t-name="'World'" style="color: var(--text-muted);"></p>
          <p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-dim);">Locale: <span bind="lang"></span></p>
        </div>
      </div>
    </div>
  </div>

</div>