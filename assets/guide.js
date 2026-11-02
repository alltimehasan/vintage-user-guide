// Help guide behaviour: the light/dark switch, the contents list that follows the page, screenshots that open full
// size, copy-a-link on headings, and a search across both guides (it reads the other guide over the network, so on a
// file:// copy it searches the open page only).
(() => {
  const root = document.documentElement;
  const THEME_KEY = 'vwg-guide-theme';
  const PAGES = [
    { url: 'admin.html', label: 'Shop team guide' },
    { url: 'customers.html', label: 'Customer help' },
  ];

  // Light and dark: follows the device until the switch is used.
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : prefersDark.matches);
  const themeButtons = document.querySelectorAll('[data-theme-toggle]');
  const syncThemeButtons = () => themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(isDark()));
    button.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  });
  themeButtons.forEach((button) => button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      if ((next === 'dark') === prefersDark.matches) {
        localStorage.removeItem(THEME_KEY);
        delete root.dataset.theme;
      } else {
        localStorage.setItem(THEME_KEY, next);
      }
    } catch (error) { /* storage blocked: the choice lasts for this page only */ }
    syncThemeButtons();
  }));
  prefersDark.addEventListener('change', syncThemeButtons);
  syncThemeButtons();

  // Screenshots open full size in a dialog.
  const zoom = document.getElementById('zoom');
  if (zoom) {
    const zoomImage = zoom.querySelector('img');
    const zoomCaption = zoom.querySelector('[data-zoom-caption]');
    document.querySelectorAll('figure.shot button').forEach((button) => button.addEventListener('click', () => {
      const image = button.querySelector('img');
      zoomImage.src = image.currentSrc || image.src;
      zoomImage.alt = image.alt;
      zoomCaption.textContent = button.closest('figure').querySelector('figcaption')?.textContent ?? '';
      zoom.showModal();
    }));
    zoom.addEventListener('click', (event) => { if (event.target === zoom || event.target === zoomImage) zoom.close(); });
  }

  // Copy a link to a section.
  document.querySelectorAll('.anchor').forEach((link) => link.addEventListener('click', async (event) => {
    event.preventDefault();
    const url = new URL(link.getAttribute('href'), location.href).href;
    history.replaceState(null, '', link.getAttribute('href'));
    try {
      await navigator.clipboard.writeText(url);
      link.textContent = 'Link copied';
    } catch (error) {
      link.textContent = 'Link in the address bar';
    }
    setTimeout(() => { link.textContent = 'Copy link'; }, 2000);
  }));

  // The contents list marks the section being read.
  const tocLinks = new Map([...document.querySelectorAll('.toc a[href^="#"]')].map((link) => [link.getAttribute('href').slice(1), link]));
  if (tocLinks.size && 'IntersectionObserver' in window) {
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id)));
      const current = [...tocLinks.keys()].find((id) => visible.has(id));
      if (current) tocLinks.forEach((link, id) => link.setAttribute('aria-current', String(id === current)));
    }, { rootMargin: '-80px 0px -60% 0px' });
    tocLinks.forEach((link, id) => { const section = document.getElementById(id); if (section) observer.observe(section); });
  }

  // Search across both guides.
  const dialog = document.getElementById('search');
  if (!dialog) return;
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('.search-results');
  const here = location.pathname.split('/').pop() || 'index.html';
  let index = null;
  let selected = -1;

  // The readable text of an element: its paragraphs, list items, table cells and captions, each separated by a space.
  const BLOCKS = 'p, li, th, td, summary, figcaption';
  const textOf = (element) => {
    const blocks = element.matches(BLOCKS) ? [element] : [...element.querySelectorAll(BLOCKS)].filter((node) => !node.parentElement.closest(BLOCKS));
    return blocks.map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
  };

  const sectionsOf = (doc, page) => [...doc.querySelectorAll('section.topic[id]')].flatMap((section) => {
    const title = section.querySelector('h2')?.textContent.trim() ?? '';
    const entries = [{ page, id: section.id, title, text: textOf(section) }];
    section.querySelectorAll('h3[id], details.faq[id]').forEach((part) => {
      const heading = part.matches('details') ? part.querySelector('summary').textContent.trim() : part.textContent.trim();
      const parts = part.matches('details') ? [textOf(part.querySelector('div'))] : [];
      for (let node = part.nextElementSibling; node && !node.matches('h3, details.faq'); node = node.nextElementSibling) parts.push(textOf(node));
      entries.push({ page, id: part.id, title: `${title}: ${heading}`, text: parts.join(' ').trim(), sub: true });
    });
    return entries;
  });

  const buildIndex = async () => {
    if (index) return index;
    const pages = await Promise.all(PAGES.map(async (page) => {
      if (page.url === here) return sectionsOf(document, page);
      try {
        const response = await fetch(page.url);
        if (!response.ok) return [];
        return sectionsOf(new DOMParser().parseFromString(await response.text(), 'text/html'), page);
      } catch (error) {
        return [];
      }
    }));
    index = pages.flat();
    return index;
  };

  const escape = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const highlight = (text, words) => words.reduce((html, word) => html.replace(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>'), escape(text));

  const render = async () => {
    const query = input.value.trim().toLowerCase();
    const words = query.split(/\s+/).filter((word) => word.length > 1);
    if (!words.length) { results.innerHTML = '<li class="search-empty">Type what you are looking for, for example <em>refund</em>, <em>photos</em> or <em>password</em>.</li>'; selected = -1; return; }
    const found = (await buildIndex()).map((entry) => {
      const title = entry.title.toLowerCase();
      const text = entry.text.toLowerCase();
      if (!words.every((word) => title.includes(word) || text.includes(word))) return null;
      const score = words.reduce((sum, word) => sum + (title.includes(word) ? 10 : 0) + Math.min(5, text.split(word).length - 1), 0) + (entry.sub ? 2 : 0);
      const at = Math.max(0, text.indexOf(words[0]) - 60);
      const snippet = (at > 0 ? '…' : '') + entry.text.slice(at, at + 160).trim() + '…';
      return { ...entry, score, snippet };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12);
    selected = found.length ? 0 : -1;
    results.innerHTML = found.length
      ? found.map((entry, i) => `<li><a href="${entry.page.url === here ? '' : entry.page.url}#${entry.id}" aria-selected="${i === 0}"><span class="where">${escape(entry.page.label)}</span><span class="title">${highlight(entry.title, words)}</span><span class="snip">${highlight(entry.snippet, words)}</span></a></li>`).join('')
      : `<li class="search-empty">Nothing found for “${escape(input.value.trim())}”. Try a shorter word.</li>`;
  };

  const move = (step) => {
    const links = [...results.querySelectorAll('a')];
    if (!links.length) return;
    selected = (selected + step + links.length) % links.length;
    links.forEach((link, i) => link.setAttribute('aria-selected', String(i === selected)));
    links[selected].scrollIntoView({ block: 'nearest' });
  };

  const open = () => { dialog.showModal(); input.select(); render(); };
  document.querySelectorAll('[data-search-open]').forEach((button) => button.addEventListener('click', open));
  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
    if ((event.key === '/' && !typing) || (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) { event.preventDefault(); open(); }
  });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    if (event.key === 'Enter') { const link = results.querySelectorAll('a')[selected]; if (link) { event.preventDefault(); link.click(); } }
  });
  results.addEventListener('click', (event) => { if (event.target.closest('a')) dialog.close(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
})();
