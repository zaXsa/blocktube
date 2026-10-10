// This script must be executed before any other YouTube scripts in order to function properly.
// Because of browser's caching mechanism and async behavior, this is not always the case.
// To overcome this issue, it's contents will be minifed and hardcoded into the content script on
// build, forcing browsers to execute it first.
(function () {
  'use strict';

  window.blockTubeDispatched = false;
  const isMobileInterface = document.location.hostname.startsWith('m.');

  // Wrap one hooked method so it waits for blockTubeReady when the
  // extension isn't armed yet, then calls through with the live arguments.
  function deferUntilReady(value) {
    return function () {
      if (window.blockTubeDispatched) return value.apply(null, arguments);
      window.addEventListener('blockTubeReady', value.bind(null, arguments));
    };
  }

  // The get trap for a proxy hook: descend one path segment, proxying the
  // child so the leaf set trap can arm. Each node proxies once (isProxy_).
  function proxyHookGet(target, key, nextPath, hookKeys) {
    if (
      key === nextPath[0] &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !target[key].isProxy_
    ) {
      nextPath.shift();
      target[key] = new Proxy(target[key], getHandler(nextPath, nextPath.length === 0, hookKeys));
      target[key].isProxy_ = true;
    }
    return target[key];
  }

  // The set trap for a proxy hook: at the leaf, hooked keys are deferred
  // until blockTubeReady; everything else assigns through.
  function proxyHookSet(target, key, value, enableHook, hookKeys) {
    if (enableHook && hookKeys.includes(key)) {
      target[key] = deferUntilReady(value);
    } else {
      target[key] = value;
    }
    return true;
  }

  function getHandler(nextPath, enableHook, hookKeys) {
    return {
      get(target, key) {
        return proxyHookGet(target, key, nextPath, hookKeys);
      },
      set(target, key, value) {
        return proxyHookSet(target, key, value, enableHook, hookKeys);
      },
    };
  }

  function createProxyHook(path, hookKeys) {
    path = path.split('.');

    return new Proxy({}, getHandler(path, path.length === 1, hookKeys));
  }

  // SPF (XHR) endpoints that still deliver content as JSON we need to filter
  const spfUris = [
    '/browse_ajax',
    '/related_ajax',
    '/service_ajax',
    '/list_ajax',
    '/guide_ajax',
    '/live_chat/get_live_chat',
  ];

  // "fetch" based youtubei endpoints (search/guide moved off SPF, and each
  // swiped-to Short loads its reel overlay through reel_item_watch)
  const fetchUris = [
    '/youtubei/v1/search',
    '/youtubei/v1/guide',
    '/youtubei/v1/browse',
    '/youtubei/v1/next',
    '/youtubei/v1/player',
    '/youtubei/v1/get_watch',
    '/youtubei/v1/reel/reel_item_watch',
    '/youtubei/v1/reel/reel_watch_sequence',
    '/youtubei/v1/live_chat/get_live_chat',
  ];

  const hooks = {
    menuOnTap(...args) {
      window.blockTubeExports.menuOnTap.call(this, ...args);
    },
    menuOnTapMobile(...args) {
      window.blockTubeExports.menuOnTapMobile.call(this, ...args);
    },
    genericHook(cb) {
      return function (...args) {
        if (window.blockTubeDispatched) {
          cb.call(this, ...args);
        } else {
          window.addEventListener('blockTubeReady', () => {
            cb.call(this, ...args);
          });
        }
      };
    },
  };

  function setupPolymer(v) {
    return function (...args) {
      if (!args[0].is) {
        return v(...args);
      }
      switch (args[0].is) {
        case 'ytd-app':
          args[0].loadDesktopData_ = hooks.genericHook(args[0].loadDesktopData_);
          break;
        case 'ytd-guide-renderer':
          args[0].attached = hooks.genericHook(args[0].attached);
          break;
        default:
          break;
      }
      return v(...args);
    };
  }

  function isUrlMatch(url) {
    if (!(url instanceof URL)) url = new URL(url);
    return spfUris.some((uri) => uri === url.pathname) || url.searchParams.has('pbj');
  }

  function onPart(url, next) {
    return function (resp) {
      const run = function () {
        try {
          window.blockTubeExports.spfFilter(url, resp);
        } catch (e) {
          console.error('BlockTube spfFilter exception (passing data through)', e);
        }
        next(resp);
      };
      if (window.blockTubeDispatched) run();
      else window.addEventListener('blockTubeReady', run, { once: true });
    };
  }

  function spfRequest(cb) {
    return function (...args) {
      if (args.length < 2) return cb.apply(null, args);
      const url = new URL(args[0], document.location.origin);
      if (isUrlMatch(url)) {
        args[1].onDone = onPart(url, args[1].onDone);
        args[1].onPartDone = onPart(url, args[1].onPartDone);
      }
      return cb.apply(null, args);
    };
  }

  // Start
  // Shorts first-frame guard (see shorts-overlay.js): the filter verdict needs
  // extension storage, which arrives async AFTER this script runs, while a
  // blocked Short's player response already ships playable streams AND
  // thumbnails. Hiding <video> alone cannot work: Shorts pre-render thumbnail
  // and poster images that are not video elements. So every Shorts media host
  // (#shorts-player, ytd-reel-video-renderer — the same hosts the reason panel
  // anchors to) gets a plain black cover div the moment it appears, covering
  // video, thumbnails and posters alike. Covers stay until a verdict lifts
  // them (clean) or keeps them under the reason panel (blocked). Runs before
  // the early-abort check below on purpose: even when YouTube initialized
  // first, the covers still apply and the later verdict still lands. Inline
  // styles only (no <style>), fail-open throughout. The blockTubeReady
  // fail-safe below guarantees a page with no verdict (e.g. storage never
  // arrived) never stays covered.
  try {
    if (document.location.pathname.startsWith('/shorts/')) {
      const SHORTS_COVER_ATTR = 'data-bt-cover';
      const SHORTS_REVEALED_ATTR = 'data-bt-revealed';
      const styleShortsCover = (cover) => {
        try {
          cover.style.position = 'absolute';
          cover.style.top = '0';
          cover.style.left = '0';
          cover.style.right = '0';
          cover.style.bottom = '0';
          cover.style.backgroundColor = '#000';
          cover.style.zIndex = '2147483646';
          cover.style.pointerEvents = 'none';
        } catch (e) {}
      };
      const positionShortsHost = (host) => {
        try {
          let position = null;
          if (typeof getComputedStyle === 'function') {
            position = getComputedStyle(host).position;
          }
          if (position === 'static' && host.style) host.style.position = 'relative';
        } catch (e) {}
      };
      // A clean verdict for the short on screen is already recorded
      // (window.__blockTubeShortsVerdict, set by shorts-overlay.js). A host
      // that is BOTH decided-clean and in the viewport right now is the
      // visible current short (e.g. arrived after its verdict on initial
      // load) and needs no cover. Everything else is covered — in particular
      // prefetched neighbours, which are always inserted OFF-viewport and
      // would otherwise peek in during the swipe before navigation starts.
      // Zero-area or unreadable rects fail closed (covered): only a host
      // provably on screen is left open.
      const hostInViewport = (host) => {
        try {
          if (!host || typeof host.getBoundingClientRect !== 'function') return false;
          const r = host.getBoundingClientRect();
          if (!r || r.width === 0 || r.height === 0) return false;
          const vh = window.innerHeight || 0;
          const vw = window.innerWidth || 0;
          return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
        } catch (e) {
          return false;
        }
      };
      const skipShortsCover = (host) => {
        try {
          const v = window.__blockTubeShortsVerdict;
          if (!v || v.clean !== true || typeof v.videoId !== 'string') return false;
          if (!document.location.pathname.startsWith(`/shorts/${v.videoId}`)) return false;
          return hostInViewport(host);
        } catch (e) {
          return false;
        }
      };
      const ensureShortsCover = (host) => {
        try {
          if (!host || typeof host.querySelectorAll !== 'function') return;
          if (host.hasAttribute && host.hasAttribute(SHORTS_REVEALED_ATTR)) return;
          if (host.querySelector(`[${SHORTS_COVER_ATTR}]`)) return;
          let cover = null;
          try {
            cover = document.createElement('div');
          } catch (e) {
            return;
          }
          cover.setAttribute(SHORTS_COVER_ATTR, '1');
          styleShortsCover(cover);
          positionShortsHost(host);
          try {
            host.appendChild(cover);
          } catch (e) {}
        } catch (e) {}
      };
      // The upcoming-short strip renders each preload as a plain div with the
      // frame baked in as a CSS background-image
      // (.reel-video-in-sequence-thumbnail) — no video, no img, no JSON the
      // filter ever sees after first render. Hide those divs the moment they
      // appear, same protocol as the covers (hidden until a verdict reveals).
      const SHORTS_SEQ_THUMB_SEL = '.reel-video-in-sequence-thumbnail';
      const hideShortsSeqThumbsIn = (root) => {
        try {
          if (!root) return;
          if (
            root.classList &&
            typeof root.classList.contains === 'function' &&
            root.classList.contains('reel-video-in-sequence-thumbnail') &&
            root.style
          ) {
            root.style.opacity = '0';
          }
          if (typeof root.querySelectorAll === 'function') {
            const thumbs = root.querySelectorAll(SHORTS_SEQ_THUMB_SEL);
            for (let i = 0; i < thumbs.length; i += 1) {
              try {
                if (thumbs[i] && thumbs[i].style) thumbs[i].style.opacity = '0';
              } catch (e) {}
            }
          }
        } catch (e) {}
      };
      const coverShortsHostsIn = (root) => {
        try {
          if (!root || typeof root.querySelectorAll !== 'function') return;
          const candidates = [];
          if (root.tagName === 'YTD-REEL-VIDEO-RENDERER' || root.id === 'shorts-player') {
            candidates.push(root);
          }
          const reels = root.querySelectorAll('ytd-reel-video-renderer');
          for (let i = 0; i < reels.length; i += 1) {
            if (candidates.indexOf(reels[i]) === -1) candidates.push(reels[i]);
          }
          let player = null;
          try {
            player =
              typeof root.getElementById === 'function'
                ? root.getElementById('shorts-player')
                : document.getElementById('shorts-player');
          } catch (e) {
            player = null;
          }
          if (player && candidates.indexOf(player) === -1) candidates.push(player);
          for (let c = 0; c < candidates.length; c += 1) {
            try {
              if (!skipShortsCover(candidates[c])) ensureShortsCover(candidates[c]);
            } catch (e) {}
          }
        } catch (e) {}
      };
      const clearShortsCovers = () => {
        try {
          const covers = document.querySelectorAll(`[${SHORTS_COVER_ATTR}]`);
          for (let i = 0; i < covers.length; i += 1) {
            try {
              if (covers[i] && covers[i].parentNode) covers[i].parentNode.removeChild(covers[i]);
            } catch (e) {}
          }
        } catch (e) {}
      };
      try {
        coverShortsHostsIn(document);
        hideShortsSeqThumbsIn(document);
      } catch (e) {}
      try {
        if (typeof MutationObserver === 'function' && document.documentElement) {
          const shortsPrehideObserver = new MutationObserver((mutations) => {
            for (let m = 0; m < mutations.length; m += 1) {
              const added = mutations[m].addedNodes;
              if (!added) continue;
              for (let n = 0; n < added.length; n += 1) {
                coverShortsHostsIn(added[n]);
                hideShortsSeqThumbsIn(added[n]);
              }
            }
          });
          shortsPrehideObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
          window.__blockTubeShortsPrehide = shortsPrehideObserver;
        }
      } catch (e) {}
      // Fail-open: verdicts always land through shorts-overlay.js (which sets
      // window.__blockTubeShortsVerdict). If none ever does, drop the covers
      // rather than leaving Shorts black.
      try {
        window.addEventListener(
          'blockTubeReady',
          () => {
            try {
              setTimeout(() => {
                try {
                  if (!window.__blockTubeShortsVerdict) {
                    try {
                      if (window.__blockTubeShortsPrehide) {
                        window.__blockTubeShortsPrehide.disconnect();
                      }
                    } catch (e) {}
                    clearShortsCovers();
                  }
                } catch (e) {}
              }, 5000);
            } catch (e) {}
          },
          { once: true },
        );
      } catch (e) {}
    }
  } catch (e) {}

  if (window.writeEmbed || window.ytplayer || window.Polymer) {
    console.error('BlockTube: page already initialized before seed.js ran, aborted early');
    return;
  }

  // Youtube started using vanilla "fetch" for some endpoints (search and guide for now) :\
  // I'm forced to hook that one too
  // Bare reference to the original fetch so the wrapper below can delegate.
  const originalFetch = window.fetch;

  // Normalize whatever gets handed to fetch into the request URL string.
  // YouTube passes a Request in some bundles but a plain URL/string in others;
  // gating on `instanceof Request` alone silently skipped those SPA fetches and
  // left every /youtubei/v1 response (browse continuations, get_watch, player)
  // unfiltered until a full page reload.
  function getResourceUrl(resource) {
    if (typeof resource === 'string') return resource;
    if (resource instanceof Request) return resource.url;
    if (resource instanceof URL) return resource.href;
    // Duck-typed lookalikes (shims/polyfills): never throw on exotic objects.
    if (typeof resource === 'object' && resource !== null) {
      if (typeof resource.url === 'string' && typeof resource.method === 'string') {
        return resource.url;
      }
      if (typeof resource.href === 'string') return resource.href;
    }
    return undefined;
  }

  // Filter one parsed fetch body, then re-serialize with the original status
  // and content-type while dropping length/encoding headers (the body bytes
  // changed). Filter throws never break the caller — data passes through.
  function sendFilteredFetch(url, jsonResp, resp, resolve) {
    try {
      window.blockTubeExports.fetchFilter(url, jsonResp);
    } catch (e) {
      console.error('BlockTube fetchFilter exception (passing data through)', e);
    }
    // Re-serialize with the original status and content-type while
    // dropping length/encoding headers (the body bytes changed).
    const headers = new Headers(resp.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    resolve(new Response(JSON.stringify(jsonResp), { status: resp.status, headers }));
  }

  // Handle one parsed fetch JSON body: filter once armed (deferred otherwise),
  // or pass the raw response through when the body isn't parseable JSON.
  function handleFetchJson(url, jsonResp, resp, resolve) {
    const sendFiltered = function () {
      sendFilteredFetch(url, jsonResp, resp, resolve);
    };
    if (window.blockTubeDispatched) sendFiltered();
    else window.addEventListener('blockTubeReady', sendFiltered, { once: true });
  }

  // Handle one fetch response: non-JSON bodies (error pages, redirects, 204s)
  // carry no video data — hand the original through untouched instead of
  // rejecting. JSON bodies are parsed, filtered, and re-serialized.
  function handleFetchResponse(url, resp, resolve) {
    // Non-JSON bodies (error pages, redirects, 204s) carry no video data:
    // hand the original response through untouched instead of rejecting.
    if (!resp.ok || !(resp.headers.get('content-type') || '').includes('json')) {
      resolve(resp);
      return;
    }
    resp
      .json()
      .then(function (jsonResp) {
        handleFetchJson(url, jsonResp, resp, resolve);
      })
      // A body that claims JSON but fails to parse shouldn't take down
      // YouTube's caller either — pass the raw response through.
      .then(
        () => {},
        () => resolve(resp),
      );
  }

  window.fetch = function (resource, init = undefined) {
    const resourceUrl = getResourceUrl(resource);
    if (resourceUrl === undefined || !fetchUris.some((u) => resourceUrl.includes(u))) {
      return originalFetch(resource, init);
    }
    // The substring gate only needs a matching path; a crafted URL string that
    // contains it but fails to parse must not kill the caller's fetch.
    let url;
    try {
      url = new URL(resourceUrl, document.location.origin);
    } catch (e) {
      return originalFetch(resource, init);
    }

    return new Promise((resolve, reject) => {
      originalFetch(resource, init)
        .then(function (resp) {
          handleFetchResponse(url, resp, resolve);
        })
        .catch(reject);
    });
  };

  if (window.location.pathname.startsWith('/embed/')) {
    const XMLHttpRequestResponse = Object.getOwnPropertyDescriptor(
      XMLHttpRequest.prototype,
      'response',
    );
    Object.defineProperty(XMLHttpRequest.prototype, 'response', {
      get() {
        if (!fetchUris.some((u) => this.responseURL.includes(u))) {
          return XMLHttpRequestResponse.get.call(this);
        }
        const res = JSON.parse(XMLHttpRequestResponse.get.call(this).replace(")]}'", ''));
        window.blockTubeExports.fetchFilter(new URL(this.responseURL), res);
        return JSON.stringify(res);
      },
      configurable: true,
    });
  }

  // Wrap YT's legacy property definitions so every access that reach us BEFORE
  // BlockTube's storage is ready gets deferred instead of dropping data:
  //   - Polymer: hook element registration (ytd-app loadDesktopData_...)
  //   - writeEmbed / loadInitialData (embed pages): delay until blockTubeReady
  // Each pair shadow a same-named backing field on window (polymerValue, ...);
  // YT assigns only once before we ever read them.

  // Polymer: intercept element definitions so loadDesktopData_/attached are
  // wrapped (see setupPolymer) to wait for the extension to be ready.
  Object.defineProperty(window, 'Polymer', {
    get() {
      return this.polymerValue;
    },
    set(v) {
      if (v instanceof Function) {
        this.polymerValue = setupPolymer(v);
      } else {
        this.polymerValue = v;
      }
    },
    configurable: true,
    enumerable: true,
  });

  // writeEmbed builds the player in embed pages
  Object.defineProperty(window, 'writeEmbed', {
    get() {
      return this.writeEmbedValue;
    },
    set(v) {
      this.writeEmbedValue = () => {
        if (window.blockTubeDispatched) v.apply(this);
        else window.addEventListener('blockTubeReady', v.bind(this));
      };
    },
  });

  // guard the first loadDesktopData call (desktop nav) until storage is ready
  Object.defineProperty(window, 'loadInitialData', {
    get() {
      return this.loadInitialDataValue;
    },
    set(v) {
      this.loadInitialDataValue = (a1) => {
        if (window.blockTubeDispatched) return v(a1);
        window.addEventListener('blockTubeReady', v.bind(this, a1));
      };
    },
  });

  // player init has moved to window.yt.player.Application.create
  window.yt = createProxyHook('player.Application', ['create', 'createAlternate']);

  // spfjs is responsible for XHR requests; wrap request so the response flows
  // through spfFilter (passed up to the content script for post-processing).
  // Configurable + idempotent: SPA navigations (notably /shorts/<id>) re-fire
  // spfready, and redefining a non-configurable accessor throws
  // "Cannot redefine property: request", which breaks filtering from then on.
  document.addEventListener('spfready', function (e) {
    if (!window.spf) return;
    if (window.spf.__blockTubeSpfWrapped) return;
    try {
      const prevDesc = Object.getOwnPropertyDescriptor(window.spf, 'request');
      if (prevDesc && prevDesc.configurable === false) return;
    } catch (err) {
      return;
    }
    try {
      Object.defineProperty(window.spf, 'request', {
        configurable: true,
        enumerable: true,
        get() {
          return this.requestValue;
        },
        set(v) {
          this.requestValue = spfRequest(v);
        },
      });
      Object.defineProperty(window.spf, '__blockTubeSpfWrapped', {
        value: true,
        configurable: true,
        writable: true,
        enumerable: false,
      });
    } catch (err) {}
  });

  if (isMobileInterface) {
    // Mobile Context menus hooking
    class ElementHook extends HTMLElement {
      connectedCallback() {
        this.onclick = hooks.menuOnTapMobile;
        this.ondblclick = hooks.menuOnTapMobile;
      }
    }
    class ButtonRendererHook extends ElementHook {}
    class MenuServiceItemHook extends ElementHook {}
    class MenuNavigationItemHook extends ElementHook {}
    class MenuItemHook extends ElementHook {}
    customElements.define('ytm-button-renderer', ButtonRendererHook);
    customElements.define('ytm-menu-service-item-renderer', MenuServiceItemHook);
    customElements.define('ytm-menu-navigation-item-renderer', MenuNavigationItemHook);
    customElements.define('ytm-menu-item', MenuItemHook);
  }

  if (!isMobileInterface) {
    const customElementsRegistryDefine = window.customElements.define;
    Object.defineProperty(window.customElements, 'define', {
      configurable: true,
      enumerable: false,
      value(name, constructor) {
        if (name === 'ytd-menu-service-item-renderer' || name === 'yt-list-item-view-model') {
          const origCallback = constructor.prototype.connectedCallback;
          constructor.prototype.connectedCallback = function () {
            this.onclick = hooks.menuOnTap;
            if (origCallback) origCallback.call(this);
          };
        }
        customElementsRegistryDefine.call(window.customElements, name, constructor);
      },
    });
  }
})();
