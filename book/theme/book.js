// pi-atelier 开源书 — 自定义 JavaScript
(function () {
  'use strict';

  // 为底部导航添加文字标签
  function enhanceNavigation() {
    const navWrapper = document.querySelector('.nav-wrapper');
    if (!navWrapper) return;

    // 为桌面端导航按钮添加文字
    const prevBtn = navWrapper.querySelector('a.nav-chapters.previous');
    const nextBtn = navWrapper.querySelector('a.nav-chapters.next');

    if (prevBtn && !prevBtn.querySelector('.nav-text')) {
      const prevText = document.createElement('span');
      prevText.className = 'nav-text';
      prevText.textContent = ' 上一章';
      prevBtn.appendChild(prevText);
    }

    if (nextBtn && !nextBtn.querySelector('.nav-text')) {
      const nextText = document.createElement('span');
      nextText.className = 'nav-text';
      nextText.textContent = '下一章 ';
      nextBtn.insertBefore(nextText, nextBtn.firstChild);
    }
  }

  // 为代码块添加语言标签
  function addCodeLabels() {
    document.querySelectorAll('pre code').forEach(function (block) {
      const classes = block.className.split(' ');
      const langClass = classes.find(c => c.startsWith('language-') || c.startsWith('hljs'));
      if (!langClass) return;

      const lang = langClass.replace('language-', '').replace('hljs ', '');
      if (!lang || lang === 'text') return;

      const label = document.createElement('span');
      label.className = 'code-lang-label';
      label.textContent = lang;
      block.parentElement.style.position = 'relative';
      block.parentElement.appendChild(label);
    });
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      enhanceNavigation();
      addCodeLabels();
    });
  } else {
    enhanceNavigation();
    addCodeLabels();
  }

  // mdBook 页面切换时重新执行（AJAX 导航）
  document.addEventListener('page:loaded', function () {
    enhanceNavigation();
    addCodeLabels();
  });
})();
