<div class="page-wrapper">
<link rel="preload" href="assets/faq.css" as="style" onload="this.rel='stylesheet'">
<!-- FAQ Page -->

<!-- ═══ Search + Content (shared state for filtering) ═══ -->
<div state="{ search: '' }">

  <!-- Sidebar + Content -->
  <div class="doc-with-sidebar faq-page">

    <!-- Sidebar -->
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <div class="sidebar-group">
          <div class="sidebar-group-title" t="faq.sidebar.questions"></div>
          <a href="#getting-started" class="sidebar-link" t="faq.sidebar.gettingStarted"></a>
          <a href="#core-concepts" class="sidebar-link" t="faq.sidebar.coreConcepts"></a>
          <a href="#comparisons" class="sidebar-link" t="faq.sidebar.comparisons"></a>
          <a href="#security" class="sidebar-link" t="faq.sidebar.security"></a>
        </div>
        <div class="sidebar-group">
          <div class="sidebar-group-title" t="faq.sidebar.resources"></div>
          <a route="/docs" class="sidebar-link" t="faq.sidebar.documentation"></a>
          <a route="/examples" class="sidebar-link" t="faq.sidebar.examples"></a>
          <a href="https://github.com/ErickXavier/no-js/discussions" target="_blank" class="sidebar-link" t="faq.sidebar.discussions"></a>
        </div>
      </nav>
    </aside>

    <!-- Content -->
    <div class="doc-main">

      <!-- ═══ Hero ═══ -->
      <section class="hero-section">
        <span class="badge" t="faq.hero.badge"></span>
        <h1 class="hero-title" t="faq.hero.title"></h1>
        <p class="hero-subtitle" t="faq.hero.subtitle"></p>
      </section>

      <!-- FAQ Content -->
      <div class="doc-content faq-content">

      <!-- Search Bar -->
      <section class="faq-search-section">
        <div class="faq-search-container">
          <div class="faq-search-bar">
            <svg class="faq-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="faq-search-input" model="search" bind-placeholder="$i18n.t('faq.search.placeholder')">
          </div>
        </div>
      </section>

      <!-- Getting Started -->
      <section id="getting-started" class="faq-category" faq-filter>
        <h2 class="faq-category-title" t="faq.gettingStarted.title"></h2>
        <div class="faq-list">
          <details class="faq-item" faq-filter="faq.gettingStarted.q1.question">
            <summary class="faq-question"><span t="faq.gettingStarted.q1.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.gettingStarted.q1.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.gettingStarted.q2.question">
            <summary class="faq-question"><span t="faq.gettingStarted.q2.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.gettingStarted.q2.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.gettingStarted.q3.question">
            <summary class="faq-question"><span t="faq.gettingStarted.q3.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.gettingStarted.q3.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.gettingStarted.q4.question">
            <summary class="faq-question"><span t="faq.gettingStarted.q4.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.gettingStarted.q4.answer" t-html></div>
          </details>
        </div>
      </section>

      <!-- Core Concepts -->
      <section id="core-concepts" class="faq-category" faq-filter>
        <h2 class="faq-category-title" t="faq.coreConcepts.title"></h2>
        <div class="faq-list">
          <details class="faq-item" faq-filter="faq.coreConcepts.q5.question">
            <summary class="faq-question"><span t="faq.coreConcepts.q5.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.coreConcepts.q5.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.coreConcepts.q6.question">
            <summary class="faq-question"><span t="faq.coreConcepts.q6.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.coreConcepts.q6.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.coreConcepts.q7.question">
            <summary class="faq-question"><span t="faq.coreConcepts.q7.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.coreConcepts.q7.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.coreConcepts.q8.question">
            <summary class="faq-question"><span t="faq.coreConcepts.q8.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.coreConcepts.q8.answer" t-html></div>
          </details>
        </div>
      </section>

      <!-- Comparisons -->
      <section id="comparisons" class="faq-category" faq-filter>
        <h2 class="faq-category-title" t="faq.comparisons.title"></h2>
        <div class="faq-list">
          <details class="faq-item" faq-filter="faq.comparisons.q9.question">
            <summary class="faq-question"><span t="faq.comparisons.q9.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.comparisons.q9.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.comparisons.q10.question">
            <summary class="faq-question"><span t="faq.comparisons.q10.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.comparisons.q10.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.comparisons.q11.question">
            <summary class="faq-question"><span t="faq.comparisons.q11.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.comparisons.q11.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.comparisons.q12.question">
            <summary class="faq-question"><span t="faq.comparisons.q12.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.comparisons.q12.answer" t-html></div>
          </details>
        </div>
      </section>

      <!-- Security & Production -->
      <section id="security" class="faq-category" faq-filter>
        <h2 class="faq-category-title" t="faq.security.title"></h2>
        <div class="faq-list">
          <details class="faq-item" faq-filter="faq.security.q13.question">
            <summary class="faq-question"><span t="faq.security.q13.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.security.q13.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.security.q14.question">
            <summary class="faq-question"><span t="faq.security.q14.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.security.q14.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.security.q15.question">
            <summary class="faq-question"><span t="faq.security.q15.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.security.q15.answer" t-html></div>
          </details>
          <details class="faq-item" faq-filter="faq.security.q16.question">
            <summary class="faq-question"><span t="faq.security.q16.question"></span><span class="faq-chevron"></span></summary>
            <div class="faq-answer" t="faq.security.q16.answer" t-html></div>
          </details>
        </div>
      </section>

      </div><!-- /doc-content faq-content -->
    </div><!-- /doc-main -->
  </div><!-- /doc-with-sidebar -->
</div><!-- /state wrapper -->

<!-- ═══ CTA ═══ -->
<section class="cta-section">
  <h2 class="cta-title" t="faq.cta.title"></h2>
  <p class="cta-subtitle" t="faq.cta.subtitle"></p>
  <div class="cta-buttons">
    <a route="/docs" class="btn btn-cta-primary" t="faq.cta.docs"></a>
    <a href="https://github.com/ErickXavier/no-js/discussions" target="_blank" class="btn btn-cta-secondary" t="faq.cta.discussions"></a>
  </div>
</section>
</div>
