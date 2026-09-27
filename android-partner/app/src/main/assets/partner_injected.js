(function () {
  'use strict';

  window.__is_partner_app = true;
  try {
    localStorage.setItem('kgt:app-flavor', 'partner');
  } catch (e) {}

  var metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', '#FFFFFF');
  document.documentElement.style.backgroundColor = '#FFFFFF';
  if (document.body) document.body.style.backgroundColor = '#FFFFFF';

  // Inject CSS for clean white partner app shell, headers, footer navigation bar & sign out
  var style = document.getElementById('kgt-partner-native-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'kgt-partner-native-style';
    style.innerHTML =
      'html, body, #root, main, .app-shell { background-color: #FFFFFF !important; background: #FFFFFF !important; color: #0F172A !important; }' +
      // Completely eradicate customer-facing website cart, customer footer, customer bottom bar, and customer tabs
      'a[href*="/cart"], header a[aria-label*="Cart"], header a[aria-label*="cart"], .customer-cart-btn, #kgt-customer-bottom-bar, [data-testid="customer-bottom-nav"], [data-testid="back-to-home"], a[href="/"]:not(#partner-portal-logo-link) { display: none !important; visibility: hidden !important; pointer-events: none !important; }' +
      'nav:has(a[href*="/cart"]), nav:has(a[href="/orders"]), nav:has(a[href="/home"]), nav[class*="max-w-[480px]"]:not(#kgt-rider-bottom-nav):not(#kgt-zone-bottom-nav), ul:has(a[href*="/cart"]), a[href="/orders"]:not(#admin-orders-link):not([href*="/admin"]), a[href="/home"] { display: none !important; visibility: hidden !important; pointer-events: none !important; height: 0 !important; max-height: 0 !important; overflow: hidden !important; position: absolute !important; bottom: -9999px !important; }' +
      'body:not(.is-admin-route) nav.fixed.bottom-0:not(#kgt-rider-bottom-nav):not(#kgt-zone-bottom-nav), body:not(.is-admin-route) nav[class*="bottom-0"]:not(#kgt-rider-bottom-nav):not(#kgt-zone-bottom-nav) { display: none !important; }' +
      'footer.site-footer, footer:not(.partner-footer) { display: none !important; }' +
      // Hide desktop aside on mobile partner app
      'aside.h-screen, aside[class*="w-64"] { display: none !important; }' +
      // MODAL / POPUP DIALOG FIXES (MENU ITEM ADD/EDIT, DELETE, ORDER REJECT)
      '.fixed.inset-0:not(#kgt-partner-portal) {' +
      '  z-index: 9999999 !important;' +
      '}' +
      'body:has(.fixed.inset-0:not(#kgt-partner-portal)) nav.fixed.bottom-0, body.has-modal-open nav.fixed.bottom-0, body.has-modal-open #kgt-rider-bottom-nav, body.has-modal-open #kgt-zone-bottom-nav {' +
      '  display: none !important;' +
      '}' +
      '.fixed.inset-0:not(#kgt-partner-portal) > div {' +
      '  max-height: 88vh !important;' +
      '  max-height: 88dvh !important;' +
      '  overflow-y: auto !important;' +
      '  -webkit-overflow-scrolling: touch !important;' +
      '  touch-action: pan-y !important;' +
      '  overscroll-behavior: contain !important;' +
      '}' +
      // RESTAURANT BOTTOM FOOTER NAVIGATION BAR (DASHBOARD, ORDERS, MENU, ANALYTICS, SETTINGS)
      'body.is-admin-route nav.fixed.bottom-0:has(a[href*="/admin"]), body.is-admin-route nav[class*="fixed"][class*="bottom-0"]:has(a[href*="/admin"]) {' +
      '  display: grid !important;' +
      '  position: fixed !important;' +
      '  bottom: 0 !important;' +
      '  left: 0 !important;' +
      '  right: 0 !important;' +
      '  z-index: 99999 !important;' +
      '  background-color: #FFFFFF !important;' +
      '  background: #FFFFFF !important;' +
      '  border-top: 1px solid #E2E8F0 !important;' +
      '  box-shadow: 0 -2px 10px rgba(0,0,0,0.06) !important;' +
      '  padding-bottom: max(6px, env(safe-area-inset-bottom, 6px)) !important;' +
      '}' +
      'body.is-admin-route nav.fixed.bottom-0 a, body.is-admin-route nav[class*="fixed"][class*="bottom-0"] a {' +
      '  display: flex !important;' +
      '  flex-direction: column !important;' +
      '  align-items: center !important;' +
      '  justify-content: center !important;' +
      '  padding: 8px 2px !important;' +
      '  color: #64748B !important;' +
      '  font-size: 11px !important;' +
      '  font-weight: 600 !important;' +
      '  text-decoration: none !important;' +
      '}' +
      'body.is-admin-route nav.fixed.bottom-0 a.text-primary, body.is-admin-route nav.fixed.bottom-0 a[aria-current="page"] {' +
      '  color: #F45D2C !important;' +
      '  font-weight: 800 !important;' +
      '}' +
      'body.is-admin-route nav.fixed.bottom-0 a svg {' +
      '  display: block !important;' +
      '  width: 22px !important;' +
      '  height: 22px !important;' +
      '}' +
      // RIDER BOTTOM FOOTER NAVIGATION BAR (NEW OFFERS, MY DELIVERIES, MY EARNINGS)
      '#kgt-rider-bottom-nav {' +
      '  display: grid !important;' +
      '  grid-template-columns: repeat(3, 1fr) !important;' +
      '  position: fixed !important;' +
      '  bottom: 0 !important;' +
      '  left: 0 !important;' +
      '  right: 0 !important;' +
      '  width: 100% !important;' +
      '  height: 60px !important;' +
      '  z-index: 99998 !important;' +
      '  background-color: #FFFFFF !important;' +
      '  background: #FFFFFF !important;' +
      '  border-top: 1px solid #E2E8F0 !important;' +
      '  box-shadow: 0 -2px 10px rgba(0,0,0,0.06) !important;' +
      '  padding-bottom: max(6px, env(safe-area-inset-bottom, 6px)) !important;' +
      '}' +
      '#kgt-rider-bottom-nav button {' +
      '  display: flex !important;' +
      '  flex-direction: column !important;' +
      '  align-items: center !important;' +
      '  justify-content: center !important;' +
      '  background: transparent !important;' +
      '  border: none !important;' +
      '  padding: 6px 2px !important;' +
      '  color: #64748B !important;' +
      '  font-size: 11px !important;' +
      '  font-weight: 600 !important;' +
      '  cursor: pointer !important;' +
      '  -webkit-tap-highlight-color: transparent !important;' +
      '}' +
      '#kgt-rider-bottom-nav button.active {' +
      '  color: #F45D2C !important;' +
      '  font-weight: 800 !important;' +
      '}' +
      '#kgt-rider-bottom-nav button svg {' +
      '  display: block !important;' +
      '  width: 22px !important;' +
      '  height: 22px !important;' +
      '}' +
      // ZONE MANAGER BOTTOM FOOTER NAVIGATION BAR (ORDERS, RESTAURANTS, RIDERS, CUSTOMERS, MAP)
      '#kgt-zone-bottom-nav {' +
      '  display: grid !important;' +
      '  grid-template-columns: repeat(5, 1fr) !important;' +
      '  position: fixed !important;' +
      '  bottom: 0 !important;' +
      '  left: 0 !important;' +
      '  right: 0 !important;' +
      '  width: 100% !important;' +
      '  height: 60px !important;' +
      '  z-index: 99998 !important;' +
      '  background-color: #FFFFFF !important;' +
      '  background: #FFFFFF !important;' +
      '  border-top: 1px solid #E2E8F0 !important;' +
      '  box-shadow: 0 -2px 10px rgba(0,0,0,0.06) !important;' +
      '  padding-bottom: max(6px, env(safe-area-inset-bottom, 6px)) !important;' +
      '}' +
      '#kgt-zone-bottom-nav button {' +
      '  display: flex !important;' +
      '  flex-direction: column !important;' +
      '  align-items: center !important;' +
      '  justify-content: center !important;' +
      '  background: transparent !important;' +
      '  border: none !important;' +
      '  padding: 6px 1px !important;' +
      '  color: #64748B !important;' +
      '  font-size: 10px !important;' +
      '  font-weight: 600 !important;' +
      '  cursor: pointer !important;' +
      '  -webkit-tap-highlight-color: transparent !important;' +
      '}' +
      '#kgt-zone-bottom-nav button.active {' +
      '  color: #F45D2C !important;' +
      '  font-weight: 800 !important;' +
      '}' +
      '#kgt-zone-bottom-nav button svg {' +
      '  display: block !important;' +
      '  width: 20px !important;' +
      '  height: 20px !important;' +
      '}' +
      // PARTNER APP DASHBOARD HEADERS (RESTAURANT, RIDER, ZONE MANAGER)
      'header.sticky, header[class*="sticky"], header.border-b {' +
      '  display: flex !important;' +
      '  position: sticky !important;' +
      '  top: 0 !important;' +
      '  z-index: 9999 !important;' +
      '  background-color: #FFFFFF !important;' +
      '  background: #FFFFFF !important;' +
      '  border-bottom: 1px solid #E2E8F0 !important;' +
      '  box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;' +
      '}' +
      // PROMINENT SIGN OUT BUTTON (CLEAR PILL WITH LOGOUT TEXT ACROSS ALL LOGINS)
      'button[aria-label="Sign out"], button[aria-label="Logout"], .kgt-signout-btn {' +
      '  display: inline-flex !important;' +
      '  align-items: center !important;' +
      '  justify-content: center !important;' +
      '  gap: 5px !important;' +
      '  background-color: #FEE2E2 !important;' +
      '  background: #FEE2E2 !important;' +
      '  color: #DC2626 !important;' +
      '  border: 1px solid #FECACA !important;' +
      '  border-radius: 9999px !important;' +
      '  padding: 6px 12px !important;' +
      '  font-size: 12px !important;' +
      '  font-weight: 700 !important;' +
      '  cursor: pointer !important;' +
      '  outline: none !important;' +
      '  box-shadow: 0 1px 3px rgba(220,38,38,0.12) !important;' +
      '}' +
      'button[aria-label="Sign out"]:active, button[aria-label="Logout"]:active, .kgt-signout-btn:active {' +
      '  transform: scale(0.96) !important;' +
      '  background-color: #FCA5A5 !important;' +
      '}' +
      'button[aria-label="Sign out"] svg, button[aria-label="Logout"] svg, .kgt-signout-btn svg {' +
      '  width: 15px !important;' +
      '  height: 15px !important;' +
      '  stroke: #DC2626 !important;' +
      '}' +
      '@keyframes kgtPulseAlarm { 0% { background-color: #DC2626; transform: scale(1); } 50% { background-color: #B91C1C; transform: scale(1.02); } 100% { background-color: #DC2626; transform: scale(1); } }';
    (document.head || document.documentElement).appendChild(style);
  }

  // ==========================================
  // LOUD CONTINUOUS ALARM LOOP (Zomato/Swiggy Order Siren)
  // ==========================================
  var alarmLoopTimer = null;
  var isAlarmActive = false;

  function playWebAudioChime() {
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      var ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      var now = ctx.currentTime;

      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.25);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.5);
      gain2.gain.setValueAtTime(0.5, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 0.7);
    } catch (e) {}
  }

  function startAlarm(orderId, role, title, body) {
    if (isAlarmActive) return;
    isAlarmActive = true;

    if (window.AndroidAlert && typeof window.AndroidAlert.startContinuousAlarm === 'function') {
      try {
        window.AndroidAlert.startContinuousAlarm(
          orderId || '',
          role || '',
          title || 'New Order Alert!',
          body || 'Urgent: A new order requires immediate acceptance.'
        );
      } catch (e) {}
    }

    playWebAudioChime();
    if (!alarmLoopTimer) {
      alarmLoopTimer = setInterval(function () {
        if (isAlarmActive) {
          playWebAudioChime();
        }
      }, 1500);
    }

    showAlarmBanner(orderId, role, title, body);
  }

  function stopAlarm() {
    isAlarmActive = false;
    if (alarmLoopTimer) {
      clearInterval(alarmLoopTimer);
      alarmLoopTimer = null;
    }
    if (window.AndroidAlert && typeof window.AndroidAlert.stopContinuousAlarm === 'function') {
      try {
        window.AndroidAlert.stopContinuousAlarm();
      } catch (e) {}
    }
    var banner = document.getElementById('kgt-partner-alarm-banner');
    if (banner) banner.remove();
  }

  function showAlarmBanner(orderId, role, title, body) {
    var existing = document.getElementById('kgt-partner-alarm-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'kgt-partner-alarm-banner';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999999;background:#DC2626;color:#FFFFFF;' +
      'padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;' +
      'box-shadow:0 6px 24px rgba(220,38,38,0.6);font-family:system-ui,-apple-system,sans-serif;' +
      'animation:kgtPulseAlarm 1.2s infinite ease-in-out;';

    banner.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">' +
      '  <span style="font-size:24px;line-height:1;">🚨</span>' +
      '  <div style="min-width:0;">' +
      '    <div style="font-size:14px;font-weight:900;letter-spacing:0.2px;line-height:1.2;">' + (title || 'NEW ORDER RECEIVED!') + '</div>' +
      '    <div style="font-size:11px;opacity:0.95;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (body || 'Loud alarm ringing. Tap to accept.') + '</div>' +
      '  </div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
      '  <button id="kgt-btn-alarm-silence" style="background:rgba(255,255,255,0.2);color:#FFFFFF;border:1px solid rgba(255,255,255,0.6);border-radius:10px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;">' +
      '    ✕ Silence' +
      '  </button>' +
      '  <button id="kgt-btn-alarm-view" style="background:#FFFFFF;color:#DC2626;border:none;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.2);">' +
      '    View & Accept' +
      '  </button>' +
      '</div>';

    var btnSilence = banner.querySelector('#kgt-btn-alarm-silence');
    if (btnSilence) {
      btnSilence.onclick = function (e) {
        e.stopPropagation();
        stopAlarm();
      };
    }

    var btnView = banner.querySelector('#kgt-btn-alarm-view');
    if (btnView) {
      btnView.onclick = function (e) {
        e.stopPropagation();
        stopAlarm();
        if (role === 'zone_manager' || role === 'manager') {
          window.location.href = '/zone';
        } else if (role === 'rider') {
          window.location.href = '/rider';
        } else {
          window.location.href = '/admin/orders';
        }
      };
    }

    (document.body || document.documentElement).appendChild(banner);
  }

  window.__kgt_start_order_alarm = startAlarm;
  window.__kgt_stop_order_alarm = stopAlarm;

  window.addEventListener('kgt:partner-order-alert', function (e) {
    var detail = (e && e.detail) || {};
    startAlarm(detail.orderId, detail.role, detail.title || '🚨 NEW ORDER RECEIVED!', detail.body || 'New order received. Please accept immediately.');
  });

  // ==========================================
  // INDEPENDENT SELF-CONTAINED ORDER WATCHDOG & NATIVE SYNC
  // ==========================================
  var SUPABASE_URL = 'https://bvacebeorvxwcfkselon.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY';

  function getPartnerAuth() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('-auth-token') !== -1) {
          var val = localStorage.getItem(k);
          if (val) {
            var parsed = JSON.parse(val);
            var token = parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token);
            var user = parsed.user || (parsed.currentSession && parsed.currentSession.user);
            if (token) {
              return { token: token, user: user };
            }
          }
        }
      }
    } catch (e) {}
    return null;
  }

  function detectRoleFromPath() {
    var p = window.location.pathname || '';
    if (p.indexOf('/rider') === 0) return 'rider';
    if (p.indexOf('/zone') === 0) return 'zone_manager';
    if (p.indexOf('/admin') === 0) return 'restaurant';
    return getActiveRole() || 'restaurant';
  }

  function syncAuthWithNative() {
    try {
      var auth = getPartnerAuth();
      var role = detectRoleFromPath();
      if (window.AndroidAlert && typeof window.AndroidAlert.syncSession === 'function') {
        if (auth && auth.token) {
          window.AndroidAlert.syncSession(auth.token, role, (auth.user && auth.user.id) || '');
        } else {
          window.AndroidAlert.syncSession('', '', '');
        }
      }
    } catch (e) {}
  }

  var lastCheckedOrderIds = {};
  var isCheckingOrders = false;

  function checkOrdersDirectly() {
    if (isCheckingOrders) return;
    var auth = getPartnerAuth();
    if (!auth || !auth.token) return;

    syncAuthWithNative();

    var role = detectRoleFromPath();
    isCheckingOrders = true;

    if (role === 'rider') {
      // rider_list_offers takes 0 arguments in Postgres - must send empty JSON object {}
      fetch(SUPABASE_URL + '/rest/v1/rpc/rider_list_offers', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + auth.token,
          'Content-Type': 'application/json'
        },
        body: '{}'
      })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) return null;
        return res.json();
      })
      .then(function (data) {
        isCheckingOrders = false;
        if (!Array.isArray(data)) return;
        var activeOffers = data.filter(function (o) {
          return o && (!o.status || o.status === 'active');
        });
        if (activeOffers.length > 0) {
          var firstOffer = activeOffers[0];
          var offerId = firstOffer.order_id || firstOffer.id;
          if (offerId && !lastCheckedOrderIds[offerId]) {
            lastCheckedOrderIds[offerId] = true;
            var drop = firstOffer.drop_area || 'Customer Delivery';
            var total = Math.round(Number(firstOffer.total) || 0);
            startAlarm(
              offerId,
              'rider',
              '🛵 NEW DELIVERY OFFER!',
              'Drop: ' + drop + ' · ₹' + total + ' · Tap to Accept!'
            );
          }
        } else if (isAlarmActive) {
          stopAlarm();
        }
      })
      .catch(function () {
        isCheckingOrders = false;
      });
    } else if (role === 'zone_manager' || role === 'manager') {
      var fetchZoneOrders = function (zoneId) {
        fetch(SUPABASE_URL + '/rest/v1/rpc/zone_list_orders', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + auth.token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ _zone_id: zoneId, _limit: 25 })
        })
        .then(function (res) {
          if (res.status === 401 || res.status === 403) return null;
          return res.json();
        })
        .then(function (data) {
          isCheckingOrders = false;
          if (!Array.isArray(data)) return;
          var placed = data.filter(function (o) {
            return o && (o.status === 'placed' || (o.status === 'pending' && !o.rider_id));
          });
          if (placed.length > 0) {
            var newest = placed[0];
            if (newest.id && !lastCheckedOrderIds[newest.id]) {
              lastCheckedOrderIds[newest.id] = true;
              var shortId = newest.id.slice(0, 8).toUpperCase();
              var total = Math.round(Number(newest.total) || 0);
              startAlarm(
                newest.id,
                'zone_manager',
                '📦 NEW ZONE ORDER!',
                'Order #' + shortId + ' · ₹' + total + ' · Tap to dispatch!'
              );
            }
          } else if (isAlarmActive) {
            stopAlarm();
          }
        })
        .catch(function () {
          isCheckingOrders = false;
        });
      };

      if (!window.__partner_zone_id) {
        fetch(SUPABASE_URL + '/rest/v1/rpc/zone_my_zones', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + auth.token,
            'Content-Type': 'application/json'
          },
          body: '{}'
        })
        .then(function (res) { return res.json(); })
        .then(function (zones) {
          if (Array.isArray(zones) && zones.length > 0 && zones[0].id) {
            window.__partner_zone_id = zones[0].id;
            if (window.AndroidAlert && typeof window.AndroidAlert.syncZoneId === 'function') {
              window.AndroidAlert.syncZoneId(zones[0].id);
            }
            fetchZoneOrders(zones[0].id);
          } else {
            isCheckingOrders = false;
          }
        })
        .catch(function () {
          isCheckingOrders = false;
        });
      } else {
        fetchZoneOrders(window.__partner_zone_id);
      }
    } else {
      // Restaurant
      fetch(SUPABASE_URL + '/rest/v1/rpc/owner_list_orders', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + auth.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ _limit: 20 })
      })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) return null;
        return res.json();
      })
      .then(function (data) {
        isCheckingOrders = false;
        if (!Array.isArray(data)) return;
        var placed = data.filter(function (o) {
          return o && (o.status === 'placed' || o.status === 'pending');
        });
        if (placed.length > 0) {
          var newest = placed[0];
          if (newest.id && !lastCheckedOrderIds[newest.id]) {
            lastCheckedOrderIds[newest.id] = true;
            var shortId = newest.id.slice(0, 8).toUpperCase();
            var total = Math.round(Number(newest.total) || 0);
            startAlarm(
              newest.id,
              'restaurant',
              '🚨 NEW ORDER RECEIVED!',
              'Order #' + shortId + ' · ₹' + total + ' · Tap to view and accept!'
            );
          }
        } else if (isAlarmActive) {
          stopAlarm();
        }
      })
      .catch(function () {
        isCheckingOrders = false;
      });
    }
  }

  setInterval(checkOrdersDirectly, 3500);
  setTimeout(checkOrdersDirectly, 1000);

  window.__kgt_test_alarm = function () {
    startAlarm(
      'TEST-1234',
      detectRoleFromPath(),
      '🔔 TEST ORDER ALARM',
      'Loud alarm test! Sound and vibration are active. Tap Silence to stop.'
    );
  };

  // ==========================================
  // SESSION AND ROLE MANAGEMENT
  // ==========================================
  function hasValidPartnerSession() {
    return getPartnerAuth() !== null;
  }

  function getActiveRole() {
    try {
      return (localStorage.getItem('kgt:active-role') || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function setActiveRole(role) {
    try {
      localStorage.setItem('kgt:active-role', role);
    } catch (e) {}
  }

  function triggerSmsRetriever() {
    try {
      if (window.AndroidOtp && typeof window.AndroidOtp.startSmsConsent === 'function') {
        window.AndroidOtp.startSmsConsent();
      }
    } catch (e) {}
  }

  function exitPartnerApp() {
    try {
      if (window.AndroidApp && typeof window.AndroidApp.exitApp === 'function') {
        window.AndroidApp.exitApp();
        return;
      }
    } catch (e) {}
    window.history.back();
  }

  // ==========================================
  // UNIVERSAL SIGN OUT FOR ALL PARTNER LOGINS
  // ==========================================
  function doPartnerSignOut() {
    try {
      stopAlarm();
    } catch (e) {}

    try {
      // Clear all possible session tokens in localStorage
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i) || '';
        if (
          k.indexOf('sb-') === 0 ||
          k.indexOf('kgt') === 0 ||
          k.indexOf('auth') !== -1 ||
          k.indexOf('token') !== -1 ||
          k.indexOf('supabase') !== -1
        ) {
          localStorage.removeItem(k);
        }
      }
      localStorage.removeItem('kgt:has-session');
      localStorage.removeItem('kgt:active-role');
      localStorage.removeItem('kgt-active-context');
      localStorage.removeItem('kgt:customer-phone');
      localStorage.removeItem('sb-khanaghartak-auth-token');
      sessionStorage.clear();
    } catch (e) {}

    try {
      if (window.supabase && window.supabase.auth && typeof window.supabase.auth.signOut === 'function') {
        window.supabase.auth.signOut({ scope: 'local' });
      }
    } catch (e) {}

    window.__partner_view = 'select';
    window.__partner_role = null;
    window.__partner_auth_step = 'phone';
    window.__partner_temp_phone = '';

    // Remove any dashboard DOM enhancements
    var fb = document.getElementById('kgt-fallback-signout');
    if (fb) fb.remove();
    var tb = document.getElementById('kgt-fallback-testsiren');
    if (tb) tb.remove();
    var setDiv = document.getElementById('kgt-partner-settings-signout');
    if (setDiv) setDiv.remove();
    var riderDiv = document.getElementById('kgt-partner-rider-signout');
    if (riderDiv) riderDiv.remove();
    var rNav = document.getElementById('kgt-rider-bottom-nav');
    if (rNav) rNav.remove();
    var zNav = document.getElementById('kgt-zone-bottom-nav');
    if (zNav) zNav.remove();

    syncAuthWithNative();

    window.location.replace('/login');
  }

  window.__kgt_partner_signout = doPartnerSignOut;

  // Intercept any click on sign out buttons anywhere in the app
  document.addEventListener(
    'click',
    function (e) {
      var target = e.target;
      if (!target) return;
      var btn = target.closest('button, a');
      if (!btn) return;
      var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      var text = (btn.textContent || '').trim().toLowerCase();
      if (
        aria === 'sign out' ||
        aria === 'logout' ||
        text === 'sign out' ||
        text === 'logout' ||
        text === 'sign out of restaurant' ||
        text === 'sign out of rider account' ||
        btn.classList.contains('kgt-signout-btn')
      ) {
        e.preventDefault();
        e.stopPropagation();
        doPartnerSignOut();
      }
    },
    true
  );

  // AUTOMATIC AUTO-SILENCE ON ACCEPT, REJECT, DECLINE, OR ASSIGN ACROSS ALL LOGINS
  document.addEventListener(
    'click',
    function (e) {
      var target = e.target;
      if (!target) return;
      var btn = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"]');
      if (!btn) return;
      var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      var text = (btn.textContent || '').trim().toLowerCase();
      var id = (btn.id || '').toLowerCase();
      var cls = (btn.className || '').toLowerCase();

      var isAction =
        text.indexOf('accept') !== -1 ||
        text.indexOf('reject') !== -1 ||
        text.indexOf('decline') !== -1 ||
        text.indexOf('take order') !== -1 ||
        text.indexOf('assign') !== -1 ||
        text.indexOf('mark delivered') !== -1 ||
        text.indexOf('silence') !== -1 ||
        aria.indexOf('accept') !== -1 ||
        aria.indexOf('reject') !== -1 ||
        aria.indexOf('decline') !== -1 ||
        id.indexOf('accept') !== -1 ||
        id.indexOf('reject') !== -1 ||
        cls.indexOf('accept') !== -1 ||
        cls.indexOf('reject') !== -1;

      if (isAction) {
        console.log('[KGT-PARTNER] Action clicked: stopping continuous alarm immediately');
        stopAlarm();
      }
    },
    true
  );

  // Stop alarm when a dropdown select is changed (e.g. Zone Manager assigning a rider)
  document.addEventListener(
    'change',
    function (e) {
      var target = e.target;
      if (target && target.tagName === 'SELECT') {
        console.log('[KGT-PARTNER] Select changed: stopping continuous alarm immediately');
        stopAlarm();
      }
    },
    true
  );

  // Navigation state
  if (!window.__partner_view) window.__partner_view = 'select';
  if (!window.__partner_role) window.__partner_role = null;
  if (!window.__partner_auth_step) window.__partner_auth_step = 'phone';

  var REVIEWER_PHONE = '9999999999';
  var REVIEWER_OTP_4 = '1234';
  var REVIEWER_OTP_6 = '123456';

  function completeReviewerPartnerLogin(role) {
    try {
      var targetRole = role || window.__partner_role || 'restaurant';
      var roleUserMap = {
        restaurant: {
          id: 'mock-reviewer-restaurant-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'partner.reviewer@khanaghartak.in',
          phone: '+919999999999',
          user_metadata: { role: 'restaurant', name: 'Reviewer Restaurant' }
        },
        rider: {
          id: 'mock-reviewer-rider-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'rider.reviewer@khanaghartak.in',
          phone: '+919999999999',
          user_metadata: { role: 'rider', name: 'Reviewer Rider' }
        },
        manager: {
          id: 'mock-reviewer-manager-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'zone.reviewer@khanaghartak.in',
          phone: '+919999999999',
          user_metadata: { role: 'zone_manager', name: 'Reviewer Zone Manager' }
        }
      };

      var userObj = roleUserMap[targetRole] || roleUserMap.restaurant;
      var sessionObj = {
        access_token: 'mock-partner-reviewer-token-' + Date.now(),
        token_type: 'bearer',
        expires_in: 360000,
        expires_at: Math.floor(Date.now() / 1000) + 360000,
        refresh_token: 'mock-partner-reviewer-refresh-token',
        user: userObj
      };

      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) {
          localStorage.setItem(k, JSON.stringify(sessionObj));
        }
      }
      localStorage.setItem('sb-khanaghartak-auth-token', JSON.stringify(sessionObj));
      localStorage.setItem('kgt:has-session', 'true');
      localStorage.setItem('kgt:customer-phone', REVIEWER_PHONE);
      setActiveRole(targetRole === 'manager' ? 'zone_manager' : targetRole);

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('kgt:auth-changed'));

      var portal = document.getElementById('kgt-partner-portal');
      if (portal) portal.remove();

      if (targetRole === 'manager' || targetRole === 'zone_manager') {
        window.location.replace('/zone');
      } else if (targetRole === 'rider') {
        window.location.replace('/rider');
      } else {
        window.location.replace('/admin');
      }
    } catch (e) {
      window.location.replace('/admin');
    }
  }

  // MSG91 Configuration
  var MSG91_WIDGET_ID = '36686d745256313731393737';
  var MSG91_TOKEN_AUTH = '560401T0Fc1eDo6a7e2ec1P1';
  var MSG91_SDK_SRC = 'https://verify.msg91.com/otp-provider.js';

  function loadAndWarmupMsg91(callback) {
    try {
      if (window.sendOtp && window.verifyOtp) {
        if (callback) callback();
        return;
      }
      var existing = document.querySelector('script[src="' + MSG91_SDK_SRC + '"]');
      if (!existing) {
        var s = document.createElement('script');
        s.src = MSG91_SDK_SRC;
        s.async = true;
        (document.head || document.documentElement).appendChild(s);
      }
      var waited = 0;
      var timer = setInterval(function () {
        waited += 100;
        if (typeof window.initSendOTP === 'function') {
          try {
            window.initSendOTP({
              widgetId: MSG91_WIDGET_ID,
              tokenAuth: MSG91_TOKEN_AUTH,
              exposeMethods: true,
              success: function () {},
              failure: function () {}
            });
          } catch (e) {}
        }
        if (window.sendOtp && window.verifyOtp) {
          clearInterval(timer);
          if (callback) callback();
          return;
        }
        if (waited >= 12000) {
          clearInterval(timer);
          if (callback) callback();
        }
      }, 100);
    } catch (e) {
      if (callback) callback();
    }
  }

  // Pre-warm MSG91 provider immediately
  loadAndWarmupMsg91();

  function setReactInputValue(input, val) {
    if (!input) return;
    try {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      if (setter) {
        setter.call(input, val);
      } else {
        input.value = val;
      }
      if (input._valueTracker) {
        input._valueTracker.setValue('');
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      input.value = val;
    }
  }

  function getUnderlyingPhoneInput() {
    var inputs = document.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (inp.closest('#kgt-partner-portal')) continue;
      var ph = (inp.getAttribute('placeholder') || '').toLowerCase();
      var tp = (inp.getAttribute('type') || '').toLowerCase();
      var im = (inp.getAttribute('inputmode') || '').toLowerCase();
      if (
        ph.indexOf('10-digit') !== -1 ||
        ph.indexOf('number') !== -1 ||
        ph.indexOf('mobile') !== -1 ||
        tp === 'tel' ||
        im === 'numeric'
      ) {
        return inp;
      }
    }
    return null;
  }

  function getUnderlyingSendButton() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b.closest('#kgt-partner-portal')) continue;
      var txt = (b.textContent || '').trim().toLowerCase();
      if (txt.indexOf('send otp') !== -1) {
        return b;
      }
    }
    return null;
  }

  function getUnderlyingOtpInput() {
    var inputs = document.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (inp.closest('#kgt-partner-portal')) continue;
      var id = (inp.id || '').toLowerCase();
      var cls = (inp.className || '').toLowerCase();
      var ph = (inp.getAttribute('placeholder') || '').toLowerCase();
      var ml = inp.getAttribute('maxlength');
      if (id === 'otp-input' || cls.indexOf('ck-input') !== -1 || ph.indexOf('____') !== -1 || ml === '4') {
        return inp;
      }
    }
    return null;
  }

  function getUnderlyingVerifyButton() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b.closest('#kgt-partner-portal')) continue;
      var txt = (b.textContent || '').trim().toLowerCase();
      if (txt.indexOf('verify') !== -1) {
        return b;
      }
    }
    return null;
  }

  // Ensure underlying React page displays the mobile phone entry form
  function prepareUnderlyingReactForMobile(role, callback) {
    try {
      var phoneInp = getUnderlyingPhoneInput();
      if (phoneInp) {
        if (callback) callback();
        return;
      }

      var targetRoleKeyword = role === 'manager' ? 'zone manager' : role === 'rider' ? 'rider' : 'restaurant';
      var buttons = document.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (btn.closest('#kgt-partner-portal')) continue;
        var txt = (btn.textContent || '').toLowerCase();
        if (txt.indexOf(targetRoleKeyword) !== -1 && txt.indexOf('login') !== -1) {
          btn.click();
          break;
        }
      }

      var attempts = 0;
      var timer = setInterval(function () {
        attempts++;
        var curInput = getUnderlyingPhoneInput();
        if (curInput) {
          clearInterval(timer);
          if (callback) callback();
          return;
        }

        var subBtns = document.querySelectorAll('button');
        for (var j = 0; j < subBtns.length; j++) {
          var sBtn = subBtns[j];
          if (sBtn.closest('#kgt-partner-portal')) continue;
          var sTxt = (sBtn.textContent || '').toLowerCase();
          if (sTxt.indexOf('continue with mobile') !== -1 || sTxt.indexOf('mobile number') !== -1) {
            sBtn.click();
            break;
          }
        }

        if (attempts > 30) {
          clearInterval(timer);
          if (callback) callback();
        }
      }, 40);
    } catch (e) {
      if (callback) callback();
    }
  }

  // ==========================================
  // DASHBOARD UI ENHANCER (NAV & SIGN OUT)
  // ==========================================
  function enhancePartnerDashboard() {
    try {
      var pathname = window.location.pathname || '';
      if (document.body) {
        document.body.classList.toggle('is-admin-route', pathname.indexOf('/admin') !== -1);
        document.body.classList.toggle('is-rider-route', pathname.indexOf('/rider') !== -1);
        document.body.classList.toggle('is-zone-route', pathname.indexOf('/zone') !== -1);
      }
      purgeCustomerNav();
      enhanceSignOutButtons();
      enhanceMenuModal();
      enhanceRestaurantNav();
      enhanceSettingsPage();
      enhanceRiderPage();
      enhanceRiderNav();
      enhanceZonePage();
      enhanceZoneNav();
      ensureFallbackSignout();
    } catch (e) {}
  }

  function purgeCustomerNav() {
    try {
      var navs = document.querySelectorAll('nav');
      for (var i = 0; i < navs.length; i++) {
        var n = navs[i];
        if (n.id === 'kgt-rider-bottom-nav' || n.id === 'kgt-zone-bottom-nav') continue;
        var hasCart = n.querySelector('a[href*="/cart"], a[href="/orders"], a[href="/home"]');
        var hasAdmin = n.querySelector('a[href*="/admin"]');
        var isCustomerNavClass = n.className && (n.className.indexOf('max-w-[480px]') !== -1 || n.getAttribute('data-testid') === 'customer-bottom-nav');
        if (hasCart || isCustomerNavClass || (!hasAdmin && window.location.pathname.indexOf('/admin') === -1)) {
          n.remove();
        }
      }
    } catch (e) {}
  }

  function enhanceMenuModal() {
    var modalBackdrop = document.querySelector('.fixed.inset-0:not(#kgt-partner-portal)');
    var nav = document.querySelector('nav.fixed.bottom-0, nav[class*="fixed"][class*="bottom-0"]');

    if (modalBackdrop) {
      document.body.classList.add('has-modal-open');

      // 1. Immediately hide bottom navigation bar so it cannot cover the Save button
      if (nav) {
        nav.style.setProperty('display', 'none', 'important');
      }

      // 2. Ensure modal backdrop has ultra-high z-index
      modalBackdrop.style.setProperty('z-index', '9999999', 'important');

      // 3. Find the modal dialog box
      var modalBox = modalBackdrop.querySelector('.bg-card, [class*="max-w-"]');
      if (modalBox) {
        modalBox.style.setProperty('max-height', '88vh', 'important');
        modalBox.style.setProperty('overflow-y', 'auto', 'important');
        modalBox.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
        modalBox.style.setProperty('touch-action', 'pan-y', 'important');
        modalBox.style.setProperty('overscroll-behavior', 'contain', 'important');
        modalBox.style.setProperty('padding-bottom', '24px', 'important');

        // Make the action button container sticky at the bottom with white background
        var btnGrid = modalBox.querySelector('.grid.grid-cols-2:last-child, .grid:last-of-type');
        if (btnGrid) {
          btnGrid.style.setProperty('position', 'sticky', 'important');
          btnGrid.style.setProperty('bottom', '0', 'important');
          btnGrid.style.setProperty('background', '#FFFFFF', 'important');
          btnGrid.style.setProperty('padding-top', '12px', 'important');
          btnGrid.style.setProperty('padding-bottom', '16px', 'important');
          btnGrid.style.setProperty('margin-top', '16px', 'important');
          btnGrid.style.setProperty('box-shadow', '0 -4px 12px rgba(0,0,0,0.08)', 'important');
          btnGrid.style.setProperty('z-index', '20', 'important');
        }
      }
    } else {
      document.body.classList.remove('has-modal-open');
    }
  }

  function enhanceRestaurantNav() {
    var pathname = window.location.pathname || '';
    if (pathname.indexOf('/admin') === -1) return;

    // Do not show bottom nav if a modal is open!
    var hasModal = document.querySelector('.fixed.inset-0:not(#kgt-partner-portal)');
    var nav = document.querySelector('nav.fixed.bottom-0, nav[class*="fixed"][class*="bottom-0"]');
    if (nav) {
      if (hasModal) {
        nav.style.setProperty('display', 'none', 'important');
      } else {
        nav.style.display = 'grid';
        nav.style.visibility = 'visible';
        nav.style.opacity = '1';
      }
    }

    var mainWrapper = document.querySelector('.flex-1');
    if (mainWrapper) {
      mainWrapper.style.paddingBottom = '88px';
    }
  }

  function enhanceSignOutButtons() {
    var buttons = document.querySelectorAll('button[aria-label="Sign out"], button[aria-label="Logout"]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.style.display = 'inline-flex';
      if (!btn.getAttribute('data-has-logout-text')) {
        btn.setAttribute('data-has-logout-text', 'true');
        var hasText = false;
        for (var j = 0; j < btn.childNodes.length; j++) {
          if (btn.childNodes[j].nodeType === 3 && btn.childNodes[j].textContent.trim().length > 0) {
            hasText = true;
            break;
          }
        }
        if (!hasText) {
          var span = document.createElement('span');
          span.textContent = 'Logout';
          span.style.cssText = 'font-size:12px;font-weight:700;line-height:1;margin-left:3px;color:#DC2626;';
          btn.appendChild(span);
        }
      }
    }
  }

  function enhanceSettingsPage() {
    var pathname = window.location.pathname || '';
    if (pathname.indexOf('/admin/settings') === -1) return;

    if (document.getElementById('kgt-partner-settings-signout')) return;

    var container = document.querySelector('main > div, main form, main .space-y-3');
    if (!container) container = document.querySelector('main');
    if (container) {
      var div = document.createElement('div');
      div.id = 'kgt-partner-settings-signout';
      div.style.cssText = 'margin-top:24px;margin-bottom:40px;padding:16px;background:#FFF;border:1.5px solid #FEE2E2;border-radius:18px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);';
      div.innerHTML =
        '<div style="font-size:14px;font-weight:800;color:#991B1B;margin-bottom:4px;">Sign Out of Restaurant</div>' +
        '<p style="font-size:12px;color:#64748B;margin:0 0 14px 0;">Switch account or log in as Rider / Zone Manager</p>' +
        '<button id="btn-kgt-settings-signout" type="button" class="kgt-signout-btn" style="width:100%;height:46px;font-size:14px;font-weight:700;border-radius:12px;">' +
        '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '  <span>Sign Out</span>' +
        '</button>';
      container.appendChild(div);

      var sBtn = document.getElementById('btn-kgt-settings-signout');
      if (sBtn) {
        sBtn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          doPartnerSignOut();
        };
      }
    }
  }

  function enhanceRiderPage() {
    var pathname = window.location.pathname || '';
    if (pathname.indexOf('/rider') === -1) return;

    if (document.getElementById('kgt-partner-rider-signout')) return;

    var container = document.querySelector('main > div, .mx-auto.max-w-md');
    if (!container) container = document.querySelector('main');
    if (container) {
      var div = document.createElement('div');
      div.id = 'kgt-partner-rider-signout';
      div.style.cssText = 'margin:24px 12px 36px 12px;padding:16px;background:#FFF;border:1.5px solid #FEE2E2;border-radius:18px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);';
      div.innerHTML =
        '<div style="font-size:14px;font-weight:800;color:#991B1B;margin-bottom:4px;">Sign Out of Rider Account</div>' +
        '<p style="font-size:12px;color:#64748B;margin:0 0 14px 0;">Go offline and return to Partner Login</p>' +
        '<button id="btn-kgt-rider-signout" type="button" class="kgt-signout-btn" style="width:100%;height:46px;font-size:14px;font-weight:700;border-radius:12px;">' +
        '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '  <span>Sign Out</span>' +
        '</button>';
      container.appendChild(div);

      var sBtn = document.getElementById('btn-kgt-rider-signout');
      if (sBtn) {
        sBtn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          doPartnerSignOut();
        };
      }
    }
  }

  function enhanceRiderNav() {
    var pathname = window.location.pathname || '';
    if (pathname.indexOf('/rider') === -1) {
      var existingRNav = document.getElementById('kgt-rider-bottom-nav');
      if (existingRNav) existingRNav.remove();
      return;
    }

    var riderContainer = document.querySelector('.mx-auto.max-w-md, main');
    if (riderContainer) {
      riderContainer.style.paddingBottom = '88px';
    }

    var rNav = document.getElementById('kgt-rider-bottom-nav');
    if (!rNav) {
      rNav = document.createElement('nav');
      rNav.id = 'kgt-rider-bottom-nav';
      rNav.innerHTML =
        '<button id="kgt-tab-offers" type="button" class="active">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>' +
        '    </svg>' +
        '    <span id="kgt-badge-offers" style="display:none;position:absolute;top:-6px;right:-12px;background:#EF4444;color:#FFFFFF;border-radius:9999px;font-size:10px;font-weight:800;padding:1px 5px;min-width:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.2);">0</span>' +
        '  </div>' +
        '  <span style="font-size:11px;font-weight:700;margin-top:2px;">New Offers</span>' +
        '</button>' +
        '<button id="kgt-tab-deliveries" type="button">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <path d="M16.5 9.4 7.55 4.24a1.78 1.78 0 0 0-1.8 0l-4.1 2.37A1.78 1.78 0 0 0 .75 8.15v7.7a1.78 1.78 0 0 0 .9 1.54l4.1 2.37a1.78 1.78 0 0 0 1.8 0l8.95-5.16a1.78 1.78 0 0 0 .9-1.54V9.4z"/><polyline points="3.29 7 12 12.01 20.71 7"/><line x1="12" y1="22.08" x2="12" y2="12"/>' +
        '    </svg>' +
        '    <span id="kgt-badge-deliveries" style="display:none;position:absolute;top:-6px;right:-12px;background:#3B82F6;color:#FFFFFF;border-radius:9999px;font-size:10px;font-weight:800;padding:1px 5px;min-width:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.2);">0</span>' +
        '  </div>' +
        '  <span style="font-size:11px;font-weight:700;margin-top:2px;">My Deliveries</span>' +
        '</button>' +
        '<button id="kgt-tab-earnings" type="button">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>' +
        '    </svg>' +
        '  </div>' +
        '  <span style="font-size:11px;font-weight:700;margin-top:2px;">My Earnings</span>' +
        '</button>';

      (document.body || document.documentElement).appendChild(rNav);

      document.getElementById('kgt-tab-offers').onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var allBtns = document.querySelectorAll('button');
        for (var i = 0; i < allBtns.length; i++) {
          if ((allBtns[i].textContent || '').indexOf('Offered to you') !== -1) {
            allBtns[i].click();
            allBtns[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
          }
        }
      };

      document.getElementById('kgt-tab-deliveries').onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var allBtns = document.querySelectorAll('button');
        for (var i = 0; i < allBtns.length; i++) {
          if ((allBtns[i].textContent || '').indexOf('My Deliveries') !== -1) {
            allBtns[i].click();
            allBtns[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
          }
        }
      };

      document.getElementById('kgt-tab-earnings').onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }

    // Dynamic sync of tab states and badge numbers from page DOM
    var allBtns = document.querySelectorAll('button');
    var offersBtn = null;
    var deliveriesBtn = null;
    for (var b = 0; b < allBtns.length; b++) {
      var txt = (allBtns[b].textContent || '').trim();
      if (txt.indexOf('Offered to you') !== -1) offersBtn = allBtns[b];
      else if (txt.indexOf('My Deliveries') !== -1) deliveriesBtn = allBtns[b];
    }

    var tabOffers = document.getElementById('kgt-tab-offers');
    var tabDeliveries = document.getElementById('kgt-tab-deliveries');
    var tabEarnings = document.getElementById('kgt-tab-earnings');
    var badgeOffers = document.getElementById('kgt-badge-offers');
    var badgeDeliveries = document.getElementById('kgt-badge-deliveries');

    if (offersBtn && badgeOffers) {
      var m = (offersBtn.textContent || '').match(/\((\d+)\)/);
      var cnt = m ? parseInt(m[1], 10) : 0;
      if (cnt > 0) {
        badgeOffers.textContent = cnt;
        badgeOffers.style.display = 'block';
      } else {
        badgeOffers.style.display = 'none';
      }
    }

    if (deliveriesBtn && badgeDeliveries) {
      var m2 = (deliveriesBtn.textContent || '').match(/\((\d+)\)/);
      var cnt2 = m2 ? parseInt(m2[1], 10) : 0;
      if (cnt2 > 0) {
        badgeDeliveries.textContent = cnt2;
        badgeDeliveries.style.display = 'block';
      } else {
        badgeDeliveries.style.display = 'none';
      }
    }

    // Sync active tab highlight
    if (deliveriesBtn && deliveriesBtn.classList.contains('bg-foreground')) {
      if (tabOffers) tabOffers.className = '';
      if (tabDeliveries) tabDeliveries.className = 'active';
      if (tabEarnings) tabEarnings.className = '';
    } else {
      if (tabOffers) tabOffers.className = 'active';
      if (tabDeliveries) tabDeliveries.className = '';
      if (tabEarnings) tabEarnings.className = '';
    }
  }

  function enhanceZonePage() {
    var pathname = window.location.pathname || '';
    if (pathname.indexOf('/zone') === -1) return;

    var header = document.querySelector('header');
    if (header) {
      var existingBtn = header.querySelector('button[aria-label="Sign out"], button[aria-label="Logout"]');
      if (existingBtn) {
        enhanceSignOutButtons();
      }
    }
  }

  function enhanceZoneNav() {
    var pathname = window.location.pathname || '';
    if (pathname.indexOf('/zone') === -1) {
      var existingZoneNav = document.getElementById('kgt-zone-bottom-nav');
      if (existingZoneNav) existingZoneNav.remove();
      return;
    }

    var zoneContainer = document.querySelector('.min-h-screen, main');
    if (zoneContainer) {
      zoneContainer.style.paddingBottom = '88px';
    }

    var zNav = document.getElementById('kgt-zone-bottom-nav');
    if (!zNav) {
      zNav = document.createElement('nav');
      zNav.id = 'kgt-zone-bottom-nav';
      zNav.innerHTML =
        '<button id="kgt-ztab-orders" type="button" class="active">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>' +
        '    </svg>' +
        '  </div>' +
        '  <span style="font-size:10px;font-weight:700;margin-top:2px;">Orders</span>' +
        '</button>' +
        '<button id="kgt-ztab-restaurants" type="button">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>' +
        '    </svg>' +
        '  </div>' +
        '  <span style="font-size:10px;font-weight:700;margin-top:2px;">Kitchens</span>' +
        '</button>' +
        '<button id="kgt-ztab-riders" type="button">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>' +
        '    </svg>' +
        '  </div>' +
        '  <span style="font-size:10px;font-weight:700;margin-top:2px;">Riders</span>' +
        '</button>' +
        '<button id="kgt-ztab-customers" type="button">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
        '    </svg>' +
        '  </div>' +
        '  <span style="font-size:10px;font-weight:700;margin-top:2px;">Customers</span>' +
        '</button>' +
        '<button id="kgt-ztab-map" type="button">' +
        '  <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">' +
        '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>' +
        '    </svg>' +
        '  </div>' +
        '  <span style="font-size:10px;font-weight:700;margin-top:2px;">Zone Map</span>' +
        '</button>';

      (document.body || document.documentElement).appendChild(zNav);

      function attachTabClick(id, topBtnId) {
        var el = document.getElementById(id);
        if (!el) return;
        el.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          var topBtn = document.getElementById(topBtnId);
          if (topBtn) {
            topBtn.click();
            topBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        };
      }

      attachTabClick('kgt-ztab-orders', 'kgt-zone-btn-orders');
      attachTabClick('kgt-ztab-restaurants', 'kgt-zone-btn-restaurants');
      attachTabClick('kgt-ztab-riders', 'kgt-zone-btn-riders');
      attachTabClick('kgt-ztab-customers', 'kgt-zone-btn-customers');
      attachTabClick('kgt-ztab-map', 'kgt-zone-btn-map');
    }

    // Sync active state from top tab buttons
    var topTabs = ['orders', 'restaurants', 'riders', 'customers', 'map'];
    topTabs.forEach(function (key) {
      var topBtn = document.getElementById('kgt-zone-btn-' + key);
      var bottomBtn = document.getElementById('kgt-ztab-' + key);
      if (topBtn && bottomBtn) {
        var isTopActive = topBtn.classList.contains('bg-primary');
        if (isTopActive) {
          bottomBtn.className = 'active';
        } else {
          bottomBtn.className = '';
        }
      }
    });
  }

  function ensureFallbackSignout() {
    var hasSession = hasValidPartnerSession();
    if (!hasSession) {
      var fb = document.getElementById('kgt-fallback-signout');
      if (fb) fb.remove();
      var tb = document.getElementById('kgt-fallback-testsiren');
      if (tb) tb.remove();
      return;
    }

    // Always provide visible "🔔 Test Siren" button when authenticated so partner can verify alarm anytime
    // Placed at bottom-right above bottom navigation so it never overlaps the header title or manager info
    if (!document.getElementById('kgt-fallback-testsiren')) {
      var testPill = document.createElement('button');
      testPill.id = 'kgt-fallback-testsiren';
      testPill.type = 'button';
      testPill.style.cssText =
        'position:fixed;bottom:78px;right:14px;z-index:99999;background:#FEF2F2;color:#DC2626;border:1.5px solid #FECACA;border-radius:9999px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(220,38,38,0.22);';
      testPill.innerHTML = '<span>🔔 Test Siren</span>';
      testPill.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        startAlarm(
          'TEST-ORDER-1234',
          detectRoleFromPath(),
          '🔔 TEST ORDER ALARM',
          'Loud siren test! Tap ✕ Silence on the red banner to stop.'
        );
      };
      (document.body || document.documentElement).appendChild(testPill);
    }

    var existingHeaderBtn = document.querySelector('header button[aria-label="Sign out"], header button[aria-label="Logout"], header .kgt-signout-btn');
    if (existingHeaderBtn && existingHeaderBtn.offsetParent !== null) {
      var fb = document.getElementById('kgt-fallback-signout');
      if (fb) fb.remove();
      return;
    }

    if (!document.getElementById('kgt-fallback-signout')) {
      var pill = document.createElement('button');
      pill.id = 'kgt-fallback-signout';
      pill.type = 'button';
      pill.className = 'kgt-signout-btn';
      pill.style.cssText = 'position:fixed;top:10px;right:12px;z-index:999999;';
      pill.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '<span>Logout</span>';
      pill.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        doPartnerSignOut();
      };
      (document.body || document.documentElement).appendChild(pill);
    }
  }

  // ==========================================
  // UI RENDERER
  // ==========================================
  function updatePartnerUi() {
    var pathname = window.location.pathname || '';
    var isRoot = pathname === '/' || pathname === '';
    var isLogin = pathname === '/login' || pathname.indexOf('/login') !== -1;
    var isHome = pathname === '/home' || pathname.indexOf('/home') !== -1;
    var hasSession = hasValidPartnerSession();

    if (hasSession) {
      var existingPortal = document.getElementById('kgt-partner-portal');
      if (existingPortal) existingPortal.remove();

      if (isRoot || isLogin || isHome) {
        var active = getActiveRole();
        if (active.indexOf('zone') !== -1 || active.indexOf('manager') !== -1) {
          window.location.replace('/zone');
        } else if (active.indexOf('rider') !== -1) {
          window.location.replace('/rider');
        } else {
          window.location.replace('/admin');
        }
      }
      enhancePartnerDashboard();
      return;
    }

    // Clean up dashboard buttons when unauthenticated
    var fb = document.getElementById('kgt-fallback-signout');
    if (fb) fb.remove();
    var tb = document.getElementById('kgt-fallback-testsiren');
    if (tb) tb.remove();
    var setDiv = document.getElementById('kgt-partner-settings-signout');
    if (setDiv) setDiv.remove();
    var riderDiv = document.getElementById('kgt-partner-rider-signout');
    if (riderDiv) riderDiv.remove();
    var rNav = document.getElementById('kgt-rider-bottom-nav');
    if (rNav) rNav.remove();
    var zNav = document.getElementById('kgt-zone-bottom-nav');
    if (zNav) zNav.remove();

    // Unauthenticated: always stay on /login
    if (isRoot || isHome) {
      window.location.replace('/login');
      return;
    }

    if (isLogin) {
      document.querySelectorAll('a, button, p, span').forEach(function (el) {
        if (el.closest('#kgt-partner-portal')) return;
        var txt = (el.textContent || '').trim().toLowerCase();
        if (txt === '← back to home' || txt === 'back to home') {
          el.style.display = 'none';
        }
      });
      renderPartnerPortal();
    }
  }

  function renderPartnerPortal() {
    var portal = document.getElementById('kgt-partner-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'kgt-partner-portal';
      // Center column layout without justify-content: space-between
      portal.style.cssText =
        'position:fixed;inset:0;z-index:9999999;background:#FFFFFF;width:100vw;height:100vh;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;color:#0F172A;box-sizing:border-box;padding:16px 20px;';
      document.body.appendChild(portal);
    }

    var currentView = window.__partner_view || 'select';
    var selectedRole = window.__partner_role || null;
    var authStep = window.__partner_auth_step || 'phone';

    // ----------------------------------------
    // VIEW 1: ROLE SELECTION (3 Buttons just after Logo)
    // ----------------------------------------
    if (currentView === 'select' || !selectedRole) {
      if (portal.getAttribute('data-view') !== 'select') {
        portal.setAttribute('data-view', 'select');
        portal.innerHTML =
          '<div style="width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;align-items:center;box-sizing:border-box;">' +
          // Logo container - compact & prominent
          '  <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">' +
          '    <img id="partner-portal-logo" src="https://khanaghartak.in/__l5e/assets-v1/8863a66e-7115-4037-ab62-8765b7ae09f3/khanaghartak-logo.png" ' +
          '         onerror="this.onerror=null;this.src=\'/khanaghartak-logo.png\';" ' +
          '         alt="KhanaGharTak" ' +
          '         style="width:55vw;max-width:230px;aspect-ratio:1/1;object-fit:contain;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,0.06);display:block;margin:0 auto;" />' +
          '  </div>' +
          // Subtitle header
          '  <div style="text-align:center;margin-bottom:14px;">' +
          '    <h2 style="font-size:18px;font-weight:800;color:#0F172A;margin:0 0 3px 0;">Partner Sign In</h2>' +
          '    <p style="font-size:12.5px;color:#64748B;margin:0;">Select your role to access dashboard & orders</p>' +
          '  </div>' +
          // 3 Role Buttons CONTAINER - COMES JUST AFTER LOGO
          '  <div style="width:100%;display:flex;flex-direction:column;gap:11px;box-sizing:border-box;">' +
          // 1. Restaurant Login Button
          '    <button id="btn-role-restaurant" type="button" style="width:100%;border-radius:18px;border:1.5px solid #FED7AA;background:#FFFFFF;padding:13px 16px;box-shadow:0 2px 8px rgba(244,93,44,0.08);display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;">' +
          '      <div style="width:46px;height:46px;border-radius:14px;background:#FFF7ED;color:#F45D2C;border:1px solid #FFEDD5;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F45D2C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8Z"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/></svg>' +
          '      </div>' +
          '      <div style="flex:1;min-width:0;">' +
          '        <div style="font-size:15.5px;font-weight:800;color:#0F172A;line-height:1.2;">Restaurant Login</div>' +
          '        <div style="font-size:12px;color:#64748B;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Kitchen orders, menus & store status</div>' +
          '      </div>' +
          '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F45D2C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          '    </button>' +
          // 2. Rider Login Button
          '    <button id="btn-role-rider" type="button" style="width:100%;border-radius:18px;border:1.5px solid #A7F3D0;background:#FFFFFF;padding:13px 16px;box-shadow:0 2px 8px rgba(5,150,105,0.08);display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;">' +
          '      <div style="width:46px;height:46px;border-radius:14px;background:#ECFDF5;color:#059669;border:1px solid #D1FAE5;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>' +
          '      </div>' +
          '      <div style="flex:1;min-width:0;">' +
          '        <div style="font-size:15.5px;font-weight:800;color:#0F172A;line-height:1.2;">Rider Login</div>' +
          '        <div style="font-size:12px;color:#64748B;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Deliver orders, go online & track earnings</div>' +
          '      </div>' +
          '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          '    </button>' +
          // 3. Zone Manager Login Button
          '    <button id="btn-role-manager" type="button" style="width:100%;border-radius:18px;border:1.5px solid #BFDBFE;background:#FFFFFF;padding:13px 16px;box-shadow:0 2px 8px rgba(37,99,235,0.08);display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;">' +
          '      <div style="width:46px;height:46px;border-radius:14px;background:#EFF6FF;color:#2563EB;border:1px solid #DBEAFE;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>' +
          '      </div>' +
          '      <div style="flex:1;min-width:0;">' +
          '        <div style="font-size:15.5px;font-weight:800;color:#0F172A;line-height:1.2;">Zone Manager Login</div>' +
          '        <div style="font-size:12px;color:#64748B;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Delivery zones & live order operations</div>' +
          '      </div>' +
          '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          '    </button>' +
          '  </div>' +
          '  <div style="text-align:center;font-size:11px;color:#94A3B8;font-weight:600;padding-top:14px;">KhanaGharTak Partner Network</div>' +
          '</div>';

        var btnR = document.getElementById('btn-role-restaurant');
        if (btnR) {
          btnR.onclick = function () {
            window.__partner_role = 'restaurant';
            window.__partner_view = 'auth';
            window.__partner_auth_step = 'phone';
            setActiveRole('restaurant');
            try {
              localStorage.setItem('kgt-active-context', 'restaurant');
            } catch (e) {}
            prepareUnderlyingReactForMobile('restaurant');
            renderPartnerPortal();
          };
        }

        var btnRi = document.getElementById('btn-role-rider');
        if (btnRi) {
          btnRi.onclick = function () {
            window.__partner_role = 'rider';
            window.__partner_view = 'auth';
            window.__partner_auth_step = 'phone';
            setActiveRole('rider');
            try {
              localStorage.setItem('kgt-active-context', 'rider');
            } catch (e) {}
            prepareUnderlyingReactForMobile('rider');
            renderPartnerPortal();
          };
        }

        var btnM = document.getElementById('btn-role-manager');
        if (btnM) {
          btnM.onclick = function () {
            window.__partner_role = 'manager';
            window.__partner_view = 'auth';
            window.__partner_auth_step = 'phone';
            setActiveRole('zone_manager');
            try {
              localStorage.setItem('kgt-active-context', 'manager');
            } catch (e) {}
            prepareUnderlyingReactForMobile('manager');
            renderPartnerPortal();
          };
        }
      }
      return;
    }

    // ----------------------------------------
    // VIEW 2: ROLE-SPECIFIC AUTHENTICATION (Mobile OTP - 4 DIGITS)
    // ----------------------------------------
    var roleConfigs = {
      restaurant: {
        title: 'Restaurant Login',
        badge: 'Restaurant Partner',
        badgeBg: '#FFF7ED',
        badgeColor: '#F45D2C',
        badgeBorder: '#FFEDD5',
        themeColor: '#F45D2C',
        desc: 'Sign in with your mobile number to manage kitchen orders & store.'
      },
      rider: {
        title: 'Rider Login',
        badge: 'Rider Partner',
        badgeBg: '#ECFDF5',
        badgeColor: '#059669',
        badgeBorder: '#D1FAE5',
        themeColor: '#059669',
        desc: 'Sign in with your mobile number to deliver orders & track earnings.'
      },
      manager: {
        title: 'Zone Manager Login',
        badge: 'Zone Operations',
        badgeBg: '#EFF6FF',
        badgeColor: '#2563EB',
        badgeBorder: '#DBEAFE',
        themeColor: '#2563EB',
        desc: 'Sign in with your mobile number to manage delivery zones & live orders.'
      }
    };

    var cfg = roleConfigs[selectedRole] || roleConfigs.restaurant;
    var viewKey = 'auth-' + selectedRole + '-' + authStep;

    if (portal.getAttribute('data-view') !== viewKey) {
      portal.setAttribute('data-view', viewKey);

      var authStepHtml = '';

      if (authStep === 'phone') {
        var existingPhone = window.__partner_temp_phone || '';
        authStepHtml =
          '<div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">' +
          '  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:2px;">Enter Mobile Number</label>' +
          '  <div style="display:flex;align-items:center;border:1.5px solid #CBD5E1;border-radius:16px;padding:0 14px;background:#FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,0.04);">' +
          '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" style="flex-shrink:0;margin-right:8px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
          '    <span style="font-size:15px;font-weight:700;color:#334155;margin-right:8px;">+91</span>' +
          '    <input id="partner-input-phone" type="tel" maxlength="10" value="' + existingPhone + '" placeholder="10-digit mobile number" style="width:100%;height:52px;border:none;background:transparent;font-size:16px;font-weight:600;color:#0F172A;outline:none;" />' +
          '  </div>' +
          '  <button id="partner-btn-send-otp" type="button" style="height:52px;width:100%;border-radius:16px;background:' + cfg.themeColor + ';color:#FFFFFF;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.15);outline:none;">' +
          '    Send OTP' +
          '  </button>' +
          '  <div style="display:flex;align-items:center;margin:6px 0;">' +
          '    <div style="flex:1;height:1px;background:#E2E8F0;"></div>' +
          '    <span style="padding:0 10px;font-size:12px;color:#94A3B8;font-weight:600;">OR</span>' +
          '    <div style="flex:1;height:1px;background:#E2E8F0;"></div>' +
          '  </div>' +
          '  <button id="partner-btn-goto-email" type="button" style="height:46px;width:100%;border-radius:16px;background:#FFFFFF;color:#334155;font-size:13.5px;font-weight:600;border:1px solid #CBD5E1;cursor:pointer;outline:none;">' +
          '    Sign In with Email / Password' +
          '  </button>' +
          '</div>';
      } else if (authStep === 'otp') {
        var sentPhone = window.__partner_temp_phone || '';
        authStepHtml =
          '<div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">' +
          '  <div style="font-size:13px;color:#059669;font-weight:600;background:#ECFDF5;padding:10px 14px;border-radius:12px;border:1px solid #A7F3D0;display:flex;align-items:center;gap:8px;">' +
          '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>' +
          '    <span>4-digit OTP sent to +91 ' + sentPhone + ' by SMS!</span>' +
          '  </div>' +
          '  <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:2px;">Enter 4-digit Verification Code</label>' +
          '  <input id="partner-input-otp" type="tel" maxlength="4" placeholder="____" style="width:100%;height:56px;border:1.5px solid #CBD5E1;border-radius:16px;font-size:28px;font-weight:800;text-align:center;letter-spacing:14px;color:#0F172A;outline:none;background:#FFFFFF;box-shadow:0 1px 2px rgba(0,0,0,0.04);" />' +
          '  <button id="partner-btn-verify-otp" type="button" style="height:52px;width:100%;border-radius:16px;background:' + cfg.themeColor + ';color:#FFFFFF;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.15);outline:none;">' +
          '    Verify & Enter Dashboard' +
          '  </button>' +
          '  <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">' +
          '    <button id="partner-btn-resend-otp" type="button" style="background:transparent;border:none;color:' + cfg.themeColor + ';font-size:13px;font-weight:700;cursor:pointer;padding:4px;">' +
          '      Resend OTP' +
          '    </button>' +
          '    <button id="partner-btn-reenter-phone" type="button" style="background:transparent;border:none;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;padding:4px;">' +
          '      ← Change Number' +
          '    </button>' +
          '  </div>' +
          '</div>';
      } else if (authStep === 'email') {
        authStepHtml =
          '<div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">' +
          '  <div>' +
          '    <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;">Email Address</label>' +
          '    <input id="partner-input-email" type="email" placeholder="partner@khanaghartak.in" style="width:100%;height:50px;border:1.5px solid #CBD5E1;border-radius:16px;padding:0 14px;font-size:15px;color:#0F172A;outline:none;background:#FFFFFF;box-sizing:border-box;" />' +
          '  </div>' +
          '  <div>' +
          '    <label style="display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;">Password</label>' +
          '    <input id="partner-input-password" type="password" placeholder="••••••••" style="width:100%;height:50px;border:1.5px solid #CBD5E1;border-radius:16px;padding:0 14px;font-size:15px;color:#0F172A;outline:none;background:#FFFFFF;box-sizing:border-box;" />' +
          '  </div>' +
          '  <button id="partner-btn-submit-email" type="button" style="height:52px;width:100%;border-radius:16px;background:' + cfg.themeColor + ';color:#FFFFFF;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.15);outline:none;">' +
          '    Sign In' +
          '  </button>' +
          '  <button id="partner-btn-goto-phone" type="button" style="background:transparent;border:none;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;padding:6px;">' +
          '    ← Continue with Mobile Number' +
          '  </button>' +
          '</div>';
      }

      portal.innerHTML =
        '<div style="max-width:420px;margin:0 auto;width:100%;padding:24px 20px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;">' +
        '  <div style="margin-bottom:16px;">' +
        '    <button id="btn-partner-back" type="button" style="display:inline-flex;align-items:center;gap:8px;border:none;background:transparent;font-size:14px;font-weight:700;color:#475569;cursor:pointer;padding:4px 0;outline:none;">' +
        '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>' +
        '      Change Role' +
        '    </button>' +
        '  </div>' +
        '  <div style="text-align:left;margin-bottom:8px;">' +
        '    <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:9999px;background:' + cfg.badgeBg + ';color:' + cfg.badgeColor + ';border:1px solid ' + cfg.badgeBorder + ';font-size:12px;font-weight:700;margin-bottom:10px;">' +
        '      ' + cfg.badge +
        '    </div>' +
        '    <h1 style="font-size:22px;font-weight:800;color:#0F172A;margin:0 0 4px 0;letter-spacing:-0.5px;">' +
        '      ' + cfg.title +
        '    </h1>' +
        '    <p style="font-size:13px;color:#64748B;margin:0;line-height:1.4;">' +
        '      ' + cfg.desc +
        '    </p>' +
        '  </div>' +
        authStepHtml +
        '</div>';

      var backBtn = document.getElementById('btn-partner-back');
      if (backBtn) {
        backBtn.onclick = function () {
          window.__partner_view = 'select';
          window.__partner_role = null;
          window.__partner_auth_step = 'phone';
          renderPartnerPortal();
        };
      }

      var gotoEmailBtn = document.getElementById('partner-btn-goto-email');
      if (gotoEmailBtn) {
        gotoEmailBtn.onclick = function () {
          window.__partner_auth_step = 'email';
          renderPartnerPortal();
        };
      }

      var gotoPhoneBtn = document.getElementById('partner-btn-goto-phone');
      if (gotoPhoneBtn) {
        gotoPhoneBtn.onclick = function () {
          window.__partner_auth_step = 'phone';
          renderPartnerPortal();
        };
      }

      var reenterPhoneBtn = document.getElementById('partner-btn-reenter-phone');
      if (reenterPhoneBtn) {
        reenterPhoneBtn.onclick = function () {
          window.__partner_auth_step = 'phone';
          renderPartnerPortal();
        };
      }

      var resendBtn = document.getElementById('partner-btn-resend-otp');
      if (resendBtn) {
        resendBtn.onclick = function () {
          var targetPhone = window.__partner_temp_phone || '';
          if (!targetPhone) {
            window.__partner_auth_step = 'phone';
            renderPartnerPortal();
            return;
          }
          resendBtn.disabled = true;
          resendBtn.innerText = 'Resending…';
          triggerSmsRetriever();

          prepareUnderlyingReactForMobile(selectedRole, function () {
            var underlying = getUnderlyingPhoneInput();
            if (underlying) {
              setReactInputValue(underlying, targetPhone);
            }

            // Look for resend button in React or send button
            var underResend = null;
            document.querySelectorAll('button').forEach(function (b) {
              if (b.closest('#kgt-partner-portal')) return;
              var txt = (b.textContent || '').trim().toLowerCase();
              if (txt.indexOf('resend') !== -1 || txt.indexOf('send otp') !== -1) {
                underResend = b;
              }
            });
            if (underResend && !underResend.disabled) {
              underResend.click();
            } else if (typeof window.sendOtp === 'function') {
              window.sendOtp('91' + targetPhone, function () {}, function () {});
            }

            setTimeout(function () {
              resendBtn.disabled = false;
              resendBtn.innerText = 'Resend OTP';
              alert('OTP resent to +91 ' + targetPhone);
            }, 1200);
          });
        };
      }

      // SEND OTP
      var sendOtpBtn = document.getElementById('partner-btn-send-otp');
      if (sendOtpBtn) {
        sendOtpBtn.onclick = function () {
          var phoneInp = document.getElementById('partner-input-phone');
          var phone = (phoneInp ? phoneInp.value : '').replace(/\D/g, '').slice(-10);

          if (!/^[6-9]\d{9}$/.test(phone)) {
            alert('Please enter a valid 10-digit mobile number');
            return;
          }

          sendOtpBtn.disabled = true;
          sendOtpBtn.innerText = 'Sending OTP…';
          triggerSmsRetriever();

          // Reviewer Test Mobile (9999999999)
          if (phone === REVIEWER_PHONE) {
            setTimeout(function () {
              window.__partner_auth_step = 'otp';
              window.__partner_temp_phone = phone;
              renderPartnerPortal();
              var otpInput = document.getElementById('partner-input-otp');
              if (otpInput) {
                otpInput.value = REVIEWER_OTP_4;
              }
            }, 400);
            return;
          }

          // Real Mobile User -> Populate underlying React <MobileLogin />
          prepareUnderlyingReactForMobile(selectedRole, function () {
            var underlying = getUnderlyingPhoneInput();
            if (underlying) {
              setReactInputValue(underlying, phone);
            }

            var pollCount = 0;
            var sent = false;

            var pollInterval = setInterval(function () {
              pollCount++;
              var underSend = getUnderlyingSendButton();

              // When the underlying button becomes enabled in React, click it!
              if (underSend && !underSend.disabled) {
                clearInterval(pollInterval);
                sent = true;
                console.log('[KGT-PARTNER] Clicking enabled Send OTP button in React');
                underSend.click();

                setTimeout(function () {
                  window.__partner_auth_step = 'otp';
                  window.__partner_temp_phone = phone;
                  renderPartnerPortal();
                }, 500);
                return;
              }

              // If after 900ms the button is still disabled or not found:
              if (pollCount >= 18 && !sent) {
                clearInterval(pollInterval);
                sent = true;

                if (underSend) {
                  console.log('[KGT-PARTNER] Force clicking Send OTP button');
                  try {
                    underSend.removeAttribute('disabled');
                    underSend.disabled = false;
                    underSend.click();
                  } catch (e) {}
                }

                // Call direct MSG91 as bulletproof fallback
                if (typeof window.sendOtp === 'function') {
                  console.log('[KGT-PARTNER] Fallback to direct window.sendOtp');
                  window.sendOtp('91' + phone, function (data) {
                    console.log('[KGT-PARTNER] Direct MSG91 OTP sent', data);
                    var reqId = (data && (data.reqId || data.requestId || data.message || (data.data && data.data.reqId))) || '';
                    window.__partner_msg91_req_id = reqId;
                  }, function (err) {
                    console.warn('[KGT-PARTNER] Direct MSG91 notice:', err);
                  });
                }

                setTimeout(function () {
                  window.__partner_auth_step = 'otp';
                  window.__partner_temp_phone = phone;
                  renderPartnerPortal();
                }, 500);
              }
            }, 50);
          });
        };
      }

      // VERIFY OTP (4 DIGITS)
      var verifyOtpBtn = document.getElementById('partner-btn-verify-otp');
      if (verifyOtpBtn) {
        verifyOtpBtn.onclick = function () {
          var otpInp = document.getElementById('partner-input-otp');
          var otp = (otpInp ? otpInp.value : '').replace(/\D/g, '');

          // Check if Reviewer test account
          if (window.__partner_temp_phone === REVIEWER_PHONE && (otp === REVIEWER_OTP_4 || otp === REVIEWER_OTP_6)) {
            verifyOtpBtn.disabled = true;
            verifyOtpBtn.innerText = 'Verifying…';
            completeReviewerPartnerLogin(selectedRole);
            return;
          }

          if (otp.length !== 4) {
            alert('Please enter the 4-digit verification code');
            return;
          }

          verifyOtpBtn.disabled = true;
          verifyOtpBtn.innerText = 'Verifying…';

          // Call underlying hook exposed by MobileLogin.tsx if present
          if (typeof window.__kgt_set_otp === 'function') {
            try {
              window.__kgt_set_otp(otp);
            } catch (e) {}
          }

          // Also populate underlying OTP input in React
          var underlyingOtp = getUnderlyingOtpInput();
          if (underlyingOtp) {
            setReactInputValue(underlyingOtp, otp);
          }

          var vPoll = 0;
          var vClicked = false;
          var vTimer = setInterval(function () {
            vPoll++;
            var underVerify = getUnderlyingVerifyButton();
            if (underVerify && !underVerify.disabled) {
              clearInterval(vTimer);
              vClicked = true;
              console.log('[KGT-PARTNER] Clicking enabled underlying Verify button');
              underVerify.click();
              return;
            }
            if (vPoll >= 15 && !vClicked) {
              clearInterval(vTimer);
              if (underVerify) {
                try {
                  console.log('[KGT-PARTNER] Force clicking underlying Verify button');
                  underVerify.removeAttribute('disabled');
                  underVerify.disabled = false;
                  underVerify.click();
                } catch (e) {}
              }
            }
          }, 40);

          // Direct MSG91 verify fallback if reqId is stored
          if (window.__partner_msg91_req_id && typeof window.verifyOtp === 'function') {
            window.verifyOtp(otp, function (tokenData) {
              console.log('[KGT-PARTNER] Direct MSG91 verified', tokenData);
            }, function (err) {
              console.warn('[KGT-PARTNER] Direct MSG91 verify notice:', err);
            }, window.__partner_msg91_req_id);
          }
        };
      }

      // EMAIL LOGIN
      var emailSubmitBtn = document.getElementById('partner-btn-submit-email');
      if (emailSubmitBtn) {
        emailSubmitBtn.onclick = function () {
          var emInp = document.getElementById('partner-input-email');
          var pwInp = document.getElementById('partner-input-password');
          var email = (emInp ? emInp.value : '').trim();
          var pw = (pwInp ? pwInp.value : '').trim();

          if (!email || !pw) {
            alert('Please enter both email and password');
            return;
          }

          emailSubmitBtn.disabled = true;
          emailSubmitBtn.innerText = 'Signing In…';

          var underEm = document.querySelector('input[type="email"]');
          var underPw = document.querySelector('input[type="password"]');
          if (underEm && underPw && !underEm.closest('#kgt-partner-portal')) {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            if (setter) {
              setter.call(underEm, email);
              setter.call(underPw, pw);
            } else {
              underEm.value = email;
              underPw.value = pw;
            }
            underEm.dispatchEvent(new Event('input', { bubbles: true }));
            underPw.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelectorAll('button').forEach(function (b) {
              if (b.closest('#kgt-partner-portal')) return;
              var txt = (b.textContent || '').trim().toLowerCase();
              if (txt.indexOf('sign in') !== -1 || txt.indexOf('login') !== -1) b.click();
            });
          }
        };
      }
    }
  }

  // ==========================================
  // HARDWARE BACK BUTTON NAVIGATION
  // ==========================================
  function handlePartnerHardwareBack() {
    stopAlarm();

    var hasSession = hasValidPartnerSession();
    if (!hasSession) {
      var currentView = window.__partner_view || 'select';
      var authStep = window.__partner_auth_step || 'phone';

      if (currentView === 'select' || !window.__partner_role) {
        exitPartnerApp();
        return;
      }

      if (currentView === 'auth') {
        if (authStep === 'otp' || authStep === 'email') {
          window.__partner_auth_step = 'phone';
          renderPartnerPortal();
          return;
        }
        if (authStep === 'phone') {
          window.__partner_view = 'select';
          window.__partner_role = null;
          renderPartnerPortal();
          return;
        }
      }

      exitPartnerApp();
      return;
    }

    var p = window.location.pathname || '';
    if (p === '/admin' || p === '/rider' || p === '/zone' || p === '/' || p === '') {
      exitPartnerApp();
      return;
    }

    var active = getActiveRole();
    if (active.indexOf('zone') !== -1 || active.indexOf('manager') !== -1) {
      window.location.replace('/zone');
    } else if (active.indexOf('rider') !== -1) {
      window.location.replace('/rider');
    } else {
      window.location.replace('/admin');
    }
  }

  window.__kgt_partner_handle_back = handlePartnerHardwareBack;

  function initPartnerBackListener() {
    if (window.__kgt_partner_back_registered) return true;
    try {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.App &&
        typeof window.Capacitor.Plugins.App.addListener === 'function'
      ) {
        window.Capacitor.Plugins.App.addListener('backButton', function () {
          handlePartnerHardwareBack();
        });
        window.__kgt_partner_back_registered = true;
        return true;
      }
    } catch (e) {}
    return false;
  }

  if (!initPartnerBackListener()) {
    var pBackTimer = setInterval(function () {
      if (initPartnerBackListener()) clearInterval(pBackTimer);
    }, 150);
  }

  if (!window.__kgt_partner_doc_back) {
    window.__kgt_partner_doc_back = true;
    document.addEventListener('backbutton', function () {
      handlePartnerHardwareBack();
    });
  }

  // History listener
  if (!window.__kgt_partner_history_patched) {
    window.__kgt_partner_history_patched = true;
    var origPush = history.pushState;
    history.pushState = function () {
      var ret = origPush.apply(this, arguments);
      updatePartnerUi();
      return ret;
    };
    var origReplace = history.replaceState;
    history.replaceState = function () {
      var ret = origReplace.apply(this, arguments);
      updatePartnerUi();
      return ret;
    };
    window.addEventListener('popstate', function () {
      updatePartnerUi();
    });
  }

  updatePartnerUi();
  setInterval(updatePartnerUi, 250);
  window.addEventListener('storage', updatePartnerUi);
})();
