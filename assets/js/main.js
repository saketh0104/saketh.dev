/* =========================================================
   MAIN JS — Phase 4D (motion orchestration + navigation)
   Sections:
     1. DOM / event helpers
     2. Navigation (mobile menu w/ open-close motion, brand -> top)
     3. Motion initialization (safe entrance system)
     4. Boot
   External-only. Behavior fallback chain:
     reduced-motion        -> static, fully visible
     no IntersectionObserver -> hero still plays; sections stay visible
     JS/stylesheet failure  -> content remains visible (hooks are inert)
   ========================================================= */
(function() {
  'use strict';

  /* -------------------------------------------------------
     1. HELPERS
     ------------------------------------------------------- */
  function bind(el, event, handler) {
    if (el && el.addEventListener) el.addEventListener(event, handler);
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* -------------------------------------------------------
     2. NAVIGATION
     ------------------------------------------------------- */
  function initNavigation() {
    var mobileBtn = document.querySelector('.md\\:hidden button[data-slot="button"]');
    var mobileMenu = document.getElementById('mobile-menu');
    var menuOpen = false;
    var closeTimer = null;
    var CLOSE_MS = 180;

    if (mobileBtn && mobileMenu) {
      var linkEls = Array.prototype.slice.call(mobileMenu.querySelectorAll('a, button'));

      // enable animated open/close (inert if JS fails)
      mobileMenu.classList.add('menu-init');

      function openMenu() {
        if (menuOpen) return;
        menuOpen = true;
        if (closeTimer) clearTimeout(closeTimer);
        mobileMenu.classList.remove('hidden');
        mobileMenu.classList.add('flex');
        linkEls.forEach(function(a, i) {
          a.style.setProperty('--menu-delay', (i * 45) + 'ms');
        });
        requestAnimationFrame(function() {
          if (menuOpen) mobileMenu.classList.add('menu-open');
        });
      }

      function closeMenu() {
        if (!menuOpen) return;
        menuOpen = false;
        mobileMenu.classList.remove('menu-open');
        linkEls.forEach(function(a) {
          a.style.setProperty('--menu-delay', '0ms');
        });
        closeTimer = setTimeout(function() {
          mobileMenu.classList.add('hidden');
          mobileMenu.classList.remove('flex');
        }, CLOSE_MS);
      }

      bind(mobileBtn, 'click', function() {
        if (menuOpen) closeMenu();
        else openMenu();
      });

      // Close after a link/button inside the menu is used
      linkEls.forEach(function(btn) { bind(btn, 'click', closeMenu); });
    }

    // Brand button scrolls to top
    bind(document.querySelector('button.hover\\:opacity-80'), 'click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* -------------------------------------------------------
     3. MOTION ORCHESTRATION
     Entrance system: elements are VISIBLE by default and the pre-
     animation state is applied only by JS, never as a CSS default.
     Flow for scroll-revealed content:
       a) observer initializes successfully  -> arm off-screen [data-step]
          elements with inline opacity:0 + directional offset, so the
          element arrives together with its animation (no visible-then-
          animate);
       b) on intersection -> play class + stagger delay, inline visible
          state restored (element settles to opacity:1 / transform:none);
       c) reduced-motion / no-IO / observer init failure -> nothing is
          ever armed or hidden; every element stays fully visible.
     ------------------------------------------------------- */
  var HERO_STEP_MS = 80;
  var SECTION_STEP_MS = 80;

  // FROM-state per direction, mirroring the keyframes in animations.css.
  // var(--motion-x) etc. resolve per-element (keeps the 14px bullet nudge).
  var MOTION_FROM = {
    up:    'translateY(var(--motion-up-y))',
    left:  'translateX(calc(-1 * var(--motion-x)))',
    right: 'translateX(var(--motion-x))',
    scale: 'scale(var(--motion-scale-from))'
  };

  function armElement(el) {
    el.style.setProperty('opacity', '0');
    var from = MOTION_FROM[el.getAttribute('data-motion') || 'up'];
    if (from) el.style.setProperty('transform', from);
  }

  function playMotion(el, stepMs) {
    el.style.setProperty('--motion-delay', (el.getAttribute('data-step') * stepMs) + 'ms');
    el.style.setProperty('opacity', '1');          // restore visible base
    el.style.removeProperty('transform');          // never leave inline offset
    el.classList.add('motion-play');
  }

  // Hero is above the fold: plays immediately on load, no observer needed.
  function initHeroMotion() {
    var hero = document.getElementById('home');
    if (hero) {
      Array.prototype.forEach.call(hero.querySelectorAll('[data-step]'), function(el) {
        playMotion(el, HERO_STEP_MS);
      });
    }
  }

  // Element-level viewport reveal: each [data-step] is armed (hidden at its
  // FROM state) only after the observer is up, and stays unplayed until *it*
  // enters the viewport, then plays once with its own stagger delay
  // (data-step * section step-ms). Sections are never pre-triggered; a fast
  // scroll past content leaves it un-animated until the user actually reaches it.
  function initScrollMotion() {
    if (!('IntersectionObserver' in window)) return; // sections stay visible

    var io;
    try {
      io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var el = entry.target;
          var section = el.closest && el.closest('section[id]');
          var stepMs = parseInt((section && section.getAttribute('data-step-ms')) || '80', 10)
                       || SECTION_STEP_MS;
          playMotion(el, stepMs);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    } catch (err) {
      return; // observer failed -> nothing armed, everything visible
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function(el) {
      if (el.closest && el.closest('#home')) return; // hero plays on load
      armElement(el);   // hidden at FROM state, in place for its reveal
      io.observe(el);
    });
  }

  function initMotion() {
    if (prefersReducedMotion()) return;               // static + fully visible
    initHeroMotion();                                 // safe without IO
    if (!('IntersectionObserver' in window)) return;  // sections stay visible
    initScrollMotion();
  }

  /* -------------------------------------------------------
     4. BOOT
     ------------------------------------------------------- */
  initNavigation();
  initMotion();
})();