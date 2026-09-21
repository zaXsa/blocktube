// This script must be executed before any other YouTube scripts in order to function properly.
// Because of browser's caching mechanism and async behavior, this is not always the case.
// To overcome this issue, it's contents will be minifed and hardcoded into the content script on
// build, forcing browsers to execute it first.
(function () {
  'use strict';

  window.blockTubeDispatched = false;
  const isMobileInterface = document.location.hostname.startsWith('m.');

  function createProxyHook(path, hookKeys) {
    path = path.split('.');

    function getHandler(nextPath, enableHook) {
      return {
        get(target, key) {
          if (
            key === nextPath[0] &&
            typeof target[key] === 'object' &&
            target[key] !== null &&
            !target[key].isProxy_
          ) {
            nextPath.shift();
            target[key] = new Proxy(target[key], getHandler(nextPath, nextPath.length === 0));
            target[key].isProxy_ = true;
          }
          return target[key];
        },
        set(target, key, value) {
          if (enableHook && hookKeys.includes(key)) {
            const hook_ = function () {
              if (window.blockTubeDispatched) return value.apply(null, arguments);
              window.addEventListener('blockTubeReady', value.bind(null, arguments));
            };
            target[key] = hook_;
          } else {
            target[key] = value;
          }
          return true;
        },
      };
    }

    return new Proxy({}, getHandler(path, path.length === 1));
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

  // "fetch" based youtubei endpoints (search/guide moved off SPF)
  const fetchUris = [
    '/youtubei/v1/search',
    '/youtubei/v1/guide',
    '/youtubei/v1/browse',
    '/youtubei/v1/next',
    '/youtubei/v1/player',
    '/youtubei/v1/get_watch',
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
      if (window.blockTubeDispatched) {
        window.blockTubeExports.spfFilter(url, resp);
        next(resp);
      } else
        window.addEventListener('blockTubeReady', () => {
          window.blockTubeExports.spfFilter(url, resp);
          next(resp);
        });
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
  if (window.writeEmbed || window.ytplayer || window.Polymer) {
    console.error('BlockTube: page already initialized before seed.js ran, aborted early');
    return;
  }

  // Youtube started using vanilla "fetch" for some endpoints (search and guide for now) :\
  // I'm forced to hook that one too
  // Bare reference to the original fetch so the wrapper below can delegate.
  const originalFetch = window.fetch;
  window.fetch = function (resource, init = undefined) {
    if (!(resource instanceof Request) || !fetchUris.some((u) => resource.url.includes(u))) {
      return originalFetch(resource, init);
    }

    return new Promise((resolve, reject) => {
      originalFetch(resource, init)
        .then(function (resp) {
          const url = new URL(resource.url);
          resp
            .json()
            .then(function (jsonResp) {
              if (window.blockTubeDispatched) {
                window.blockTubeExports.fetchFilter(url, jsonResp);
                resolve(new Response(JSON.stringify(jsonResp)));
              } else
                window.addEventListener('blockTubeReady', () => {
                  window.blockTubeExports.fetchFilter(url, jsonResp);
                  resolve(new Response(JSON.stringify(jsonResp)));
                });
            })
            .catch(reject);
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
  document.addEventListener('spfready', function (e) {
    Object.defineProperty(window.spf, 'request', {
      get() {
        return this.requestValue;
      },
      set(v) {
        this.requestValue = spfRequest(v);
      },
    });
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
