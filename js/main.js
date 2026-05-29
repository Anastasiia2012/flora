'use strict';

/* ─── Mobile Menu ─────────────────────────────────────────── */
const burgerBtn  = document.querySelector('.burger');
const closeBtn   = document.querySelector('.mobile-menu__close');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileLinks = document.querySelectorAll('.mobile-menu__link');

function openMenu() {
  mobileMenu.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  burgerBtn.setAttribute('aria-expanded', 'true');
  closeBtn.focus();
}

function closeMenu() {
  mobileMenu.classList.remove('is-open');
  document.body.style.overflow = '';
  burgerBtn.setAttribute('aria-expanded', 'false');
  burgerBtn.focus();
}

burgerBtn.addEventListener('click', openMenu);
closeBtn.addEventListener('click', closeMenu);
mobileLinks.forEach(link => link.addEventListener('click', closeMenu));

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) closeMenu();
});

// Close on backdrop click (outside the menu content)
mobileMenu.addEventListener('click', e => {
  if (e.target === mobileMenu) closeMenu();
});


/* ─── Slider factory ──────────────────────────────────────── */
function initSlider(sliderEl, opts = {}) {
  if (!sliderEl) return;

  const track  = sliderEl.querySelector('.slider__track, .feedback__track');
  const dots   = sliderEl.querySelectorAll('.slider__dot');
  const prev   = sliderEl.querySelector('[data-dir="prev"]');
  const next   = sliderEl.querySelector('[data-dir="next"]');

  if (!track || !track.children.length) return;

  let idx    = 0;
  let perView = calcPerView();
  const total = track.children.length;

  function calcPerView() {
    const w = window.innerWidth;
    if (w >= 1440) return opts.desktop || 3;
    if (w >= 768)  return opts.tablet  || 2;
    return opts.mobile || 1;
  }

  function maxIdx() { return Math.max(0, total - perView); }

  function goTo(n) {
    idx = Math.max(0, Math.min(n, maxIdx()));

    // Measure card + gap at runtime (respects responsive sizing)
    const card = track.children[0];
    const cardW = card.getBoundingClientRect().width;
    const gap   = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 24;

    track.style.transform = `translateX(-${idx * (cardW + gap)}px)`;

    dots.forEach((d, i) => {
      const active = i === idx;
      d.classList.toggle('is-active', active);
      d.setAttribute('aria-selected', String(active));
    });
  }

  if (prev) prev.addEventListener('click', () => goTo(idx - 1));
  if (next) next.addEventListener('click', () => goTo(idx + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

  // Touch / swipe
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = startX - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) goTo(dx > 0 ? idx + 1 : idx - 1);
  }, { passive: true });

  // Recalculate on resize
  let resizeId;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => {
      perView = calcPerView();
      goTo(Math.min(idx, maxIdx()));
    }, 150);
  });

  goTo(0);
}

// Init both sliders
initSlider(
  document.querySelector('.bestsellers .slider'),
  { mobile: 1, tablet: 2, desktop: 3 }
);
initSlider(
  document.querySelector('.feedback .feedback__slider'),
  { mobile: 1, tablet: 2, desktop: 3 }
);


/* ─── Show More (bouquets) ────────────────────────────────── */
const showMoreBtn = document.querySelector('.js-show-more');
const hiddenCards = document.querySelectorAll('.bouquet-card--hidden');

if (showMoreBtn) {
  if (!hiddenCards.length) {
    // No hidden cards — remove button (all already visible)
    // showMoreBtn.style.display = 'none';
  } else {
    showMoreBtn.addEventListener('click', () => {
      hiddenCards.forEach(c => c.classList.remove('bouquet-card--hidden'));
      showMoreBtn.style.display = 'none';
    });
  }
}
