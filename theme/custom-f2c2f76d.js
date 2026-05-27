// pi-atelier 开源书 — 自定义 JavaScript
(function () {
  'use strict';

  // ── 为代码块添加语言标签 ──
  function addCodeLabels() {
    document.querySelectorAll('pre code').forEach(function (block) {
      const classes = block.className.split(' ');
      const langClass = classes.find(c => c.startsWith('language-'));
      if (!langClass) return;

      const lang = langClass.replace('language-', '');
      if (!lang || lang === 'text') return;

      const pre = block.parentElement;
      if (!pre || pre.querySelector('.code-lang-label')) return;

      const label = document.createElement('span');
      label.className = 'code-lang-label';
      label.textContent = lang;
      pre.style.position = 'relative';
      pre.appendChild(label);
    });
  }

  // ── 最后更新时间（从页面 meta 或构建日期推断） ──
  function showLastUpdated() {
    const el = document.getElementById('page-footer');
    if (!el) return;

    // 尝试从 git log 信息获取（如果 preprocessor 注入了 meta）
    const meta = document.querySelector('meta[name="last-modified"]');
    if (meta && meta.content) {
      el.textContent = '最后更新: ' + meta.content;
      return;
    }

    // 回退：显示构建年份
    const year = new Date().getFullYear();
    el.innerHTML = '© ' + year + ' pi-atelier contributors · <a href="https://github.com/catlain/pi-atelier" style="color: var(--links)">GitHub</a>';
  }

  // ── 修复代码高亮（确保 hljs 正确应用） ──
  function ensureHighlighting() {
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('pre code:not(.hljs)').forEach(function (block) {
        hljs.highlightElement(block);
      });
    }
  }

  // ── 平滑滚动到锚点 ──
  function smoothScrollAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ── 初始化 ──
  function init() {
    addCodeLabels();
    showLastUpdated();
    ensureHighlighting();
    smoothScrollAnchors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // mdBook 页面切换时重新执行（AJAX 导航）
  if (typeof window !== 'undefined') {
    window.addEventListener('page:loaded', function () {
      init();
    });
  }
})();
