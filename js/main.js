'use strict';

/**
 * Switch between local dev and production backend.
 * On GitHub Pages the env var isn't available — use the deployed Render URL.
 * Replace the placeholder with your real Render URL before deploying.
 */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : 'https://flora-backend-7ep6.onrender.com/api'; // ← replace with real URL

const LIMIT = 6;

/* ─── Inject SVG sprite ───────────────────────────────────── */
(async function injectSprite() {
  try {
    const res = await fetch('icons/icons.svg');
    if (!res.ok) throw new Error(`Sprite fetch failed: ${res.status}`);
    const text = await res.text();
    const wrapper = document.createElement('div');
    wrapper.style.display = 'none';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = text;
    document.body.insertBefore(wrapper, document.body.firstChild);
  } catch (err) {
    console.error('Could not load icons.svg sprite:', err);
  }
})();

/* ─── Mobile Menu ─────────────────────────────────────────── */
const burgerBtn   = document.querySelector('.burger');
const closeBtn    = document.querySelector('.mobile-menu__close');
const mobileMenu  = document.querySelector('.mobile-menu');
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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (mobileMenu.classList.contains('is-open')) closeMenu();
  }
});
mobileMenu.addEventListener('click', e => { if (e.target === mobileMenu) closeMenu(); });

/* ─── Slider ──────────────────────────────────────────────── */
function initSlider(sliderEl, opts = {}) {
  if (!sliderEl) return;
  const track = sliderEl.querySelector('.slider__track, .feedback__track');
  const dots  = sliderEl.querySelectorAll('.slider__dot');
  const prev  = sliderEl.querySelector('[data-dir="prev"]');
  const next  = sliderEl.querySelector('[data-dir="next"]');
  if (!track || !track.children.length) return;

  let idx = 0;
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
    const card = track.children[0];
    const cardW = card.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 24;
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

  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = startX - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) goTo(dx > 0 ? idx + 1 : idx - 1);
  }, { passive: true });

  let resizeId;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => { perView = calcPerView(); goTo(Math.min(idx, maxIdx())); }, 150);
  });
  goTo(0);
}
initSlider(document.querySelector('.feedback .feedback__slider'), { mobile: 1, tablet: 2, desktop: 3 });

/* ─── Modals ──────────────────────────────────────────────── */
function openModal(modalEl) {
  modalEl.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  const first = modalEl.querySelector('button, input, textarea, [tabindex]');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal(modalEl) {
  modalEl.classList.remove('is-open');
  document.body.style.overflow = '';
}
function bindModalClose(modalEl) {
  modalEl.querySelector('.modal__close')?.addEventListener('click', () => closeModal(modalEl));
  modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(modalEl); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalEl.classList.contains('is-open')) closeModal(modalEl);
  });
}

const productModal = document.getElementById('product-modal');
bindModalClose(productModal);

function openProductModal(bouquet) {
  const img    = productModal.querySelector('.product-modal__img');
  const name   = productModal.querySelector('.product-modal__name');
  const price  = productModal.querySelector('.product-modal__price');
  const desc   = productModal.querySelector('.product-modal__desc');
  const buyBtn = productModal.querySelector('.product-modal__buy-btn');
  const qty    = productModal.querySelector('.product-modal__qty');

  // Backend uses photoURL; frontend images folder as fallback
  img.src    = bouquet.photoURL || `./images/${bouquet.image}@1x.png`;
  img.srcset = bouquet.photoURL ? '' : `./images/${bouquet.image}@2x.png 2x`;
  img.alt    = bouquet.title || bouquet.name;
  name.textContent  = bouquet.title || bouquet.name;
  price.textContent = `$${bouquet.price}`;
  desc.textContent  = bouquet.description;
  if (qty) qty.value = 1;

  buyBtn.onclick = () => { closeModal(productModal); openModal(orderModal); };
  openModal(productModal);
}

const orderModal = document.getElementById('order-modal');
bindModalClose(orderModal);
const orderForm = orderModal.querySelector('#order-form');
orderForm.addEventListener('submit', e => {
  e.preventDefault();
  closeModal(orderModal);
  orderForm.reset();
  alert('Order submitted! We will contact you soon.');
});

/* ─── App state ───────────────────────────────────────────── */
const state = { page: 1, category: '', search: '', hasMore: true, loading: false };

/* ─── Card template ───────────────────────────────────────── */
function cardHTML(b, modifier) {
  const cls  = modifier ? `bouquet-card ${modifier}` : 'bouquet-card';
  const img  = b.photoURL || `./images/${b.image || 'product1/mixed-flower-bouquet-wooden-table'}@1x.png`;
  const img2 = b.photoURL ? '' : `srcset="./images/${b.image || 'product1/mixed-flower-bouquet-wooden-table'}@2x.png 2x"`;
  const name = b.title || b.name;
  return `
    <article class="${cls}" data-id="${b.id}" style="cursor:pointer">
      <div class="bouquet-card__img-wrap">
        <img class="bouquet-card__img" src="${img}" ${img2} alt="${name}" width="600" height="450" loading="lazy"/>
      </div>
      <h3 class="bouquet-card__name">${name}</h3>
      <p class="bouquet-card__desc">${b.description}</p>
      <p class="bouquet-card__price">$${b.price}</p>
    </article>`;
}

/* ─── Bestsellers ─────────────────────────────────────────── */
async function loadBestsellers() {
  const track    = document.querySelector('.bestsellers .slider__track');
  const dotsWrap = document.querySelector('.bestsellers .slider__dots');
  if (!track) return;
  try {
    const res  = await axios.get(`${API_BASE}/bouquets`, { params: { category: 'bestseller', limit: 6 } });
    const list = res.data.data;
    track.innerHTML    = list.map(b => cardHTML(b)).join('');
    dotsWrap.innerHTML = list.map((_, i) =>
      `<button class="slider__dot${i === 0 ? ' is-active' : ''}" type="button" aria-label="Go to slide ${i + 1}"></button>`
    ).join('');
    track.querySelectorAll('.bouquet-card').forEach((el, i) =>
      el.addEventListener('click', () => openProductModal(list[i]))
    );
    initSlider(document.querySelector('.bestsellers .slider'), { mobile: 1, tablet: 2, desktop: 3 });
  } catch {
    track.innerHTML = '<p class="api-error">Could not load bestsellers. Start the backend: <code>npm run dev</code></p>';
  }
}

/* ─── Catalogue ───────────────────────────────────────────── */
const bouquetsGrid = document.querySelector('.bouquets__grid');
const loadMoreBtn  = document.querySelector('.js-load-more');
const emptyMsg     = document.querySelector('.bouquets__empty');
const filterBtns   = document.querySelectorAll('.js-filter-btn');
const searchInput  = document.querySelector('.js-search');

async function fetchBouquets({ replace = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  const params = { page: state.page, limit: LIMIT };
  if (state.category) params.category = state.category;
  if (state.search)   params.search   = state.search;

  try {
    const res = await axios.get(`${API_BASE}/bouquets`, { params });
    const { data, hasMore } = res.data;
    if (replace) bouquetsGrid.innerHTML = '';

    if (!data.length && state.page === 1) {
      if (emptyMsg) emptyMsg.hidden = false;
      if (loadMoreBtn) loadMoreBtn.hidden = true;
    } else {
      if (emptyMsg) emptyMsg.hidden = true;
      const frag = document.createDocumentFragment();
      data.forEach(b => {
        const li = document.createElement('li');
        li.innerHTML = cardHTML(b, 'bouquet-card--grid');
        li.querySelector('.bouquet-card').addEventListener('click', () => openProductModal(b));
        frag.appendChild(li);
      });
      bouquetsGrid.appendChild(frag);
      state.hasMore = hasMore;
      if (loadMoreBtn) { loadMoreBtn.hidden = !hasMore; loadMoreBtn.disabled = false; }
    }
  } catch {
    if (replace) bouquetsGrid.innerHTML =
      '<li class="api-error" style="grid-column:1/-1;padding:24px;text-align:center">Could not load bouquets. Start the backend: <code>npm run dev</code></li>';
  } finally {
    state.loading = false;
  }
}

if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => { state.page += 1; fetchBouquets(); });

filterBtns.forEach(btn => btn.addEventListener('click', () => {
  filterBtns.forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  state.category = btn.dataset.category || '';
  state.page = 1;
  fetchBouquets({ replace: true });
}));

let searchDebounce;
searchInput?.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    fetchBouquets({ replace: true });
  }, 400);
});

/* ─── Init ────────────────────────────────────────────────── */
loadBestsellers();
fetchBouquets({ replace: true });
