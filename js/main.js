'use strict';

/* ─── Inject external SVG sprite ──────────────────────────────
   Спрайт іконок лежить в icons/icons.svg. Підвантажуємо й
   вставляємо першим елементом <body>, щоб <use href="#icon-…">
   працювали і зберігався currentColor. */
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
    console.error('Could not load icons sprite:', err);
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
if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  mobileLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) closeMenu();
  });
  mobileMenu.addEventListener('click', e => {
    if (e.target === mobileMenu) closeMenu();
  });
}


/* ─── Slider factory ──────────────────────────────────────── */
function initSlider(sliderEl, opts = {}) {
  if (!sliderEl) return;
  const track = sliderEl.querySelector('.slider__track, .feedback__track');
  const dots  = Array.from(sliderEl.querySelectorAll('.slider__dot'));
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

  // Show only as many dots as reachable positions; hide the rest.
  function syncDots() {
    const positions = maxIdx() + 1;
    dots.forEach((d, i) => {
      d.hidden = i >= positions;
      const active = i === idx;
      d.classList.toggle('is-active', active);
      d.setAttribute('aria-selected', String(active));
    });
  }
  // Disable arrows at the boundaries so it's clear you can't scroll further.
  function syncArrows() {
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= maxIdx();
  }

  function goTo(n) {
    idx = Math.max(0, Math.min(n, maxIdx()));
    const card = track.children[0];
    const cardW = card.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 24;
    track.style.transform = `translateX(-${idx * (cardW + gap)}px)`;
    syncDots();
    syncArrows();
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
initSlider(document.querySelector('.bestsellers .slider'), { mobile: 1, tablet: 2, desktop: 3 });


/* ============================================================
   BLOCK 3–4: API, dynamic gallery, filter, pagination
   ============================================================ */

/* ── API config (axios) ───────────────────────────────────── */
const API_BASE = 'https://flora-backend-7ep6.onrender.com/api';
const api = axios.create({ baseURL: API_BASE });

async function fetchBouquets({ page, limit, category }) {
  const params = { page, limit };
  if (category) params.category = category;
  const { data } = await api.get('/bouquets', { params });
  return data; // { data, total, page, perPage, totalPages, hasMore }
}

/* ── Single source of app state ───────────────────────────── */
const state = {
  page: 1,
  limit: 15,        // 15 items per request (Block 4)
  category: '',     // active filter
  total: 0,
  hasMore: false,
  loading: false,
};

/* ── DOM refs ─────────────────────────────────────────────── */
const gallery     = document.querySelector('.js-gallery');
const loadMoreBtn = document.querySelector('.js-load-more');
const loader      = document.querySelector('.js-loader');
const message     = document.querySelector('.js-message');
const filterBtns  = document.querySelectorAll('.filter__btn');

const END_MESSAGE = "We're sorry, but you've reached the end of the collection.";
const EMPTY_MESSAGE = 'No bouquets found for this category.';

/* ── Card template + single insert (insertAdjacentHTML) ───── */
function cardTemplate(b) {
  const src1x = `./images/${b.image}@1.png`;
  const src2x = `./images/${b.image}@2x.png`;
  return `
    <li>
      <article class="bouquet-card bouquet-card--grid js-card" data-id="${b.id}">
        <div class="bouquet-card__img-wrap">
          <img class="bouquet-card__img"
               src="${src1x}" srcset="${src2x} 2x"
               alt="${b.name}" width="600" height="450" loading="lazy"/>
        </div>
        <h3 class="bouquet-card__name">${b.name}</h3>
        <p class="bouquet-card__desc">${b.description}</p>
        <p class="bouquet-card__price">$${b.price}</p>
      </article>
    </li>`;
}
function renderCards(items) {
  const markup = items.map(cardTemplate).join('');
  gallery.insertAdjacentHTML('beforeend', markup); // ONE DOM operation
}

/* ── UI helpers ───────────────────────────────────────────── */
function showLoader(show) { loader.hidden = !show; }
function showLoadMore(show) { loadMoreBtn.hidden = !show; }
function showMessage(text) {
  if (!text) { message.hidden = true; message.textContent = ''; return; }
  message.textContent = text;
  message.hidden = false;
}

/* ── Smooth scroll by two card heights (spec 4) ───────────── */
function smoothScrollByCards() {
  const firstCard = gallery.querySelector('.bouquet-card');
  if (!firstCard) return;
  const { height } = firstCard.getBoundingClientRect();
  window.scrollBy({ top: height * 2, behavior: 'smooth' });
}

/* ── Core loader ──────────────────────────────────────────── */
async function loadPage({ reset = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  showLoadMore(false);
  showLoader(true);
  showMessage('');

  try {
    const res = await fetchBouquets({
      page: state.page,
      limit: state.limit,
      category: state.category,
    });

    state.total = res.total;
    state.hasMore = res.hasMore;

    if (reset) gallery.innerHTML = ''; // clear on new filter — no duplicates

    if (!res.data.length && state.page === 1) {
      showMessage(EMPTY_MESSAGE);
      showLoadMore(false);
      return;
    }

    renderCards(res.data);

    if (state.hasMore) {
      showLoadMore(true);
    } else {
      showLoadMore(false);
      showMessage(END_MESSAGE);
    }

    if (!reset && state.page > 1) smoothScrollByCards();

  } catch (err) {
    console.error('Failed to load bouquets:', err);
    showMessage('Something went wrong while loading bouquets. Is the backend running on http://localhost:3000 ?');
    showLoadMore(state.page > 1);
  } finally {
    state.loading = false;
    showLoader(false);
  }
}

/* ── Load more click → next page ──────────────────────────── */
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    state.page += 1;
    loadPage();
  });
}

/* ── Filter change → reset page to 1, clear list ──────────── */
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const category = btn.dataset.category || '';
    if (category === state.category) return;
    filterBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.category = category;
    state.page = 1;
    loadPage({ reset: true });
  });
});

/* ============================================================
   BLOCK 2: Modals (Product Details + Order) & forms
   ============================================================ */
const productModal   = document.querySelector('.js-product-modal');
const productContent = document.querySelector('.js-product-content');
const orderModal     = document.querySelector('.js-order-modal');
const orderForm      = document.querySelector('.js-order-form');
const subscribeForm  = document.querySelector('.js-subscribe');

let lastFocused = null;
let currentProduct = null; // bouquet currently shown in the product modal
let currentQty = 1;        // chosen quantity

function openModal(modal) {
  lastFocused = document.activeElement;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const focusable = modal.querySelector('.modal__close, input, button');
  if (focusable) focusable.focus();
}
function closeModal(modal) {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal.is-open')) document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

[productModal, orderModal].forEach(modal => {
  if (!modal) return;
  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModal(modal);
  });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.modal.is-open');
  if (open) closeModal(open);
});

/* ── Product Details: open from a dynamic card ────────────── */
async function openProductById(id) {
  try {
    const { data } = await api.get(`/bouquets/${id}`);
    const b = data.data;
    productContent.innerHTML = `
      <div class="product__img-wrap">
        <img class="product__img" src="./images/${b.image}@1.png"
             srcset="./images/${b.image}@2x.png 2x" alt="${b.name}"/>
      </div>
      <div class="product__info">
        <h2 class="product__name" id="product-modal-title">${b.name}</h2>
        <p class="product__price">$${b.price}</p>
        <p class="product__desc">${b.description}</p>
        <div class="product__actions">
          <button type="button" class="btn btn--accent product__buy js-buy-now">Buy now</button>
          <input class="product__qty" type="number" min="1" value="1" aria-label="Quantity"/>
        </div>
      </div>`;
    currentProduct = b;
    currentQty = 1;
    openModal(productModal);

    const qtyInput = productContent.querySelector('.product__qty');
    productContent.querySelector('.js-buy-now').addEventListener('click', () => {
      currentQty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      closeModal(productModal);
      openModal(orderModal);
    });
  } catch (err) {
    console.error('Failed to load product:', err);
  }
}

if (gallery) {
  gallery.addEventListener('click', e => {
    const card = e.target.closest('.js-card');
    if (!card) return;
    openProductById(card.dataset.id);
  });
}

/* ── Order form submit → POST /api/orders (axios) ─────────── */
if (orderForm) {
  orderForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!orderForm.checkValidity()) { orderForm.reportValidity(); return; }

    const fd = new FormData(orderForm);
    const payload = {
      customerName: fd.get('customerName'),
      customerPhone: fd.get('customerPhone'),
      customerAddress: fd.get('customerAddress'),
      customerMessage: fd.get('customerMessage') || '',
      items: currentProduct
        ? [{ id: currentProduct.id, name: currentProduct.name, qty: currentQty }]
        : [],
    };

    const submitBtn = orderForm.querySelector('.order-form__submit');
    submitBtn.disabled = true;

    try {
      const { data } = await api.post('/orders', payload);
      console.log('Order created on backend:', data.data);
      orderForm.reset();
      closeModal(orderModal);
      currentProduct = null;
      currentQty = 1;
      alert(`Thank you! Your order #${data.data.id} has been placed.`);
    } catch (err) {
      console.error('Failed to create order:', err);
      const msg = err.response?.data?.message || 'Could not place the order. Please try again.';
      alert(msg);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ── Subscribe form submit ────────────────────────────────── */
if (subscribeForm) {
  subscribeForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!subscribeForm.checkValidity()) { subscribeForm.reportValidity(); return; }
    const email = new FormData(subscribeForm).get('subscribeEmail');
    console.log('Subscribed:', email);
    subscribeForm.reset();
    alert('Thanks for subscribing!');
  });
}

/* ============================================================
   FEEDBACKS — load from backend, render, init slider
   ============================================================ */
const feedbackTrack = document.querySelector('.js-feedback-track');

function feedbackTemplate(f) {
  return `
    <article class="feedback-card">
      <blockquote class="feedback-card__quote">
        <p>"${f.text}"</p>
      </blockquote>
      <h3 class="feedback-card__author">${f.author}</h3>
    </article>`;
}

async function loadFeedbacks() {
  if (!feedbackTrack) return;
  try {
    const { data } = await api.get('/feedbacks');
    const markup = data.data.map(feedbackTemplate).join('');
    feedbackTrack.insertAdjacentHTML('beforeend', markup); // one DOM op
    // Init slider only after cards exist, so measurements are correct.
    initSlider(document.querySelector('.feedback .feedback__slider'),
      { mobile: 1, tablet: 2, desktop: 3 });
  } catch (err) {
    console.error('Failed to load feedbacks:', err);
    feedbackTrack.innerHTML =
      '<p class="bouquets__message">Could not load reviews right now.</p>';
  }
}

/* ── Kick off initial loads ───────────────────────────────── */
if (gallery) loadPage({ reset: true });
loadFeedbacks();
