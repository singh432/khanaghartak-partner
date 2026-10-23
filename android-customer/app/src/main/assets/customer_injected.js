(function () {
  'use strict';

  // Native Geolocation Bridge with Fused Location Support
  try {
    window.__kgt_pending_callbacks = window.__kgt_pending_callbacks || {};
    window.__kgt_on_native_location = function (cbId, lat, lng, accuracy, err) {
      var cb = window.__kgt_pending_callbacks[cbId];
      if (cb) {
        delete window.__kgt_pending_callbacks[cbId];
        if (err) {
          if (typeof cb.error === 'function') cb.error(err);
        } else if (typeof lat === 'number' && typeof lng === 'number') {
          window.__native_device_coords = { lat: lat, lng: lng, accuracy: accuracy || 10, ts: Date.now() };
          try {
            localStorage.setItem('kgt:user-coords', JSON.stringify(window.__native_device_coords));
            window.dispatchEvent(new CustomEvent('kgt:native-coords', { detail: window.__native_device_coords }));
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('kgt:address-changed'));
          } catch (e) {}
          if (typeof cb.success === 'function') {
            cb.success({
              coords: {
                latitude: lat,
                longitude: lng,
                accuracy: accuracy || 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            });
          }
        } else {
          if (typeof cb.error === 'function') cb.error({ code: 2, message: 'Position unavailable' });
        }
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      var origGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = function (successCallback, errorCallback, options) {
        // 1. Try Android Native App Fused Location first
        if (window.AndroidApp && typeof window.AndroidApp.requestFusedLocation === 'function') {
          var cbId = 'loc_' + Math.random().toString(36).substring(2, 9);
          var handled = false;
          window.__kgt_pending_callbacks[cbId] = {
            success: function (pos) {
              if (handled) return;
              handled = true;
              if (typeof successCallback === 'function') successCallback(pos);
            },
            error: function (err) {
              if (handled) return;
              // If native failed, fallback to origGetCurrentPosition
              fallbackWebGeo();
            }
          };

          try {
            window.AndroidApp.requestFusedLocation(cbId);
            // Safety timeout after 9 seconds to trigger web fallback if native is delayed
            setTimeout(function () {
              if (!handled && window.__kgt_pending_callbacks[cbId]) {
                delete window.__kgt_pending_callbacks[cbId];
                fallbackWebGeo();
              }
            }, 9000);
            return;
          } catch (e) {
            delete window.__kgt_pending_callbacks[cbId];
          }
        }

        fallbackWebGeo();

        function fallbackWebGeo() {
          // 2. Check if fresh native coords already arrived
          var nativeCoords = null;
          if (window.AndroidApp && typeof window.AndroidApp.getDeviceCoordinates === 'function') {
            try {
              var raw = window.AndroidApp.getDeviceCoordinates();
              if (raw) nativeCoords = JSON.parse(raw);
            } catch (e) {}
          }
          if (!nativeCoords && window.__native_device_coords) {
            nativeCoords = window.__native_device_coords;
          }

          if (nativeCoords && typeof nativeCoords.lat === 'number' && typeof nativeCoords.lng === 'number' && (Date.now() - (nativeCoords.ts || 0) < 60000)) {
            if (typeof successCallback === 'function') {
              setTimeout(function () {
                successCallback({
                  coords: {
                    latitude: nativeCoords.lat,
                    longitude: nativeCoords.lng,
                    accuracy: nativeCoords.accuracy || 15,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                  },
                  timestamp: nativeCoords.ts || Date.now()
                });
              }, 10);
            }
            return;
          }

          // Trigger native refresh
          if (window.AndroidApp && typeof window.AndroidApp.refreshLocation === 'function') {
            try { window.AndroidApp.refreshLocation(); } catch (e) {}
          }

          var safeOptions = {
            enableHighAccuracy: true,
            timeout: (options && options.timeout) || 12000,
            maximumAge: (options && options.maximumAge) || 10000
          };

          origGetCurrentPosition(
            function (pos) {
              if (typeof successCallback === 'function') successCallback(pos);
            },
            function (err) {
              // Check if native coordinates arrived during web timeout
              var fallback = window.__native_device_coords;
              if (fallback && typeof fallback.lat === 'number' && typeof fallback.lng === 'number' && typeof successCallback === 'function') {
                successCallback({
                  coords: {
                    latitude: fallback.lat,
                    longitude: fallback.lng,
                    accuracy: fallback.accuracy || 20,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                  },
                  timestamp: Date.now()
                });
                return;
              }

              if (typeof errorCallback === 'function') {
                var isPermDenied = err && err.code === 1;
                var customErr = {
                  code: err ? err.code : 3,
                  message: isPermDenied
                    ? "Location permission denied. Please allow location access."
                    : "Unable to detect exact location. Please select your address on the map.",
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3
                };
                errorCallback(customErr);
              }
            },
            safeOptions
          );
        }
      };
    }
  } catch (e) {}

  var SHANKARGARH_POLY = [
    [25.231022, 81.586002],
    [25.222831, 81.599661],
    [25.219243, 81.647637],
    [25.224099, 81.676012],
    [25.215332, 81.677157],
    [25.202136, 81.664307],
    [25.185085, 81.638961],
    [25.157103, 81.640885],
    [25.167217, 81.611500],
    [25.185978, 81.594873],
    [25.197182, 81.559681]
  ];

  var CHAKGHAT_POLY = [
    [24.981876, 81.690224],
    [24.981205, 81.698695],
    [24.988809, 81.702797],
    [25.001377, 81.713872],
    [25.000292, 81.729683],
    [25.009535, 81.737373],
    [25.019709, 81.749361],
    [25.027381, 81.752970],
    [25.039671, 81.748045],
    [25.044969, 81.747826],
    [25.059190, 81.740312],
    [25.075695, 81.741864],
    [25.076044, 81.759938],
    [25.082158, 81.742176],
    [25.083460, 81.728367],
    [25.074721, 81.735442],
    [25.053820, 81.728049],
    [25.055585, 81.704847],
    [25.055181, 81.694430],
    [25.044400, 81.671121],
    [25.044501, 81.650983],
    [25.020127, 81.664495],
    [25.018384, 81.700384],
    [25.005071, 81.694029]
  ];

  function isCoordInShankargarh(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return false;
    var inside = false;
    for (var i = 0, j = SHANKARGARH_POLY.length - 1; i < SHANKARGARH_POLY.length; j = i++) {
      var xi = SHANKARGARH_POLY[i][1], yi = SHANKARGARH_POLY[i][0];
      var xj = SHANKARGARH_POLY[j][1], yj = SHANKARGARH_POLY[j][0];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    if (inside) return true;

    for (var k = 0, l = CHAKGHAT_POLY.length - 1; k < CHAKGHAT_POLY.length; l = k++) {
      var xk = CHAKGHAT_POLY[k][1], yk = CHAKGHAT_POLY[k][0];
      var xl = CHAKGHAT_POLY[l][1], yl = CHAKGHAT_POLY[l][0];
      if (yk > lat !== yl > lat && lng < ((xl - xk) * (lat - yk)) / (yl - yk) + xk) {
        inside = !inside;
      }
    }
    if (inside) return true;

    var R = 6371.0;
    // 1. Shankargarh center (25.1842, 81.6212) <= 12km
    var dLat = ((lat - 25.1842) * Math.PI) / 180;
    var dLon = ((lng - 81.6212) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((25.1842 * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var d = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d <= 12.0) return true;

    // 2. Chakghat center (25.0275, 81.7375) <= 15km
    var dLatC = ((lat - 25.0275) * Math.PI) / 180;
    var dLonC = ((lng - 81.7375) * Math.PI) / 180;
    var aC =
      Math.sin(dLatC / 2) * Math.sin(dLatC / 2) +
      Math.cos((25.0275 * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLonC / 2) *
        Math.sin(dLonC / 2);
    var dC = 2 * R * Math.atan2(Math.sqrt(aC), Math.sqrt(1 - aC));
    return dC <= 15.0;
  }

  function isDeliveryLocationInZone(addr, coords) {
    var s = (addr || '').toLowerCase().trim();
    var isChakghat =
      s.indexOf('chakghat') !== -1 ||
      s.indexOf('chak ghat') !== -1 ||
      s.indexOf('486226') !== -1 ||
      s.indexOf('teonthar') !== -1 ||
      s.indexOf('ghuma') !== -1;

    var hasOutsideKeywords =
      s.indexOf('civil lines') !== -1 ||
      s.indexOf('katra') !== -1 ||
      s.indexOf('naini') !== -1 ||
      s.indexOf('lucknow') !== -1 ||
      s.indexOf('kanpur') !== -1 ||
      s.indexOf('delhi') !== -1 ||
      s.indexOf('noida') !== -1 ||
      s.indexOf('gurugram') !== -1 ||
      s.indexOf('varanasi') !== -1 ||
      (s.indexOf('allahabad') !== -1 && s.indexOf('shankargarh') === -1 && s.indexOf('212108') === -1) ||
      (s.indexOf('prayagraj') !== -1 && s.indexOf('shankargarh') === -1 && s.indexOf('212108') === -1) ||
      (s.indexOf('rewa') !== -1 && !isChakghat);
    if (hasOutsideKeywords) return false;

    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && !isNaN(coords.lat) && !isNaN(coords.lng)) {
      return isCoordInShankargarh(coords.lat, coords.lng);
    }

    var hasInsideKeywords =
      s.indexOf('shankargarh') !== -1 ||
      s.indexOf('shankergarh') !== -1 ||
      s.indexOf('212108') !== -1 ||
      s.indexOf('raja market') !== -1 ||
      s.indexOf('station road') !== -1 ||
      s.indexOf('bara road') !== -1 ||
      s.indexOf('lalita nagar') !== -1 ||
      isChakghat;
    if (hasInsideKeywords) return true;

    if (s.length > 0) return false;
    return false;
  }

  function getCartQty() {
    try {
      var raw = localStorage.getItem('kgt_cart_v2') || localStorage.getItem('cart');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.reduce(function (acc, item) {
            return acc + (Number(item.qty) || 0);
          }, 0);
        }
      }
    } catch (e) {}
    return 0;
  }

  function getTanStackRouter() {
    if (window.__router && typeof window.__router.navigate === 'function') {
      return window.__router;
    }
    try {
      var root =
        document.getElementById('root') ||
        document.querySelector('#root') ||
        (document.body && document.body.firstElementChild);
      if (root) {
        var keys = Object.keys(root);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (k.indexOf('__reactFiber') === 0 || k.indexOf('__reactContainer') === 0) {
            var queue = [root[k]];
            var count = 0;
            while (queue.length > 0 && count < 300) {
              count++;
              var f = queue.shift();
              if (!f) continue;
              if (f.memoizedProps && f.memoizedProps.router && typeof f.memoizedProps.router.navigate === 'function') {
                window.__router = f.memoizedProps.router;
                return window.__router;
              }
              if (f.stateNode && f.stateNode.router && typeof f.stateNode.router.navigate === 'function') {
                window.__router = f.stateNode.router;
                return window.__router;
              }
              if (f.child) queue.push(f.child);
              if (f.sibling) queue.push(f.sibling);
            }
          }
        }
      }
    } catch (e) {}
    return null;
  }

  function updateCustomBottomNavActive(path) {
    var bar = document.getElementById('kgt-customer-bottom-bar');
    if (!bar) return;
    var norm = path === '/' || path === '' ? '/home' : path;
    bar.querySelectorAll('.kgt-nav-tab').forEach(function (btn) {
      var tabPath = btn.getAttribute('data-path') || '';
      var isActive = tabPath === norm;
      var labelEl = btn.querySelector('.kgt-tab-label');
      var iconSvg = btn.querySelector('svg');
      if (isActive) {
        btn.style.color = '#F45D2C';
        if (labelEl) {
          labelEl.style.color = '#F45D2C';
          labelEl.style.fontWeight = '700';
        }
        if (iconSvg) {
          iconSvg.setAttribute('stroke', '#F45D2C');
          iconSvg.setAttribute('stroke-width', '2.5');
        }
      } else {
        btn.style.color = '#64748B';
        if (labelEl) {
          labelEl.style.color = '#64748B';
          labelEl.style.fontWeight = '500';
        }
        if (iconSvg) {
          iconSvg.setAttribute('stroke', '#64748B');
          iconSvg.setAttribute('stroke-width', '1.8');
        }
      }
    });

    var cartBadge = bar.querySelector('#kgt-cart-badge');
    var qty = getCartQty();
    if (cartBadge) {
      if (qty > 0) {
        cartBadge.textContent = qty > 99 ? '99+' : qty;
        cartBadge.style.display = 'grid';
      } else {
        cartBadge.style.display = 'none';
      }
    }
  }

  function doCustomerNavigate(path) {
    if (!path) return;
    var cur = window.location.pathname || '';
    if (cur === path) return;

    // Immediately reflect active tab on our custom bottom bar (0ms feedback)
    updateCustomBottomNavActive(path);
    recordCustomerNav(path);

    // 1. TanStack Router direct navigation (fastest, in-memory)
    var router = getTanStackRouter();
    if (router && typeof router.navigate === 'function') {
      try {
        router.navigate({ to: path });
        return;
      } catch (e) {
        console.warn('[KGT-NAV] router.navigate error:', e);
      }
    }

    // 2. Click React's hidden Link element in DOM
    var hiddenLink = document.querySelector('nav.khana-remote-nav a[href="' + path + '"], nav a[href="' + path + '"]');
    if (hiddenLink) {
      try {
        hiddenLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return;
      } catch (e) {}
    }

    // 3. Fallback: pushState + popstate
    try {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      window.location.href = path;
    }
  }

  function spaNavigate(path) {
    doCustomerNavigate(path);
  }

  function renderCustomerBottomBar(pathname) {
    var isLoginPage = pathname === '/login' || pathname.indexOf('/login') !== -1;
    var isLocationPage = pathname === '/location' || pathname.indexOf('/location') !== -1;
    var isCheckout = pathname === '/checkout' || pathname.indexOf('/checkout') !== -1;
    var isOrderDetail = pathname.indexOf('/order/') !== -1;

    var hideBar = isLoginPage || isLocationPage || isCheckout || isOrderDetail;

    var bar = document.getElementById('kgt-customer-bottom-bar');
    if (hideBar) {
      if (bar) bar.style.display = 'none';
      return;
    }

    if (bar && (!bar.querySelector('[data-path="/profile"]') || bar.querySelectorAll('.kgt-nav-tab').length < 4)) {
      bar.remove();
      bar = null;
    }

    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'kgt-customer-bottom-bar';
      bar.style.cssText =
        'position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:99999;' +
        'background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
        'border-top:1px solid #E2E8F0;padding-bottom:env(safe-area-inset-bottom,0px);' +
        'box-shadow:0 -2px 10px rgba(0,0,0,0.04);display:grid;grid-template-columns:repeat(4,1fr);' +
        'user-select:none;-webkit-user-select:none;box-sizing:border-box;';

      bar.innerHTML =
        '<button type="button" class="kgt-nav-tab" data-path="/home" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 0;background:none;border:none;cursor:pointer;outline:none;font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;">' +
        '  <span class="kgt-tab-icon" style="position:relative;display:flex;align-items:center;justify-content:center;height:22px;">' +
        '    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
        '  </span>' +
        '  <span class="kgt-tab-label" style="font-size:11px;font-weight:500;color:#64748B;">Home</span>' +
        '</button>' +
        '<button type="button" class="kgt-nav-tab" data-path="/orders" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 0;background:none;border:none;cursor:pointer;outline:none;font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;">' +
        '  <span class="kgt-tab-icon" style="position:relative;display:flex;align-items:center;justify-content:center;height:22px;">' +
        '    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v.5"/><path d="M12 6v.5"/></svg>' +
        '  </span>' +
        '  <span class="kgt-tab-label" style="font-size:11px;font-weight:500;color:#64748B;">Orders</span>' +
        '</button>' +
        '<button type="button" class="kgt-nav-tab" data-path="/cart" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 0;background:none;border:none;cursor:pointer;outline:none;font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;">' +
        '  <span class="kgt-tab-icon" style="position:relative;display:flex;align-items:center;justify-content:center;height:22px;">' +
        '    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
        '    <span id="kgt-cart-badge" style="display:none;position:absolute;top:-4px;right:-10px;height:16px;min-width:16px;border-radius:9999px;background:#F45D2C;color:#FFFFFF;font-size:10px;font-weight:700;line-height:16px;text-align:center;padding:0 4px;box-shadow:0 1px 3px rgba(244,93,44,0.4);"></span>' +
        '  </span>' +
        '  <span class="kgt-tab-label" style="font-size:11px;font-weight:500;color:#64748B;">Cart</span>' +
        '</button>' +
        '<button type="button" class="kgt-nav-tab" data-path="/profile" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 0;background:none;border:none;cursor:pointer;outline:none;font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;">' +
        '  <span class="kgt-tab-icon" style="position:relative;display:flex;align-items:center;justify-content:center;height:22px;">' +
        '    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '  </span>' +
        '  <span class="kgt-tab-label" style="font-size:11px;font-weight:500;color:#64748B;">Profile</span>' +
        '</button>';

      document.body.appendChild(bar);

      bar.querySelectorAll('.kgt-nav-tab').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var p = btn.getAttribute('data-path');
          if (p) doCustomerNavigate(p);
        });
      });
    }

    bar.style.display = 'grid';
    updateCustomBottomNavActive(pathname);
  }

  function getCustomerSessionInfo() {
    var name = localStorage.getItem('kgt:customer-name') || '';
    var phone = localStorage.getItem('kgt:customer-phone') || '';
    var address = localStorage.getItem('kgt:delivery-address') || '';
    var landmark = localStorage.getItem('kgt:delivery-landmark') || '';

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('-auth-token') !== -1) {
          var raw = localStorage.getItem(k);
          if (raw) {
            var session = JSON.parse(raw);
            if (session && session.user) {
              if (!phone && session.user.phone) {
                phone = session.user.phone.replace('+91', '').trim();
              }
              if (!name && session.user.user_metadata && session.user.user_metadata.full_name) {
                name = session.user.user_metadata.full_name;
              }
            }
          }
        }
      }
    } catch (e) {}

    return {
      name: name || 'Customer',
      phone: phone || '',
      address: address || '',
      landmark: landmark || ''
    };
  }

  function isReactProfileInDom() {
    var main = document.querySelector('main');
    if (!main) return false;
    var t = main.innerText || '';
    return t.indexOf('Saved Delivery Address') !== -1 || (t.indexOf('My Profile') !== -1 && t.indexOf('Customer') !== -1);
  }

  function showFallbackSupportModal() {
    var existing = document.getElementById('kgt-support-modal');
    if (existing) existing.remove();
    var m = document.createElement('div');
    m.id = 'kgt-support-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML =
      '<div style="background:#FFFFFF;width:100%;max-width:480px;border-radius:24px 24px 0 0;padding:24px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;box-shadow:0 -4px 20px rgba(0,0,0,0.1);">' +
      '  <div style="display:flex;justify-content:space-between;align-items:center;">' +
      '    <div style="font-size:16px;font-weight:800;color:#0F172A;">KhanaGharTak Support</div>' +
      '    <button id="kgt-close-support" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748B;line-height:1;padding:4px;">✕</button>' +
      '  </div>' +
      '  <p style="font-size:13px;color:#64748B;margin:0;">Need help with your order or have a query? We are here to help!</p>' +
      '  <a href="tel:+919711720846" style="padding:14px;border-radius:16px;background:#F45D2C;color:#FFFFFF;text-align:center;font-weight:700;font-size:14px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 10px rgba(244,93,44,0.3);">' +
      '    📞 Call Helpline: +91 97117 20846' +
      '  </a>' +
      '  <a href="https://wa.me/919711720846?text=Hi%20KhanaGharTak%20Support" target="_blank" style="padding:14px;border-radius:16px;background:#25D366;color:#FFFFFF;text-align:center;font-weight:700;font-size:14px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 10px rgba(37,211,102,0.3);">' +
      '    💬 Chat on WhatsApp' +
      '  </a>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('#kgt-close-support').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
  }

  function showFallbackRateModal() {
    var existing = document.getElementById('kgt-rate-modal');
    if (existing) existing.remove();
    var m = document.createElement('div');
    m.id = 'kgt-rate-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    var selectedStars = 5;
    m.innerHTML =
      '<div style="background:#FFFFFF;width:100%;max-width:380px;border-radius:24px;padding:24px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.15);">' +
      '  <div style="font-size:18px;font-weight:800;color:#0F172A;">Rate KhanaGharTak</div>' +
      '  <p style="font-size:13px;color:#64748B;margin:0;">How is your experience with KhanaGharTak food delivery?</p>' +
      '  <div id="kgt-stars-row" style="font-size:36px;display:flex;justify-content:center;gap:8px;cursor:pointer;color:#F59E0B;user-select:none;">' +
      '    <span data-val="1">★</span><span data-val="2">★</span><span data-val="3">★</span><span data-val="4">★</span><span data-val="5">★</span>' +
      '  </div>' +
      '  <button id="kgt-submit-rating" style="padding:13px;border-radius:14px;background:#F45D2C;color:#FFFFFF;border:none;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 3px 10px rgba(244,93,44,0.3);">Submit Review</button>' +
      '  <button id="kgt-cancel-rating" style="background:none;border:none;color:#64748B;font-size:13px;cursor:pointer;font-weight:600;">Cancel</button>' +
      '</div>';
    document.body.appendChild(m);
    var starSpans = m.querySelectorAll('#kgt-stars-row span');
    function updateStars(num) {
      selectedStars = num;
      starSpans.forEach(function (s, i) {
        s.textContent = (i < num) ? '★' : '☆';
      });
    }
    starSpans.forEach(function (s) {
      s.onclick = function () {
        updateStars(parseInt(s.getAttribute('data-val')));
      };
    });
    m.querySelector('#kgt-submit-rating').onclick = function () {
      try { localStorage.setItem('kgt:app-rated', '' + selectedStars); } catch (e) {}
      alert('Thank you for rating KhanaGharTak (' + selectedStars + '/5 stars)!');
      m.remove();
    };
    m.querySelector('#kgt-cancel-rating').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
  }

  function showFallbackEditModal(info) {
    var existing = document.getElementById('kgt-edit-modal');
    if (existing) existing.remove();
    var m = document.createElement('div');
    m.id = 'kgt-edit-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    m.innerHTML =
      '<div style="background:#FFFFFF;width:100%;max-width:400px;border-radius:24px;padding:22px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);">' +
      '  <div style="display:flex;justify-content:space-between;align-items:center;">' +
      '    <div style="font-size:16px;font-weight:800;color:#0F172A;">Edit Profile</div>' +
      '    <button id="kgt-close-edit" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748B;line-height:1;padding:4px;">✕</button>' +
      '  </div>' +
      '  <div>' +
      '    <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px;">Full Name</label>' +
      '    <input id="kgt-edit-name-inp" type="text" value="' + (info.name === 'Customer' ? '' : info.name) + '" placeholder="Your Full Name" style="width:100%;height:44px;border:1.5px solid #CBD5E1;border-radius:12px;padding:0 12px;font-size:14px;box-sizing:border-box;outline:none;" />' +
      '  </div>' +
      '  <div>' +
      '    <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px;">Mobile Number</label>' +
      '    <input id="kgt-edit-phone-inp" type="tel" maxlength="10" value="' + info.phone + '" placeholder="10-digit mobile number" style="width:100%;height:44px;border:1.5px solid #CBD5E1;border-radius:12px;padding:0 12px;font-size:14px;box-sizing:border-box;outline:none;" />' +
      '  </div>' +
      '  <div>' +
      '    <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px;">Delivery Address</label>' +
      '    <textarea id="kgt-edit-addr-inp" placeholder="House/Flat, Road, Area" style="width:100%;height:70px;border:1.5px solid #CBD5E1;border-radius:12px;padding:8px 12px;font-size:13px;box-sizing:border-box;outline:none;resize:none;">' + info.address + '</textarea>' +
      '  </div>' +
      '  <button id="kgt-save-edit-btn" style="height:46px;margin-top:6px;border-radius:14px;background:#F45D2C;color:#FFFFFF;border:none;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 3px 10px rgba(244,93,44,0.3);">Save Changes</button>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('#kgt-close-edit').onclick = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    m.querySelector('#kgt-save-edit-btn').onclick = function () {
      var newName = (m.querySelector('#kgt-edit-name-inp').value || '').trim();
      var newPhone = (m.querySelector('#kgt-edit-phone-inp').value || '').trim();
      var newAddr = (m.querySelector('#kgt-edit-addr-inp').value || '').trim();
      if (newName) localStorage.setItem('kgt:customer-name', newName);
      if (newPhone) localStorage.setItem('kgt:customer-phone', newPhone);
      if (newAddr) {
        localStorage.setItem('kgt:delivery-address', newAddr);
        window.dispatchEvent(new Event('kgt:address-changed'));
      }
      var nameEl = document.getElementById('kgt-fb-name-display');
      if (nameEl && newName) nameEl.textContent = newName;
      var phoneEl = document.getElementById('kgt-fb-phone-display');
      if (phoneEl && newPhone) phoneEl.textContent = '📞 +91 ' + newPhone;
      var addrEl = document.getElementById('kgt-fb-address-display');
      if (addrEl && newAddr) addrEl.textContent = newAddr;
      m.remove();
    };
  }

  function renderCustomerProfileFallback() {
    if (isReactProfileInDom()) {
      var fb = document.getElementById('kgt-customer-profile-fallback');
      if (fb) fb.remove();
      return;
    }

    var existingFallback = document.getElementById('kgt-customer-profile-fallback');
    if (existingFallback) return;

    var info = getCustomerSessionInfo();
    var initials = info.name
      ? info.name.split(' ').map(function (w) { return w ? w[0] : ''; }).join('').slice(0, 2).toUpperCase()
      : 'CU';

    var container = document.createElement('div');
    container.id = 'kgt-customer-profile-fallback';
    container.style.cssText =
      'position:relative;z-index:100;min-height:100vh;padding-bottom:120px;background:#FAFAFA;color:#0F172A;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;';

    container.innerHTML =
      '<!-- Header -->' +
      '<header style="position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.95);backdrop-filter:blur(10px);padding:10px 16px;border-bottom:1px solid #E2E8F0;">' +
      '  <div style="display:flex;align-items:center;gap:10px;">' +
      '    <img src="/khanaghartak-logo.png" onerror="this.src=\'https://khanaghartak.in/__l5e/assets-v1/8863a66e-7115-4037-ab62-8765b7ae09f3/khanaghartak-logo.png\'" style="width:36px;height:36px;border-radius:10px;object-fit:contain;" />' +
      '    <div>' +
      '      <div style="font-size:15px;font-weight:900;color:#0F172A;line-height:1.2;">KhanaGharTak</div>' +
      '      <div style="font-size:11px;font-weight:600;color:#64748B;">My Profile</div>' +
      '    </div>' +
      '  </div>' +
      '  <button id="kgt-fb-top-loc-btn" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:9999px;border:1px solid rgba(244,93,44,0.3);background:#FFF8F5;color:#F45D2C;font-size:11px;font-weight:700;cursor:pointer;">' +
      '    📍 Location ∨' +
      '  </button>' +
      '</header>' +

      '<div style="max-width:480px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box;">' +
      '  <!-- Customer Card -->' +
      '  <div style="background:#FFFFFF;border-radius:24px;border:1px solid #E2E8F0;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.03);display:flex;align-items:center;gap:14px;">' +
      '    <div style="width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#F45D2C,#E04818);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:20px;font-weight:900;flex-shrink:0;box-shadow:0 4px 12px rgba(244,93,44,0.25);">' +
      '      ' + initials +
      '    </div>' +
      '    <div style="flex:1;min-width:0;">' +
      '      <div style="display:flex;align-items:center;gap:6px;">' +
      '        <div id="kgt-fb-name-display" style="font-size:17px;font-weight:800;color:#0F172A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + info.name + '</div>' +
      '        <span style="font-size:10px;font-weight:700;color:#059669;background:#ECFDF5;padding:2px 8px;border-radius:9999px;">Customer</span>' +
      '      </div>' +
      '      <div id="kgt-fb-phone-display" style="font-size:12px;color:#64748B;margin-top:3px;display:flex;align-items:center;gap:4px;">' +
      '        📞 <span>' + (info.phone ? '+91 ' + info.phone : 'No mobile added') + '</span>' +
      '      </div>' +
      '    </div>' +
      '    <button id="kgt-fb-edit-btn" style="padding:8px 10px;border-radius:12px;border:1px solid #CBD5E1;background:#F8FAFC;font-size:12px;font-weight:700;color:#334155;cursor:pointer;">' +
      '      Edit' +
      '    </button>' +
      '  </div>' +

      '  <!-- Saved Delivery Address -->' +
      '  <div style="background:#FFFFFF;border-radius:20px;border:1px solid #E2E8F0;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.03);">' +
      '    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #F1F5F9;">' +
      '      <span style="font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#64748B;">📍 Saved Delivery Address</span>' +
      '      <button id="kgt-fb-change-map-btn" style="background:none;border:none;font-size:12px;font-weight:700;color:#F45D2C;cursor:pointer;">Change on Map</button>' +
      '    </div>' +
      '    <div id="kgt-fb-address-display" style="padding-top:12px;font-size:13px;font-weight:600;color:#1E293B;line-height:1.5;word-break:break-word;">' +
      '      ' + (info.address || 'No address saved yet. Tap "Change on Map" to set your location.') +
      '    </div>' +
      '  </div>' +

      '  <!-- Shortcuts: Orders, Help, Rate -->' +
      '  <div style="background:#FFFFFF;border-radius:20px;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.03);overflow:hidden;">' +
      '    <button id="kgt-fb-orders-row" style="width:100%;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:none;border-bottom:1px solid #F1F5F9;cursor:pointer;text-align:left;">' +
      '      <div style="display:flex;align-items:center;gap:12px;">' +
      '        <div style="width:36px;height:36px;border-radius:10px;background:rgba(244,93,44,0.1);color:#F45D2C;display:flex;align-items:center;justify-content:center;font-size:17px;">🧾</div>' +
      '        <div>' +
      '          <div style="font-size:14px;font-weight:700;color:#0F172A;">My Orders</div>' +
      '          <div style="font-size:11px;color:#64748B;">View past orders and live tracking</div>' +
      '        </div>' +
      '      </div>' +
      '      <span style="color:#94A3B8;font-size:18px;">›</span>' +
      '    </button>' +

      '    <button id="kgt-fb-support-row" style="width:100%;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:none;border-bottom:1px solid #F1F5F9;cursor:pointer;text-align:left;">' +
      '      <div style="display:flex;align-items:center;gap:12px;">' +
      '        <div style="width:36px;height:36px;border-radius:10px;background:rgba(244,93,44,0.1);color:#F45D2C;display:flex;align-items:center;justify-content:center;font-size:17px;">🎧</div>' +
      '        <div>' +
      '          <div style="font-size:14px;font-weight:700;color:#0F172A;">Help & Support</div>' +
      '          <div style="font-size:11px;color:#64748B;">Call or WhatsApp our delivery team</div>' +
      '        </div>' +
      '      </div>' +
      '      <span style="color:#94A3B8;font-size:18px;">›</span>' +
      '    </button>' +

      '    <button id="kgt-fb-rate-row" style="width:100%;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;text-align:left;">' +
      '      <div style="display:flex;align-items:center;gap:12px;">' +
      '        <div style="width:36px;height:36px;border-radius:10px;background:rgba(245,158,11,0.12);color:#F59E0B;display:flex;align-items:center;justify-content:center;font-size:17px;">⭐</div>' +
      '        <div>' +
      '          <div style="font-size:14px;font-weight:700;color:#0F172A;">Rate & Review KhanaGharTak</div>' +
      '          <div style="font-size:11px;color:#64748B;">Help us serve you better</div>' +
      '        </div>' +
      '      </div>' +
      '      <span style="color:#94A3B8;font-size:18px;">›</span>' +
      '    </button>' +
      '  </div>' +

      '  <!-- Legal -->' +
      '  <div style="background:#FFFFFF;border-radius:20px;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.03);overflow:hidden;">' +
      '    <button id="kgt-fb-terms-row" style="width:100%;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:none;border-bottom:1px solid #F1F5F9;cursor:pointer;text-align:left;">' +
      '      <div style="display:flex;align-items:center;gap:12px;">' +
      '        <div style="width:36px;height:36px;border-radius:10px;background:#F1F5F9;color:#64748B;display:flex;align-items:center;justify-content:center;font-size:16px;">📄</div>' +
      '        <div style="font-size:14px;font-weight:600;color:#0F172A;">Terms & Conditions</div>' +
      '      </div>' +
      '      <span style="color:#94A3B8;font-size:18px;">›</span>' +
      '    </button>' +

      '    <button id="kgt-fb-privacy-row" style="width:100%;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;background:none;border:none;cursor:pointer;text-align:left;">' +
      '      <div style="display:flex;align-items:center;gap:12px;">' +
      '        <div style="width:36px;height:36px;border-radius:10px;background:#F1F5F9;color:#64748B;display:flex;align-items:center;justify-content:center;font-size:16px;">🛡️</div>' +
      '        <div style="font-size:14px;font-weight:600;color:#0F172A;">Privacy Policy</div>' +
      '      </div>' +
      '      <span style="color:#94A3B8;font-size:18px;">›</span>' +
      '    </button>' +
      '  </div>' +

      '  <!-- Logout Button -->' +
      '  <button id="kgt-fb-logout-btn" style="width:100%;padding:14px;border-radius:18px;border:1px solid #FEE2E2;background:#FEF2F2;color:#DC2626;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">' +
      '    🚪 Logout' +
      '  </button>' +
      '</div>';

    document.body.appendChild(container);

    // Bind fallback events
    var locTopBtn = document.getElementById('kgt-fb-top-loc-btn');
    if (locTopBtn) locTopBtn.onclick = function () { doCustomerNavigate('/location'); };
    var changeMapBtn = document.getElementById('kgt-fb-change-map-btn');
    if (changeMapBtn) changeMapBtn.onclick = function () { doCustomerNavigate('/location'); };
    var ordersRow = document.getElementById('kgt-fb-orders-row');
    if (ordersRow) ordersRow.onclick = function () { doCustomerNavigate('/orders'); };
    var supportRow = document.getElementById('kgt-fb-support-row');
    if (supportRow) supportRow.onclick = function () { showFallbackSupportModal(); };
    var rateRow = document.getElementById('kgt-fb-rate-row');
    if (rateRow) rateRow.onclick = function () { showFallbackRateModal(); };
    var termsRow = document.getElementById('kgt-fb-terms-row');
    if (termsRow) termsRow.onclick = function () { doCustomerNavigate('/terms-and-conditions'); };
    var privacyRow = document.getElementById('kgt-fb-privacy-row');
    if (privacyRow) privacyRow.onclick = function () { doCustomerNavigate('/privacy-policy'); };
    var editBtn = document.getElementById('kgt-fb-edit-btn');
    if (editBtn) editBtn.onclick = function () { showFallbackEditModal(info); };
    var logoutBtn = document.getElementById('kgt-fb-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        if (confirm('Are you sure you want to logout?')) {
          try {
            localStorage.removeItem('kgt:has-session');
            for (var i = localStorage.length - 1; i >= 0; i--) {
              var k = localStorage.key(i) || '';
              if (k.indexOf('-auth-token') !== -1) {
                localStorage.removeItem(k);
              }
            }
          } catch (e) {}
          window.location.replace('/login?as=customer');
        }
      };
    }
  }

  function checkHasCustomerSession() {
    try {
      if (localStorage.getItem('kgt:has-session') === 'true') return true;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('-auth-token') !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  function renderLoginPortal() {
    var pathname = window.location.pathname || '';
    var isLoginPage = pathname === '/login' || pathname.indexOf('/login') !== -1;
    var hasSession = checkHasCustomerSession();

    if (hasSession) {
      var p = document.getElementById('kgt-customer-login-portal');
      if (p) p.remove();
      if (isLoginPage) {
        window.location.replace('/home');
      }
      return;
    }

    if (!isLoginPage) {
      if (pathname === '/' || pathname === '' || pathname === '/home') {
        window.location.replace('/login?as=customer');
        return;
      }
    }

    var portal = document.getElementById('kgt-customer-login-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'kgt-customer-login-portal';
      portal.style.cssText =
        'position:fixed;inset:0;z-index:9999999;background:#FFFFFF;width:100vw;height:100vh;overflow-y:auto;display:flex;flex-direction:column;align-items:center;font-family:system-ui,-apple-system,sans-serif;color:#0F172A;box-sizing:border-box;';
      document.body.appendChild(portal);
    }

    if (!window.__customer_login_step) window.__customer_login_step = 'phone';

    if (window.__customer_login_step === 'phone') {
      if (portal.getAttribute('data-step') !== 'phone') {
        portal.setAttribute('data-step', 'phone');
        portal.innerHTML =
          '<div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px 8px 20px;height:45vh;min-height:240px;max-height:360px;box-sizing:border-box;">' +
          '  <img id="customer-portal-logo" src="https://khanaghartak.in/__l5e/assets-v1/8863a66e-7115-4037-ab62-8765b7ae09f3/khanaghartak-logo.png" ' +
          '       alt="KhanaGharTak" ' +
          '       style="width:auto;height:auto;max-width:270px;max-height:100%;aspect-ratio:1/1;object-fit:contain;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,0.06);display:block;margin:0 auto;" />' +
          '</div>' +
          '<div style="width:100%;max-width:420px;margin:0 auto;padding:8px 24px 32px 24px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">' +
          '  <div style="margin-bottom:2px;">' +
          '    <h1 style="font-size:18px;font-weight:800;color:#0F172A;margin:0 0 4px 0;">Enter mobile number</h1>' +
          '    <p style="font-size:12px;color:#64748B;margin:0;">We will send you an OTP to verify your account</p>' +
          '  </div>' +
          '  <div style="display:flex;align-items:center;border:1.5px solid #CBD5E1;border-radius:16px;padding:0 14px;background:#FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,0.04);">' +
          '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" style="flex-shrink:0;margin-right:8px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
          '    <span style="font-size:15px;font-weight:700;color:#334155;margin-right:8px;">+91</span>' +
          '    <input id="customer-portal-phone" type="tel" maxlength="10" placeholder="10-digit mobile number" style="width:100%;height:52px;border:none;background:transparent;font-size:16px;font-weight:600;color:#0F172A;outline:none;" />' +
          '  </div>' +
          '  <button id="customer-portal-send-btn" type="button" style="height:52px;width:100%;border-radius:16px;background:#F45D2C;color:#FFFFFF;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(244,93,44,0.3);outline:none;">' +
          '    Send OTP' +
          '  </button>' +
          '</div>';

        var pImg = document.getElementById('customer-portal-logo');
        if (pImg) {
          pImg.onerror = function () {
            this.onerror = null;
            this.src = '/khanaghartak-logo.png';
          };
        }

  var REVIEWER_PHONE = '9999999999';
  var REVIEWER_OTP = '123456';

  function completeReviewerLogin() {
    try {
      var nowSec = Math.floor(Date.now() / 1000);
      var expSec = nowSec + 3600 * 24 * 365;
      var headerObj = { alg: "HS256", typ: "JWT" };
      var payloadObj = {
        iss: "supabase",
        ref: "bvacebeorvxwcfkselon",
        role: "authenticated",
        sub: "69d92195-e014-44f9-8803-ac44e6e64128",
        email: "p9999999999@phone.khanaghartak.in",
        aud: "authenticated",
        iat: nowSec,
        exp: expSec,
        user_metadata: {
          full_name: "+91 9999999999",
          phone: "9999999999",
          signup_method: "phone_otp"
        }
      };

      function base64UrlEncode(str) {
        return btoa(unescape(encodeURIComponent(str)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      }

      var headerEnc = base64UrlEncode(JSON.stringify(headerObj));
      var payloadEnc = base64UrlEncode(JSON.stringify(payloadObj));
      var fakeJwt = headerEnc + '.' + payloadEnc + '.reviewer_sig_kgt_2026';

      var reviewerSession = {
        access_token: fakeJwt,
        token_type: "bearer",
        expires_in: 3600 * 24 * 365,
        expires_at: expSec,
        refresh_token: "kgt_reviewer_refresh_token_2026",
        user: {
          id: "69d92195-e014-44f9-8803-ac44e6e64128",
          aud: "authenticated",
          role: "authenticated",
          email: "p9999999999@phone.khanaghartak.in",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          phone: "9999999999",
          confirmed_at: "2026-01-01T00:00:00Z",
          last_sign_in_at: new Date().toISOString(),
          app_metadata: {
            provider: "email",
            providers: ["email"]
          },
          user_metadata: {
            full_name: "+91 9999999999",
            phone: "9999999999",
            signup_method: "phone_otp"
          },
          identities: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: new Date().toISOString()
        }
      };

      localStorage.setItem('sb-bvacebeorvxwcfkselon-auth-token', JSON.stringify(reviewerSession));
      localStorage.setItem('kgt:has-session', 'true');
      localStorage.setItem('kgt:delivery-address', 'Main Bazaar, Shankargarh, Prayagraj - 212108');
      localStorage.setItem('kgt:user-coords', JSON.stringify({ lat: 25.1842, lng: 81.6212, ts: Date.now() }));
      localStorage.removeItem('kgt:device-outside');

      try {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('kgt:address-changed', {
          detail: { address: 'Main Bazaar, Shankargarh, Prayagraj - 212108', lat: 25.1842, lng: 81.6212 }
        }));
      } catch (e) {}

      var p = document.getElementById('kgt-customer-login-portal');
      if (p) p.remove();

      var r = getTanStackRouter();
      if (r && typeof r.navigate === 'function') {
        try {
          r.navigate({ to: '/home', replace: true });
          return;
        } catch (e) {}
      }

      window.location.replace('/home');
    } catch (e) {
      console.error('[KGT] completeReviewerLogin error:', e);
      window.location.replace('/home');
    }
  }

        var phoneInp = document.getElementById('customer-portal-phone');
        var sendBtn = document.getElementById('customer-portal-send-btn');
        if (sendBtn && phoneInp) {
          sendBtn.onclick = function () {
            var raw = (phoneInp.value || '').replace(/\D/g, '').slice(-10);
            if (raw.length !== 10 || !/^[6-9]\d{9}$/.test(raw)) {
              alert('Please enter a valid 10-digit mobile number');
              return;
            }
            window.__customer_phone = raw;
            sendBtn.disabled = true;
            sendBtn.innerText = 'Sending OTP…';

            // Check if dedicated Play Store Reviewer test account
            if (raw === REVIEWER_PHONE) {
              window.__is_reviewer = true;
              setTimeout(function () {
                window.__customer_login_step = 'otp';
                renderLoginPortal();
              }, 400);
              return;
            }

            window.__is_reviewer = false;
            if (window.AndroidOtp && typeof window.AndroidOtp.startSmsConsent === 'function') {
              window.AndroidOtp.startSmsConsent();
            }
            var underlying = document.querySelector(
              'input[placeholder*="10-digit" i], input[type="tel"], input[placeholder*="number" i]'
            );
            if (underlying) {
              var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              if (setter) setter.call(underlying, raw);
              else underlying.value = raw;
              underlying.dispatchEvent(new Event('input', { bubbles: true }));
              underlying.dispatchEvent(new Event('change', { bubbles: true }));
            }
            var uBtn = null;
            document.querySelectorAll('button').forEach(function (b) {
              var t = (b.textContent || '').trim().toLowerCase();
              if (t.indexOf('send otp') !== -1 && b !== sendBtn) uBtn = b;
            });
            if (uBtn) uBtn.click();
            setTimeout(function () {
              window.__customer_login_step = 'otp';
              renderLoginPortal();
            }, 700);
          };
        }
      }
    } else if (window.__customer_login_step === 'otp') {
      if (portal.getAttribute('data-step') !== 'otp') {
        portal.setAttribute('data-step', 'otp');
        var ph = window.__customer_phone || '';
        var isReviewer = !!window.__is_reviewer;
        var otpMaxLen = isReviewer ? 6 : 4;
        var otpPlaceholder = isReviewer ? '______' : '____';
        var otpSubtitle = isReviewer
          ? 'Enter the 6-digit test code sent to +91 ' + ph
          : 'Enter the 4-digit code sent to +91 ' + ph;
        var letterSpacing = isReviewer ? '6px' : '10px';

        portal.innerHTML =
          '<div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px 8px 20px;height:45vh;min-height:240px;max-height:360px;box-sizing:border-box;">' +
          '  <img id="customer-portal-logo-otp" src="https://khanaghartak.in/__l5e/assets-v1/8863a66e-7115-4037-ab62-8765b7ae09f3/khanaghartak-logo.png" ' +
          '       alt="KhanaGharTak" ' +
          '       style="width:auto;height:auto;max-width:270px;max-height:100%;aspect-ratio:1/1;object-fit:contain;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,0.06);display:block;margin:0 auto;" />' +
          '</div>' +
          '<div style="width:100%;max-width:420px;margin:0 auto;padding:8px 24px 32px 24px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">' +
          '  <div style="text-align:center;margin-bottom:4px;">' +
          '    <h1 style="font-size:18px;font-weight:800;color:#0F172A;margin:0 0 4px 0;">Enter OTP</h1>' +
          '    <p style="font-size:12px;color:#64748B;margin:0;">' + otpSubtitle + '</p>' +
          '  </div>' +
          '  <input id="customer-portal-otp" type="tel" maxlength="' + otpMaxLen + '" placeholder="' + otpPlaceholder + '" style="width:100%;height:54px;border:1.5px solid #CBD5E1;border-radius:16px;font-size:24px;font-weight:800;text-align:center;letter-spacing:' + letterSpacing + ';color:#0F172A;outline:none;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.05);" />' +
          '  <button id="customer-portal-verify-btn" type="button" style="height:52px;width:100%;border-radius:16px;background:#F45D2C;color:#FFFFFF;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(244,93,44,0.3);outline:none;">' +
          '    Verify & continue' +
          '  </button>' +
          '  <div style="display:flex;align-items:center;justify-content:space-between;padding-top:4px;">' +
          '    <button id="customer-portal-change-btn" type="button" style="background:transparent;border:none;color:#475569;font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;">Change mobile number</button>' +
          (isReviewer ? '' : '    <button id="customer-portal-resend-btn" type="button" style="background:transparent;border:none;color:#F45D2C;font-size:12px;font-weight:700;cursor:pointer;">Resend OTP</button>') +
          '  </div>' +
          '</div>';

        var pImgOtp = document.getElementById('customer-portal-logo-otp');
        if (pImgOtp) {
          pImgOtp.onerror = function () {
            this.onerror = null;
            this.src = '/khanaghartak-logo.png';
          };
        }

        var otpInp = document.getElementById('customer-portal-otp');
        var vBtn = document.getElementById('customer-portal-verify-btn');
        var chBtn = document.getElementById('customer-portal-change-btn');
        var reBtn = document.getElementById('customer-portal-resend-btn');

        function doVerify(code) {
          if (window.__is_reviewer) {
            var val = (code || (otpInp ? otpInp.value : '')).replace(/\D/g, '').slice(0, 6);
            if (val.length !== 6) {
              alert('Please enter the 6-digit test OTP');
              return;
            }
            if (val !== REVIEWER_OTP) {
              alert('Invalid test OTP. Use 123456');
              if (vBtn) {
                vBtn.disabled = false;
                vBtn.innerText = 'Verify & continue';
              }
              if (otpInp) otpInp.value = '';
              return;
            }
            if (vBtn) {
              vBtn.disabled = true;
              vBtn.innerText = 'Verifying…';
            }
            completeReviewerLogin();
            return;
          }

          var val = (code || (otpInp ? otpInp.value : '')).replace(/\D/g, '').slice(0, 4);
          if (val.length !== 4) {
            alert('Please enter the 4-digit OTP');
            return;
          }
          if (vBtn) {
            vBtn.disabled = true;
            vBtn.innerText = 'Verifying…';
          }
          var underOtp = document.querySelector(
            'input[placeholder*="____"], input.ck-input, input[name="one-time-code"]'
          );
          if (underOtp) {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            if (setter) setter.call(underOtp, val);
            else underOtp.value = val;
            underOtp.dispatchEvent(new Event('input', { bubbles: true }));
            underOtp.dispatchEvent(new Event('change', { bubbles: true }));
          }
          var underV = null;
          document.querySelectorAll('button').forEach(function (b) {
            var t = (b.textContent || '').trim().toLowerCase();
            if ((t.indexOf('verify') !== -1 || t.indexOf('continue') !== -1) && b !== vBtn) underV = b;
          });
          if (underV) underV.click();
        }

        if (otpInp) {
          otpInp.oninput = function () {
            var maxL = window.__is_reviewer ? 6 : 4;
            var v = otpInp.value.replace(/\D/g, '').slice(0, maxL);
            otpInp.value = v;
            if (v.length === maxL) {
              setTimeout(function () {
                doVerify(v);
              }, 200);
            }
          };
        }
        if (vBtn) {
          vBtn.onclick = function () {
            doVerify();
          };
        }
        if (chBtn) {
          chBtn.onclick = function () {
            window.__customer_login_step = 'phone';
            window.__is_reviewer = false;
            renderLoginPortal();
          };
        }
        if (reBtn) {
          reBtn.onclick = function () {
            if (window.AndroidOtp && typeof window.AndroidOtp.startSmsConsent === 'function') {
              window.AndroidOtp.startSmsConsent();
            }
            var uRe = null;
            document.querySelectorAll('button').forEach(function (b) {
              var t = (b.textContent || '').trim().toLowerCase();
              if (t.indexOf('resend') !== -1 && b !== reBtn) uRe = b;
            });
            if (uRe) uRe.click();
            alert('OTP resent via SMS');
          };
        }

        window.__kgt_set_otp = function (otp) {
          if (window.__is_reviewer) return;
          var clean = (otp || '').replace(/\D/g, '').slice(0, 4);
          if (clean.length === 4 && otpInp) {
            otpInp.value = clean;
            setTimeout(function () {
              doVerify(clean);
            }, 200);
          }
        };
      }
    }
  }

  function updateAppUi() {
    var pathname = window.location.pathname || '';

    var isLoginPage = pathname === '/login' || pathname.indexOf('/login') !== -1;
    var isLocationPage = pathname === '/location' || pathname.indexOf('/location') !== -1;
    var isHomePage = pathname === '/home' || pathname.indexOf('/home') !== -1;
    var isMenuPage = pathname === '/menu' || pathname.indexOf('/menu') !== -1;

    // 1. Session & Routing Check
    var hasCustomerSession = checkHasCustomerSession();
    if (pathname === '/' || pathname === '') {
      if (hasCustomerSession) {
        window.location.replace('/home');
      } else {
        window.location.replace('/login?as=customer');
      }
      return;
    }
    if (isLoginPage && hasCustomerSession) {
      window.location.replace('/home');
      return;
    }
    if ((isHomePage || isMenuPage || pathname === '/profile') && !hasCustomerSession) {
      window.location.replace('/login?as=customer');
      return;
    }

    // 2. Global CSS Injection
    var style = document.getElementById('khana-customer-ui-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'khana-customer-ui-style';
      style.innerHTML =
        'header a[href*="/cart"], header a[aria-label*="Cart"], header a[aria-label*="cart"] { display: none !important; }' +
        'body nav:not(#kgt-customer-bottom-bar) { position: fixed !important; bottom: -9999px !important; left: -9999px !important; opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; overflow: hidden !important; z-index: -9999 !important; }';
      document.head.appendChild(style);
    }

    // 3. Customer Bottom Nav: Render dedicated 4-tab bar and off-screen remote React nav
    var remoteNavs = document.querySelectorAll('nav:not(#kgt-customer-bottom-bar)');
    remoteNavs.forEach(function (n) {
      n.classList.add('khana-remote-nav');
      n.style.setProperty('position', 'fixed', 'important');
      n.style.setProperty('bottom', '-9999px', 'important');
      n.style.setProperty('left', '-9999px', 'important');
      n.style.setProperty('opacity', '0', 'important');
      n.style.setProperty('pointer-events', 'none', 'important');
      n.style.setProperty('visibility', 'hidden', 'important');
      n.style.setProperty('height', '0', 'important');
      n.style.setProperty('overflow', 'hidden', 'important');
      n.style.setProperty('z-index', '-9999', 'important');
    });
    renderCustomerBottomBar(pathname);

    // Profile Page fallback renderer
    if (pathname === '/profile') {
      renderCustomerProfileFallback();
    } else {
      var fbProf = document.getElementById('kgt-customer-profile-fallback');
      if (fbProf) fbProf.remove();
    }

    // 4. Dedicated Sign-In Portal (Upper ~50% logo, lower mobile input)
    if (isLoginPage) {
      renderLoginPortal();
    } else {
      var existingPortal = document.getElementById('kgt-customer-login-portal');
      if (existingPortal) existingPortal.remove();
    }

    // 5. Header: Clickable "Deliver to: ..." section
    var header = document.querySelector('header');
    if (header) {
      header.querySelectorAll('a').forEach(function (a) {
        var href = a.getAttribute('href') || '';
        var aria = a.getAttribute('aria-label') || '';
        if (href.indexOf('/cart') !== -1 || aria.toLowerCase().indexOf('cart') !== -1) {
          a.style.display = 'none';
        }
      });
      var chip = document.getElementById('khana-header-delivery-chip');
      if (isLocationPage || isLoginPage) {
        if (chip) chip.style.display = 'none';
      } else {
        var savedAddr = localStorage.getItem('kgt:delivery-address') || '';
        var chipLabel = savedAddr
          ? 'Deliver to: ' + (savedAddr.length > 20 ? savedAddr.slice(0, 20) + '…' : savedAddr)
          : 'Deliver to: Set location';
        if (!chip) {
          chip = document.createElement('button');
          chip.id = 'khana-header-delivery-chip';
          chip.type = 'button';
          chip.style.cssText =
            'display:inline-flex;align-items:center;gap:4px;background:#FFF3EB;border:1px solid #FED7AA;border-radius:9999px;padding:4px 10px;font-size:11px;font-weight:700;color:#C2410C;cursor:pointer;margin-left:8px;outline:none;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.06);transition:transform 0.1s ease;';
          chip.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            spaNavigate('/location');
          };
          var brandEl =
            header.querySelector('a[href="/"]') ||
            header.querySelector('a[href="/home"]') ||
            header.firstElementChild;
          if (brandEl && brandEl.parentNode) {
            brandEl.parentNode.insertBefore(chip, brandEl.nextSibling);
          } else {
            header.appendChild(chip);
          }
        }
        chip.style.display = 'inline-flex';
        chip.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F45D2C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:145px;">' +
          chipLabel +
          '</span>' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F45D2C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="m6 9 6 6 6-6"/></svg>';
        header.querySelectorAll('.text-\\[11px\\], .text-muted-foreground').forEach(function (el) {
          var txt = (el.textContent || '').trim();
          if (
            txt.indexOf('Deliver to') !== -1 ||
            txt.indexOf('delivery location') !== -1 ||
            txt.indexOf('Set your delivery') !== -1
          ) {
            el.style.display = 'none';
          }
        });
      }
    }

    // 6. Location Page (/location) interactive presets & location status
    if (isLocationPage) {
      document.body.classList.remove('khana-outside-service-zone');
      var locOutsideHome = document.getElementById('khana-outside-home-screen');
      if (locOutsideHome) locOutsideHome.remove();
      var oldPresets = document.getElementById('khana-presets-container');
      if (oldPresets) oldPresets.remove();
      var confirmBtn = null;
      document.querySelectorAll('button').forEach(function (b) {
        var t = (b.textContent || '').trim();
        if (t.indexOf('Confirm') !== -1 || t.indexOf('Save') !== -1) {
          confirmBtn = b;
        }
      });
      if (confirmBtn && !confirmBtn.__khana_hooked) {
        confirmBtn.__khana_hooked = true;
        confirmBtn.addEventListener(
          'click',
          function (e) {
            var ta = document.querySelector('textarea');
            var addr = ta ? ta.value.trim() : '';
            if (!addr) {
              alert('Please enter or select a delivery address.');
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            var coords = window.__khana_selected_coords || null;
            if (!coords && window.__native_device_coords) {
              coords = window.__native_device_coords;
            }
            localStorage.setItem('kgt:delivery-address', addr);
            if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              localStorage.setItem(
                'kgt:user-coords',
                JSON.stringify({ lat: coords.lat, lng: coords.lng, ts: Date.now() })
              );
            }
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('kgt:address-changed'));
            setTimeout(function () {
              spaNavigate('/home');
            }, 50);
          },
          true
        );
      }
    }

    // 7. Outside Service Zone Check
    var hiderStyle = document.getElementById('khana-outside-zone-hider');
    if (!hiderStyle) {
      hiderStyle = document.createElement('style');
      hiderStyle.id = 'khana-outside-zone-hider';
      hiderStyle.innerHTML =
        '@keyframes khanaPing { 75%, 100% { transform: scale(1.6); opacity: 0; } }' +
        '@keyframes khanaPulse { 50% { opacity: 0.45; transform: scale(1.08); } }' +
        'body.khana-outside-service-zone a[href*="/menu"], ' +
        'body.khana-outside-service-zone a[href*="/restaurant"], ' +
        'body.khana-outside-service-zone .restaurant-card, ' +
        'body.khana-outside-service-zone div.-mx-4.mb-5, ' +
        'body.khana-outside-service-zone #khana-customer-search-bar, ' +
        'body.khana-outside-service-zone #khana-search-empty-note, ' +
        'body.khana-outside-service-zone .px-4.pt-4 > *:not(#khana-outside-home-screen) { ' +
        '  display: none !important; ' +
        '}';
      document.head.appendChild(hiderStyle);
    }

    var savedDeliveryAddr = localStorage.getItem('kgt:delivery-address') || '';
    var savedCoordsObj = null;
    try {
      var rawC = localStorage.getItem('kgt:user-coords');
      if (rawC) savedCoordsObj = JSON.parse(rawC);
    } catch (e) {}
    if ((!savedCoordsObj || typeof savedCoordsObj.lat !== 'number') && window.__native_device_coords) {
      savedCoordsObj = window.__native_device_coords;
    }
    var isCustomerDeliveryOutside = false;
    if (savedDeliveryAddr || (savedCoordsObj && typeof savedCoordsObj.lat === 'number')) {
      isCustomerDeliveryOutside = !isDeliveryLocationInZone(savedDeliveryAddr, savedCoordsObj);
    } else if (window.__native_device_coords && typeof window.__native_device_coords.lat === 'number') {
      isCustomerDeliveryOutside = !isDeliveryLocationInZone(
        '',
        window.__native_device_coords
      );
    } else if (window.__native_device_outside === true) {
      isCustomerDeliveryOutside = true;
    }

    if (isHomePage) {
      var existingCards = document.querySelectorAll('a[href*="/menu"]');
      if (existingCards.length > 0) {
        isCustomerDeliveryOutside = false;
      }
    }

    if (isHomePage) {
      if (isCustomerDeliveryOutside) {
        document.body.classList.add('khana-outside-service-zone');
        var existingSearch = document.getElementById('khana-customer-search-bar');
        if (existingSearch) existingSearch.style.display = 'none';
        var catRow = document.querySelector('div.-mx-4.mb-5');
        if (catRow) catRow.style.display = 'none';
        document.querySelectorAll('a[href*="/menu"]').forEach(function (c) {
          c.style.display = 'none';
        });

        var homeContainer =
          document.querySelector('.px-4.pt-4') || document.querySelector('.pb-10') || document.body;
        var outsideHome = document.getElementById('khana-outside-home-screen');
        if (!outsideHome && homeContainer) {
          outsideHome = document.createElement('div');
          outsideHome.id = 'khana-outside-home-screen';
          outsideHome.style.cssText =
            'padding:32px 16px 60px 16px;text-align:center;max-width:400px;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:65vh;';

          var displayAddr = savedDeliveryAddr || '';
          var addrNote = displayAddr
            ? 'Delivery is currently unavailable at <strong style="color:#0F172A;">"' +
              (displayAddr.length > 35 ? displayAddr.slice(0, 35) + '…' : displayAddr) +
              '"</strong>.'
            : 'KhanaGharTak is currently delivering in our active service zones (Shankargarh, Chakghat & nearby areas).';

          outsideHome.innerHTML =
            '<div style="position:relative;margin:0 auto 20px auto;width:112px;height:112px;display:flex;align-items:center;justify-content:center;">' +
            '  <div style="position:absolute;width:112px;height:112px;border-radius:50%;background:rgba(244,93,44,0.15);animation:khanaPing 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>' +
            '  <div style="position:absolute;width:80px;height:80px;border-radius:50%;background:rgba(244,93,44,0.25);animation:khanaPulse 2s cubic-bezier(0.4,0,0.6,1) infinite;"></div>' +
            '  <div style="position:relative;width:64px;height:64px;border-radius:24px;background:linear-gradient(135deg, #F45D2C 0%, #F59E0B 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -6px rgba(244,93,44,0.45);">' +
            '    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>' +
            '      <circle cx="12" cy="10" r="3"/>' +
            '    </svg>' +
            '  </div>' +
            '</div>' +
            '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:700;color:#B45309;margin-bottom:12px;">' +
            '  <span style="width:8px;height:8px;border-radius:50%;background:#F59E0B;display:inline-block;animation:khanaPulse 1.5s infinite;"></span>' +
            '  Outside Delivery Zone' +
            '</div>' +
            '<h1 style="font-size:22px;font-weight:800;color:#0F172A;line-height:1.25;margin:0 0 10px 0;">' +
            '  We are not serving in your area yet.' +
            '</h1>' +
            '<p style="font-size:13.5px;color:#64748B;line-height:1.55;margin:0 0 24px 0;max-width:320px;">' +
            '  ' +
            addrNote +
            ' Change your delivery address to order to another location!' +
            '</p>' +
            '<div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:300px;">' +
            '  <button id="khana-btn-change-addr" type="button" style="height:48px;width:100%;border-radius:16px;background:#F45D2C;color:#ffffff;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(244,93,44,0.3);outline:none;">' +
            '    Change delivery address' +
            '  </button>' +
            '</div>';

          homeContainer.appendChild(outsideHome);

          var changeBtn = document.getElementById('khana-btn-change-addr');
          if (changeBtn) {
            changeBtn.onclick = function () {
              spaNavigate('/location');
            };
          }
        }
      } else {
        document.body.classList.remove('khana-outside-service-zone');
        var outScreen = document.getElementById('khana-outside-home-screen');
        if (outScreen) outScreen.remove();

        var cr = document.querySelector('div.-mx-4.mb-5');
        if (cr) cr.style.display = 'block';
        var exSearch = document.getElementById('khana-customer-search-bar');
        if (exSearch) exSearch.style.display = 'flex';

        document.querySelectorAll('a[href*="/menu"]').forEach(function (c) {
          c.style.display = '';
        });

        // Circular Food Category Images
        function getKhanaCatImg(n) {
          var s = (n || '').toLowerCase();
          if (s.indexOf('biryani') !== -1)
            return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('pizza') !== -1)
            return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('burger') !== -1)
            return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('cake') !== -1 || s.indexOf('bakery') !== -1)
            return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('beverage') !== -1 || s.indexOf('shake') !== -1 || s.indexOf('mojito') !== -1)
            return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('sweet') !== -1 || s.indexOf('mithai') !== -1)
            return 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('thali') !== -1)
            return 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('chinese') !== -1 || s.indexOf('noodle') !== -1 || s.indexOf('chowmein') !== -1)
            return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('snack') !== -1 || s.indexOf('samosa') !== -1)
            return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('breakfast') !== -1 || s.indexOf('paratha') !== -1)
            return 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('sandwich') !== -1)
            return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('roll') !== -1)
            return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('pasta') !== -1)
            return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('main course') !== -1 || s.indexOf('curry') !== -1 || s.indexOf('paneer') !== -1)
            return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=240&h=240&fit=crop&q=80';
          if (s.indexOf('fast food') !== -1)
            return 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=240&h=240&fit=crop&q=80';
          return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=240&h=240&fit=crop&q=80';
        }
        var catRowBtns = document.querySelector('div.-mx-4.mb-5 .flex.w-max');
        if (catRowBtns) {
          catRowBtns.querySelectorAll('button').forEach(function (btn) {
            if (!btn.querySelector('img')) {
              var name = (btn.textContent || '').trim();
              var imgUrl = getKhanaCatImg(name);
              var isAct = btn.className.indexOf('bg-primary') !== -1;
              btn.style.cssText =
                'display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;padding:0 2px;cursor:pointer;outline:none;';
              btn.innerHTML =
                '<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;border:2px solid ' +
                (isAct ? '#F45D2C' : '#CBD5E1') +
                ';padding:2px;box-shadow:0 1px 3px rgba(0,0,0,0.08);background:#ffffff;">' +
                '  <img src="' +
                imgUrl +
                '" alt="' +
                name +
                '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />' +
                '</div>' +
                '<span style="font-size:11px;font-weight:' +
                (isAct ? '800' : '600') +
                ';color:' +
                (isAct ? '#F45D2C' : '#1E293B') +
                ';max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;">' +
                name +
                '</span>';
            }
          });
        }

        // Multi-entity search (restaurants + dishes) is natively handled by React in home.tsx
        if (exSearch) {
          exSearch.style.display = 'block';
        }
      }
    }
    if (typeof enhanceCheckoutPaymentUi === 'function') {
      enhanceCheckoutPaymentUi();
    }
  }

  function exitCustomerApp() {
    try {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.App &&
        typeof window.Capacitor.Plugins.App.exitApp === 'function'
      ) {
        window.Capacitor.Plugins.App.exitApp();
      }
    } catch (e) {}
    try {
      if (window.AndroidApp && typeof window.AndroidApp.exitApp === 'function') {
        window.AndroidApp.exitApp();
      }
    } catch (e) {}
  }

  if (!window.__kgt_customer_nav_stack) {
    var initP = window.location.pathname || '';
    window.__kgt_customer_nav_stack = initP === '/home' || initP === '/' || initP === '' ? ['/home'] : [initP];
  }

  function recordCustomerNav(p) {
    if (!p || p === '/' || p === '') return;
    var stack = window.__kgt_customer_nav_stack;
    if (!stack) {
      window.__kgt_customer_nav_stack = [p];
      return;
    }
    if (p === '/home') {
      window.__kgt_customer_nav_stack = ['/home'];
      return;
    }
    if (p === '/orders') {
      window.__kgt_customer_nav_stack = ['/orders'];
      return;
    }
    if (p === '/cart') {
      window.__kgt_customer_nav_stack = ['/cart'];
      return;
    }
    if (p === '/profile') {
      window.__kgt_customer_nav_stack = ['/profile'];
      return;
    }
    if (p === '/login' || p.indexOf('/login') !== -1) {
      window.__kgt_customer_nav_stack = ['/login'];
      return;
    }
    var last = stack[stack.length - 1];
    if (last === p) return;
    var idx = stack.indexOf(p);
    if (idx !== -1) {
      window.__kgt_customer_nav_stack = stack.slice(0, idx + 1);
    } else {
      stack.push(p);
      if (stack.length > 20) stack.shift();
    }
  }

  function handleCustomerHardwareBack() {
    var p = window.location.pathname || '';
    var isHome = p === '/home' || p === '/' || p === '';
    var isLogin = p === '/login' || p.indexOf('/login') !== -1;
    var isOrdersRoot = p === '/orders';
    var isCartRoot = p === '/cart';
    var isProfileRoot = p === '/profile';

    if (isHome) {
      exitCustomerApp();
      return;
    }

    if (isOrdersRoot || isCartRoot || isProfileRoot) {
      doCustomerNavigate('/home');
      return;
    }

    if (isLogin) {
      if (window.__customer_login_step === 'otp') {
        window.__customer_login_step = 'phone';
        renderLoginPortal();
        return;
      }
      exitCustomerApp();
      return;
    }

    var stack = window.__kgt_customer_nav_stack || [];
    if (stack.length > 1) {
      stack.pop();
      var prev = stack[stack.length - 1];
      if (prev && prev !== p && prev !== '/') {
        doCustomerNavigate(prev);
        return;
      }
    }

    if (p === '/location' || p.indexOf('/location') !== -1) {
      doCustomerNavigate('/home');
      return;
    }
    if (p === '/checkout' || p.indexOf('/checkout') !== -1) {
      doCustomerNavigate('/cart');
      return;
    }
    if (p.indexOf('/order/') !== -1) {
      doCustomerNavigate('/orders');
      return;
    }
    doCustomerNavigate('/home');
  }

  window.__kgt_customer_handle_back = handleCustomerHardwareBack;

  function initCustomerBackListener() {
    if (window.__kgt_customer_back_registered) return true;
    try {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.App &&
        typeof window.Capacitor.Plugins.App.addListener === 'function'
      ) {
        window.Capacitor.Plugins.App.addListener('backButton', function () {
          handleCustomerHardwareBack();
        });
        window.__kgt_customer_back_registered = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  if (!initCustomerBackListener()) {
    var backTimer = setInterval(function () {
      if (initCustomerBackListener()) clearInterval(backTimer);
    }, 150);
  }

  if (!window.__kgt_doc_back_attached) {
    window.__kgt_doc_back_attached = true;
    document.addEventListener('backbutton', function () {
      handleCustomerHardwareBack();
    });
  }

  if (!window.__khana_history_patched) {
    window.__khana_history_patched = true;
    var origPush = history.pushState;
    history.pushState = function () {
      var ret = origPush.apply(this, arguments);
      recordCustomerNav(window.location.pathname);
      updateAppUi();
      return ret;
    };
    var origReplace = history.replaceState;
    history.replaceState = function () {
      var ret = origReplace.apply(this, arguments);
      recordCustomerNav(window.location.pathname);
      updateAppUi();
      return ret;
    };
    window.addEventListener('popstate', function () {
      recordCustomerNav(window.location.pathname);
      updateAppUi();
    });
    window.addEventListener('storage', updateAppUi);
    window.addEventListener('kgt:address-changed', updateAppUi);
    setInterval(function () {
      updateAppUi();
    }, 250);
  }

  // Pre-fetch /orders and /cart for instantaneous transitions
  setTimeout(function () {
    try {
      ['/orders', '/cart'].forEach(function (path) {
        var prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = path;
        document.head.appendChild(prefetchLink);
      });
    } catch (e) {}
  }, 1000);

  // --- CASHFREE NATIVE IN-APP CHECKOUT BRIDGE & PAYMENT OPTIONS ---
  window.__kgt_customer_navigate = function (path) {
    if (typeof doCustomerNavigate === 'function') {
      doCustomerNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  // Recursive extractor for Cashfree session & order info from any JSON structure
  function extractCashfreeInfo(obj, depth) {
    if (!obj || typeof obj !== 'object' || (depth || 0) > 8) return null;

    var sessionId = obj.paymentSessionId || obj.payment_session_id || obj.paymentSessionID || obj.sessionId || obj.session_id;
    var orderId = obj.cashfreeOrderId || obj.cashfree_order_id || obj.cfOrderId || obj.cf_order_id || obj.orderId || obj.order_id || obj.orderID;
    var mode = obj.cashfreeMode || obj.cashfree_mode || obj.mode;

    // Check nested order object
    if (!orderId && obj.order && typeof obj.order === 'object') {
      orderId = obj.order.id || obj.order.order_id || obj.order.orderId || obj.order.cashfreeOrderId;
    }

    if (sessionId) {
      return {
        paymentSessionId: String(sessionId),
        cashfreeOrderId: orderId ? String(orderId) : '',
        cashfreeMode: (mode ? String(mode) : 'PRODUCTION').toUpperCase()
      };
    }

    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var val = obj[keys[i]];
      if (val && typeof val === 'object') {
        var found = extractCashfreeInfo(val, (depth || 0) + 1);
        if (found) {
          if (!found.cashfreeOrderId && orderId) {
            found.cashfreeOrderId = String(orderId);
          }
          return found;
        }
      }
    }
    return null;
  }

  function saveLatestCashfreeOrder(info) {
    if (!info || !info.paymentSessionId) return;
    window.__latest_cashfree_order = Object.assign({}, window.__latest_cashfree_order || {}, info);
    try {
      sessionStorage.setItem('__kgt_latest_cashfree_order', JSON.stringify(window.__latest_cashfree_order));
    } catch (e) {}
    console.log('[KGT-CASHFREE] Updated active order session:', window.__latest_cashfree_order);
  }

  // Intercept JSON.parse to capture server function responses (e.g., TanStack Start createServerFn)
  if (!window.__kgt_json_parse_hooked) {
    window.__kgt_json_parse_hooked = true;
    var originalJsonParse = JSON.parse;
    JSON.parse = function () {
      var res = originalJsonParse.apply(this, arguments);
      try {
        if (res && typeof res === 'object') {
          var info = extractCashfreeInfo(res);
          if (info && info.paymentSessionId) {
            saveLatestCashfreeOrder(info);
          }
        }
      } catch (e) {}
      return res;
    };
  }

  // Intercept fetch responses to capture { paymentSessionId, cashfreeOrderId, cashfreeMode }
  if (!window.__kgt_fetch_hooked) {
    window.__kgt_fetch_hooked = true;
    var originalFetch = window.fetch;
    window.fetch = function () {
      var fetchPromise = originalFetch.apply(this, arguments);
      return fetchPromise.then(function (response) {
        try {
          var clone = response.clone();
          clone.text().then(function (text) {
            if (!text) return;
            if (text.indexOf('session_') !== -1 || text.indexOf('paymentSessionId') !== -1 || text.indexOf('cashfreeOrderId') !== -1) {
              try {
                var data = JSON.parse(text);
                var info = extractCashfreeInfo(data);
                if (info && info.paymentSessionId) {
                  saveLatestCashfreeOrder(info);
                }
              } catch (e) {
                var sMatch = text.match(/"(?:paymentSessionId|payment_session_id|sessionId|session_id)":\s*"([^"]+)"/);
                var oMatch = text.match(/"(?:cashfreeOrderId|cashfree_order_id|orderId|order_id|cf_order_id)":\s*"([^"]+)"/);
                if (sMatch) {
                  saveLatestCashfreeOrder({
                    paymentSessionId: sMatch[1],
                    cashfreeOrderId: oMatch ? oMatch[1] : (window.__latest_cashfree_order && window.__latest_cashfree_order.cashfreeOrderId) || '',
                    cashfreeMode: text.indexOf('SANDBOX') !== -1 ? 'SANDBOX' : 'PRODUCTION'
                  });
                }
              }
            }
          }).catch(function () {});
        } catch (e) {}
        return response;
      });
    };
  }

  // Intercept XMLHttpRequest as fallback
  if (!window.__kgt_xhr_hooked && window.XMLHttpRequest) {
    window.__kgt_xhr_hooked = true;
    var origXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        try {
          var text = this.responseText;
          if (text && (text.indexOf('session_') !== -1 || text.indexOf('paymentSessionId') !== -1 || text.indexOf('cashfreeOrderId') !== -1)) {
            var data = JSON.parse(text);
            var info = extractCashfreeInfo(data);
            if (info && info.paymentSessionId) {
              saveLatestCashfreeOrder(info);
            }
          }
        } catch (e) {}
      });
      return origXhrSend.apply(this, arguments);
    };
  }

  // Reset checkout CTA button & spinner on /checkout
  window.__kgt_reset_checkout_cta = function () {
    console.log('[KGT-CASHFREE] Resetting checkout CTA and clearing loading state');
    try {
      if (typeof window.__kgt_pending_cashfree_reject === 'function') {
        var rejectFn = window.__kgt_pending_cashfree_reject;
        window.__kgt_pending_cashfree_reject = null;
        try { rejectFn(new Error('Payment was cancelled')); } catch (e) {}
      }
    } catch (e) {}

    window.__kgt_cashfree_active = false;

    // Force DOM button restoration on /checkout
    try {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        var txt = (btn.textContent || '').trim();
        if (txt.indexOf('Pay Online') !== -1 || txt.indexOf('Place Order') !== -1) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          var spinners = btn.querySelectorAll('.animate-spin, svg');
          for (var s = 0; s < spinners.length; s++) {
            var sp = spinners[s];
            if (sp.classList.contains('animate-spin') || (sp.innerHTML && sp.innerHTML.indexOf('circle') !== -1)) {
              sp.remove();
            }
          }
        }
      }
    } catch (e) {}
  };

  window.__kgt_on_cashfree_error = function (msg) {
    console.warn('[KGT-CASHFREE] Payment error/cancellation received:', msg);
    window.__kgt_reset_checkout_cta();
    if (msg && msg.toLowerCase().indexOf('cancel') === -1) {
      try {
        alert(msg);
      } catch (e) {}
    }
  };

  // Watchdog: Auto-recover checkout CTA if spinner gets stuck without active checkout
  setInterval(function () {
    if (window.location.pathname === '/checkout') {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        var txt = (btn.textContent || '').trim();
        if (txt.indexOf('Pay Online') !== -1) {
          var spinner = btn.querySelector('.animate-spin');
          if (spinner && !window.__kgt_cashfree_active) {
            if (!window.__kgt_spinner_timer) {
              window.__kgt_spinner_timer = Date.now();
            } else if (Date.now() - window.__kgt_spinner_timer > 3500) {
              console.warn('[KGT-CASHFREE] Watchdog auto-clearing stuck spinner on checkout');
              window.__kgt_reset_checkout_cta();
              window.__kgt_spinner_timer = null;
            }
          } else {
            window.__kgt_spinner_timer = null;
          }
        }
      }
    }
  }, 800);

  // Enhance Payment Section with clean category badges (UPI, Cards, NetBanking)
  function enhanceCheckoutPaymentUi() {
    if (window.location.pathname !== '/checkout') return;
    try {
      var els = document.querySelectorAll('p, span, div, label, h3, h4');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var text = (el.textContent || '').trim();
        var isOnlineMatch = text === 'Online Payment' ||
                            text === 'Pay Online' ||
                            (text.indexOf('Online Payment') === 0 && text.length < 35) ||
                            (text.indexOf('Pay Online') === 0 && text.length < 25);
        if (isOnlineMatch) {
          var parent = el.parentElement;
          if (parent && !parent.querySelector('.kgt-upi-badges')) {
            var badgeDiv = document.createElement('div');
            badgeDiv.className = 'kgt-upi-badges';
            badgeDiv.style.cssText = 'display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; align-items:center;';
            badgeDiv.innerHTML =
              '<span style="font-size:10px; font-weight:700; color:#059669; background:#ECFDF5; border-radius:4px; padding:2px 7px;">UPI</span>' +
              '<span style="font-size:10px; font-weight:700; color:#1E40AF; background:#DBEAFE; border-radius:4px; padding:2px 7px;">Cards</span>' +
              '<span style="font-size:10px; font-weight:700; color:#374151; background:#F3F4F6; border-radius:4px; padding:2px 7px;">NetBanking</span>';
            parent.appendChild(badgeDiv);
          }
        }
      }
    } catch (e) {}
  }

  // Native Cashfree Bridge Implementation (Multi-channel fallback: Direct JSI -> Capacitor Plugin -> toNative -> URL scheme)
  var cashfreeBridge = {
    startPayment: function (sessionId, orderId, mode) {
      sessionId = sessionId || '';
      orderId = orderId || '';
      mode = mode || 'PRODUCTION';

      console.log('[KGT-CASHFREE] Invoking native payment checkout:', { sessionId: sessionId, orderId: orderId, mode: mode });

      // Channel 1: Direct Android JavascriptInterface
      if (window._rawAndroidCashfree && typeof window._rawAndroidCashfree.startPayment === 'function') {
        try {
          console.log('[KGT-CASHFREE] Calling _rawAndroidCashfree.startPayment');
          window._rawAndroidCashfree.startPayment(sessionId, orderId, mode);
          return Promise.resolve({ status: 'PROCESSED_NATIVELY' });
        } catch (e) {
          console.warn('[KGT-CASHFREE] _rawAndroidCashfree call failed:', e);
        }
      }

      // Channel 2: Capacitor Plugin
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CashfreePayment) {
        try {
          console.log('[KGT-CASHFREE] Calling Capacitor.Plugins.CashfreePayment.startPayment');
          return window.Capacitor.Plugins.CashfreePayment.startPayment({
            paymentSessionId: sessionId,
            orderId: orderId,
            mode: mode
          });
        } catch (e) {
          console.warn('[KGT-CASHFREE] Capacitor Plugin call failed:', e);
        }
      }

      // Channel 3: Capacitor toNative / nativePromise
      if (window.Capacitor && typeof window.Capacitor.nativePromise === 'function') {
        try {
          console.log('[KGT-CASHFREE] Calling Capacitor.nativePromise');
          return window.Capacitor.nativePromise('CashfreePayment', 'startPayment', {
            paymentSessionId: sessionId,
            orderId: orderId,
            mode: mode
          });
        } catch (e) {
          console.warn('[KGT-CASHFREE] Capacitor.nativePromise call failed:', e);
        }
      }

      if (window.Capacitor && typeof window.Capacitor.toNative === 'function') {
        try {
          console.log('[KGT-CASHFREE] Calling Capacitor.toNative');
          window.Capacitor.toNative('CashfreePayment', 'startPayment', {
            paymentSessionId: sessionId,
            orderId: orderId,
            mode: mode
          });
          return Promise.resolve({ status: 'PROCESSED_NATIVELY' });
        } catch (e) {
          console.warn('[KGT-CASHFREE] Capacitor.toNative call failed:', e);
        }
      }

      // Channel 4: kgt-cashfree:// scheme iframe trigger (intercepted by CashfreePaymentPlugin.shouldOverrideLoad)
      try {
        console.log('[KGT-CASHFREE] Triggering kgt-cashfree:// scheme');
        var intentUrl = 'kgt-cashfree://start?paymentSessionId=' + encodeURIComponent(sessionId) +
                        '&orderId=' + encodeURIComponent(orderId) +
                        '&mode=' + encodeURIComponent(mode);
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = intentUrl;
        document.body.appendChild(iframe);
        setTimeout(function () {
          try { document.body.removeChild(iframe); } catch (e) {}
        }, 2000);
        return Promise.resolve({ status: 'PROCESSED_NATIVELY' });
      } catch (e) {
        console.error('[KGT-CASHFREE] Scheme trigger failed:', e);
      }

      return Promise.reject(new Error('Unable to launch native Cashfree checkout'));
    }
  };

  // Expose on window.AndroidCashfree so it is ALWAYS available
  window.AndroidCashfree = cashfreeBridge;

  // Hook window.Cashfree to prevent external browser redirection and trigger native checkout
  function installCashfreeNativeHook() {
    function createCashfreeNativeInstance(mode) {
      return {
        checkout: function (options) {
          return new Promise(function (resolve, reject) {
            var sessionId = (options && options.paymentSessionId) || '';
            var orderId = (options && (options.orderId || options.cashfreeOrderId || options.order_id)) || '';
            var activeMode = mode || 'PRODUCTION';

            if (window.__latest_cashfree_order) {
              if (!orderId) orderId = window.__latest_cashfree_order.cashfreeOrderId || '';
              if (!sessionId) sessionId = window.__latest_cashfree_order.paymentSessionId || '';
              activeMode = window.__latest_cashfree_order.cashfreeMode || activeMode;
            }

            if (!orderId || !sessionId) {
              try {
                var stored = sessionStorage.getItem('__kgt_latest_cashfree_order');
                if (stored) {
                  var p = JSON.parse(stored);
                  if (!orderId && p.cashfreeOrderId) orderId = p.cashfreeOrderId;
                  if (!sessionId && p.paymentSessionId) sessionId = p.paymentSessionId;
                  if (p.cashfreeMode) activeMode = p.cashfreeMode;
                }
              } catch (e) {}
            }

            console.log('[KGT-CASHFREE] checkout starting: session=' + sessionId + ', orderId=' + orderId + ', mode=' + activeMode);

            if (!sessionId) {
              window.__kgt_reset_checkout_cta();
              reject(new Error('Payment session missing. Please try again.'));
              return;
            }

            // Save pending reject so user cancellation or failure resets React state
            window.__kgt_cashfree_active = true;
            window.__kgt_pending_cashfree_reject = function (err) {
              window.__kgt_cashfree_active = false;
              reject(err);
            };
            window.__kgt_pending_cashfree_resolve = function (res) {
              window.__kgt_cashfree_active = false;
              resolve(res);
            };

            cashfreeBridge.startPayment(sessionId, orderId, activeMode)
              .then(function () {
                console.log('[KGT-CASHFREE] Native Drop Checkout presented.');
              })
              .catch(function (err) {
                console.error('[KGT-CASHFREE] Failed to start native payment:', err);
                window.__kgt_cashfree_active = false;
                window.__kgt_reset_checkout_cta();
                reject(err || new Error('Could not open payment checkout'));
              });
          });
        }
      };
    }

    var nativeCashfreeFactory = function (config) {
      var m = (config && config.mode) || 'PRODUCTION';
      return createCashfreeNativeInstance(m);
    };
    nativeCashfreeFactory.version = 'v3';
    nativeCashfreeFactory.__is_kgt_native = true;

    try {
      Object.defineProperty(window, 'Cashfree', {
        get: function () {
          return nativeCashfreeFactory;
        },
        set: function (val) {
          console.log('[KGT-CASHFREE] Script attempted to overwrite window.Cashfree; preserving native bridge');
        },
        configurable: true
      });
    } catch (e) {
      window.Cashfree = nativeCashfreeFactory;
    }
  }

  installCashfreeNativeHook();

  // Universal Indian Phone Dialer Interceptor
  // Guarantees all tel: links are dialed with India international code (+91)
  // Prevents Android Phone / Samsung dialer from assuming NANP / Texas area codes
  document.addEventListener('click', function (e) {
    try {
      var target = e.target;
      while (target && target !== document.body && target !== document.documentElement) {
        if (target.tagName === 'A' && target.href && target.href.indexOf('tel:') === 0) {
          var raw = target.href.replace('tel:', '').trim();
          var digits = raw.replace(/\D/g, '');
          if (digits) {
            var formatted = '';
            if (digits.length === 12 && digits.indexOf('91') === 0) {
              formatted = '+' + digits;
            } else if (digits.length === 11 && digits.indexOf('0') === 0) {
              formatted = '+91' + digits.substring(1);
            } else if (digits.length >= 10) {
              formatted = '+91' + digits.slice(-10);
            } else {
              formatted = '+91' + digits;
            }
            target.href = 'tel:' + formatted;
          }
          break;
        }
        target = target.parentElement;
      }
    } catch (err) {}
  }, true);

  recordCustomerNav(window.location.pathname);
  updateAppUi();
  enhanceCheckoutPaymentUi();
})();
