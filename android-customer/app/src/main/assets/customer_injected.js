(function () {
  'use strict';

  var SHANKARGARH_POLY = [
    [25.226876, 81.584642],
    [25.225354, 81.619860],
    [25.219242, 81.647636],
    [25.218954, 81.667853],
    [25.212449, 81.685936],
    [25.200505, 81.672039],
    [25.184447, 81.655593],
    [25.155628, 81.645967],
    [25.160616, 81.600931],
    [25.177561, 81.592403],
    [25.197182, 81.559681]
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
    var R = 6371.0;
    var dLat = ((lat - 25.1842) * Math.PI) / 180;
    var dLon = ((lng - 81.6212) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((25.1842 * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var d = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d <= 10.0;
  }

  function isDeliveryLocationInZone(addr, coords) {
    var s = (addr || '').toLowerCase().trim();
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
      (s.indexOf('prayagraj') !== -1 && s.indexOf('shankargarh') === -1 && s.indexOf('212108') === -1);
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
      s.indexOf('lalita nagar') !== -1;
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

    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'kgt-customer-bottom-bar';
      bar.style.cssText =
        'position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:99999;' +
        'background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
        'border-top:1px solid #E2E8F0;padding-bottom:env(safe-area-inset-bottom,0px);' +
        'box-shadow:0 -2px 10px rgba(0,0,0,0.04);display:grid;grid-template-columns:repeat(3,1fr);' +
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
    if ((isHomePage || isMenuPage) && !hasCustomerSession) {
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

    // 3. Customer Bottom Nav: Render dedicated 3-tab bar and off-screen remote React nav
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
      var textarea = document.querySelector('textarea');
      var formParent = textarea ? textarea.closest('div.space-y-3') || textarea.parentElement : null;
      if (formParent && !document.getElementById('khana-presets-container')) {
        var presetsContainer = document.createElement('div');
        presetsContainer.id = 'khana-presets-container';
        presetsContainer.style.cssText = 'margin:12px 0 16px 0;';
        presetsContainer.innerHTML =
          '<div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;display:flex;align-items:center;gap:4px;">' +
          '  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F45D2C" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' +
          '  Quick Select Locality (Shankargarh):' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
          '  <button type="button" class="khana-preset-btn" data-addr="Main Bazaar / Market, Shankargarh, Prayagraj - 212108" style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:9999px;padding:6px 12px;font-size:11px;font-weight:600;color:#1E293B;cursor:pointer;">Shankargarh Market</button>' +
          '  <button type="button" class="khana-preset-btn" data-addr="Railway Station Road, Shankargarh, Prayagraj - 212108" style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:9999px;padding:6px 12px;font-size:11px;font-weight:600;color:#1E293B;cursor:pointer;">Station Road</button>' +
          '  <button type="button" class="khana-preset-btn" data-addr="Raja Market, Shankargarh, Prayagraj - 212108" style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:9999px;padding:6px 12px;font-size:11px;font-weight:600;color:#1E293B;cursor:pointer;">Raja Market</button>' +
          '  <button type="button" class="khana-preset-btn" data-addr="Bara Road, Shankargarh, Prayagraj - 212108" style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:9999px;padding:6px 12px;font-size:11px;font-weight:600;color:#1E293B;cursor:pointer;">Bara Road</button>' +
          '  <button type="button" class="khana-preset-btn" data-addr="Lalita Nagar, Shankargarh, Prayagraj - 212108" style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:9999px;padding:6px 12px;font-size:11px;font-weight:600;color:#1E293B;cursor:pointer;">Lalita Nagar</button>' +
          '</div>' +
          '<div id="khana-location-status" style="margin-top:10px;"></div>';
        formParent.parentNode.insertBefore(presetsContainer, formParent);
        presetsContainer.querySelectorAll('.khana-preset-btn').forEach(function (btn) {
          btn.onclick = function () {
            var addr = btn.getAttribute('data-addr') || '';
            var ta = document.querySelector('textarea');
            if (ta) {
              ta.value = addr;
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              ta.dispatchEvent(new Event('change', { bubbles: true }));
            }
            window.__khana_selected_coords = { lat: 25.1842, lng: 81.6212 };
            var st = document.getElementById('khana-location-status');
            if (st) {
              st.innerHTML =
                '<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:600;color:#065F46;">✓ Serviceable zone: Shankargarh Zone. Fast delivery available!</div>';
            }
          };
        });
      }
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
            if (!coords && isDeliveryLocationInZone(addr, null)) {
              coords = { lat: 25.1842, lng: 81.6212 };
            }
            localStorage.setItem('kgt:delivery-address', addr);
            if (coords) {
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
    } else if (window.__native_device_outside !== undefined) {
      isCustomerDeliveryOutside = !!window.__native_device_outside;
    } else if (window.__native_device_coords && typeof window.__native_device_coords.lat === 'number') {
      isCustomerDeliveryOutside = !isCoordInShankargarh(
        window.__native_device_coords.lat,
        window.__native_device_coords.lng
      );
    } else if (localStorage.getItem('kgt:device-outside') === 'true') {
      isCustomerDeliveryOutside = true;
    }

    if (isHomePage) {
      var totalCardsFound = 0;
      var outsideCardsCount = 0;
      document.querySelectorAll('a[href*="/menu"]').forEach(function (card) {
        totalCardsFound++;
        var text = (card.textContent || '').toLowerCase();
        var match = text.match(/(\d+(?:\.\d+)?)\s*km/);
        if (match) {
          var dist = parseFloat(match[1]);
          if (!isNaN(dist) && dist >= 15.0) {
            outsideCardsCount++;
            card.style.display = 'none';
          }
        }
      });
      if (totalCardsFound > 0 && outsideCardsCount === totalCardsFound) {
        isCustomerDeliveryOutside = true;
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
            : 'KhanaGharTak is currently delivering only in our active service zone (Shankargarh & nearby areas).';

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
            '  <button id="khana-btn-switch-shankargarh" type="button" style="height:44px;width:100%;border-radius:16px;background:rgba(244,93,44,0.08);color:#F45D2C;font-size:13px;font-weight:700;border:1px solid rgba(244,93,44,0.25);cursor:pointer;outline:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;">' +
            '    ✨ Switch to Shankargarh Zone' +
            '  </button>' +
            '</div>';

          homeContainer.appendChild(outsideHome);

          var changeBtn = document.getElementById('khana-btn-change-addr');
          if (changeBtn) {
            changeBtn.onclick = function () {
              spaNavigate('/location');
            };
          }
          var switchBtn = document.getElementById('khana-btn-switch-shankargarh');
          if (switchBtn) {
            switchBtn.onclick = function () {
              localStorage.setItem(
                'kgt:delivery-address',
                'Main Bazaar, Shankargarh, Prayagraj - 212108'
              );
              localStorage.setItem(
                'kgt:user-coords',
                JSON.stringify({ lat: 25.1842, lng: 81.6212, ts: Date.now() })
              );
              localStorage.setItem('kgt:device-outside', 'false');
              window.__native_device_outside = false;
              window.__khana_selected_coords = { lat: 25.1842, lng: 81.6212 };
              document.body.classList.remove('khana-outside-service-zone');
              if (outsideHome) outsideHome.remove();
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new Event('kgt:address-changed'));
              window.location.reload();
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
          var text = (c.textContent || '').toLowerCase();
          var match = text.match(/(\d+(?:\.\d+)?)\s*km/);
          if (match && parseFloat(match[1]) >= 15.0) {
            c.style.display = 'none';
          } else {
            c.style.display = '';
          }
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

    if (isHome) {
      exitCustomerApp();
      return;
    }

    if (isOrdersRoot || isCartRoot) {
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

  recordCustomerNav(window.location.pathname);
  updateAppUi();
})();
