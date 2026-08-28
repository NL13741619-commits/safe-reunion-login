(function () {
  if (window.__callNotifyLoaded) return;
  window.__callNotifyLoaded = true;

  var SUPABASE_URL = "https://perfsipperncvjocznhl.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcmZzaXBwZXJuY3Zqb2N6bmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTUyMzAsImV4cCI6MjEwMTU5MTIzMH0.I7vXkV247kAzRJ0RigDZt3Hzn8KJDyMc6o9E3oHJZoY";

  var onCallPage = /call\.html/i.test(location.pathname);
  var sb = null;
  var me = null;
  var myGroupIds = {};
  var shownId = null;
  var activeId = null;
  var ringTimer = null;
  var audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function beep(freq, dur) {
    try {
      var ctx = ensureAudio();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.12;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (dur || 0.2));
    } catch (e) {}
  }
  function startRing(kind) {
    stopRing();
    if (navigator.vibrate) {
      try { navigator.vibrate([300, 200, 300, 200]); } catch (e) {}
    }
    ringTimer = setInterval(function () {
      if (kind === "audio") {
        beep(520, 0.22);
        setTimeout(function () { beep(620, 0.22); }, 280);
      } else {
        beep(880, 0.18);
        setTimeout(function () { beep(1040, 0.18); }, 220);
        setTimeout(function () { beep(1200, 0.18); }, 440);
      }
      if (navigator.vibrate) {
        try { navigator.vibrate(200); } catch (e) {}
      }
    }, 1600);
  }
  function stopRing() {
    if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
  }

  function isMine(row) {
    if (!row || !me) return false;
    if (row.caller_id && String(row.caller_id) === String(me.id)) return true;
    if (row.callee_id && String(row.callee_id) === String(me.id)) return true;
    if (row.room_id && myGroupIds[String(row.room_id)]) return true;
    return false;
  }
  function isCaller(row) {
    return row && me && row.caller_id && String(row.caller_id) === String(me.id);
  }
  function modeText(row) {
    return row && row.mode === "audio" ? "èªé³" : "è¦è¨";
  }

  function ensureUI() {
    if (document.getElementById("globalIncoming")) return;
    var style = document.createElement("style");
    style.textContent =
      "#globalIncoming{display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);" +
      "color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;" +
      "flex-direction:column;align-items:center;justify-content:center;gap:14px;}" +
      "#globalIncoming.show{display:flex;}" +
      "#globalIncoming .t{font-size:22px;font-weight:700;}" +
      "#globalIncoming .s{font-size:14px;opacity:.9;text-align:center;padding:0 24px;}" +
      "#globalIncoming .btns{display:flex;gap:20px;margin-top:16px;}" +
      "#globalIncoming button{border:none;border-radius:50%;width:64px;height:64px;font-size:14px;font-weight:700;color:#fff;}" +
      "#globalIncoming .rej{background:#e53935;}" +
      "#globalIncoming .acc{background:#06C755;}" +
      "#globalCallBanner{display:none;position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));" +
      "z-index:99990;background:#1565c0;color:#fff;border-radius:12px;padding:10px 12px;" +
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2);}" +
      "#globalCallBanner.show{display:block;}" +
      "#globalCallBanner .ttl{font-size:14px;font-weight:800;}" +
      "#globalCallBanner .sub{font-size:12px;opacity:.92;margin-top:2px;}" +
      "#globalCallEnded{display:none;position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom,0px));" +
      "transform:translateX(-50%);z-index:99991;background:#111;color:#fff;border-radius:12px;" +
      "padding:10px 16px;font-size:14px;font-weight:700;white-space:nowrap;}" +
      "#globalCallEnded.show{display:block;}";
    document.head.appendChild(style);

    var box = document.createElement("div");
    box.id = "globalIncoming";
    box.innerHTML =
      '<div class="t">ä¾é»</div>' +
      '<div class="s" id="globalIncomingSub">éè©±éè«</div>' +
      '<div class="btns">' +
      '<button type="button" class="rej" id="globalRej">ææ¥</button>' +
      '<button type="button" class="acc" id="globalAcc">æ¥è½</button>' +
      "</div>";
    document.body.appendChild(box);

    var banner = document.createElement("div");
    banner.id = "globalCallBanner";
    banner.innerHTML =
      '<div class="ttl" id="globalCallBannerTitle">è¦è¨èå¤©ä¸­</div>' +
      '<div class="sub" id="globalCallBannerSub">é²è¡ä¸­</div>';
    banner.onclick = function () {
      if (activeId) location.href = "call.html?call=" + encodeURIComponent(activeId);
    };
    document.body.appendChild(banner);

    var ended = document.createElement("div");
    ended.id = "globalCallEnded";
    ended.textContent = "èå¤©çµæ";
    document.body.appendChild(ended);

    document.getElementById("globalRej").onclick = async function () {
      stopRing();
      box.classList.remove("show");
      if (shownId && sb) {
        await sb.from("call_sessions").update({
          status: "rejected",
          ended_at: new Date().toISOString()
        }).eq("id", shownId);
      }
      shownId = null;
    };
    document.getElementById("globalAcc").onclick = function () {
      stopRing();
      var id = shownId;
      shownId = null;
      box.classList.remove("show");
      if (id) location.href = "call.html?call=" + encodeURIComponent(id);
    };
  }

  function hideIncoming() {
    var box = document.getElementById("globalIncoming");
    if (box) box.classList.remove("show");
    shownId = null;
    stopRing();
  }

  function showIncoming(row) {
    if (onCallPage) return;
    if (!row || !row.id) return;
    if (isCaller(row)) return;
    if (shownId === row.id) return;
    ensureUI();
    shownId = row.id;
    document.getElementById("globalIncomingSub").textContent =
      modeText(row) + "ä¾é» Â· è«æ¥è½";
    document.getElementById("globalIncoming").classList.add("show");
    startRing(row.mode === "audio" ? "audio" : "video");
  }

  function showActive(row) {
    ensureUI();
    activeId = row && row.id ? row.id : activeId;
    hideIncoming();
    var banner = document.getElementById("globalCallBanner");
    var title = document.getElementById("globalCallBannerTitle");
    var sub = document.getElementById("globalCallBannerSub");
    if (title) title.textContent = modeText(row) + "èå¤©ä¸­";
    if (sub) sub.textContent = "é»éè£¡åå°éè©±";
    if (banner && !onCallPage) banner.classList.add("show");
  }

  function showEnded(row) {
    ensureUI();
    hideIncoming();
    activeId = null;
    var banner = document.getElementById("globalCallBanner");
    if (banner) banner.classList.remove("show");
    var ended = document.getElementById("globalCallEnded");
    if (!ended) return;
    ended.textContent = modeText(row) + "èå¤©çµæ";
    ended.classList.add("show");
    setTimeout(function () { ended.classList.remove("show"); }, 4000);
  }

  function handleRow(row) {
    if (!isMine(row)) return;
    var st = String(row.status || "");
    if (st === "ringing") showIncoming(row);
    else if (st === "active" || st === "accepted" || st === "in_call") showActive(row);
    else if (st === "ended" || st === "rejected" || st === "cancelled" || st === "missed") showEnded(row);
  }

  async function loadMyGroups() {
    myGroupIds = {};
    if (!sb || !me) return;
    try {
      var res = await sb.from("group_members").select("group_id").eq("user_id", me.id);
      (res.data || []).forEach(function (row) {
        if (row.group_id) myGroupIds[String(row.group_id)] = true;
      });
    } catch (e) {}
  }

  async function check() {
    if (!sb || !me) return;
    try {
      var q1 = await sb.from("call_sessions")
        .select("*")
        .eq("callee_id", me.id)
        .in("status", ["ringing", "active", "accepted", "in_call"])
        .order("created_at", { ascending: false })
        .limit(3);
      (q1.data || []).forEach(handleRow);

      var groupList = Object.keys(myGroupIds);
      if (groupList.length) {
        var q2 = await sb.from("call_sessions")
          .select("*")
          .in("room_id", groupList)
          .in("status", ["ringing", "active", "accepted", "in_call"])
          .order("created_at", { ascending: false })
          .limit(5);
        (q2.data || []).forEach(handleRow);
      }
    } catch (e) {}
  }

  async function boot() {
    if (!window.supabase) {
      setTimeout(boot, 300);
      return;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    var sess = await sb.auth.getSession();
    if (!sess.data.session) return;
    me = sess.data.session.user;
    await loadMyGroups();

    document.body.addEventListener("click", function () {
      try { ensureAudio(); } catch (e) {}
    }, { once: true });

    try {
      sb.channel("global-call-sessions-" + me.id)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "call_sessions"
        }, function (payload) {
          handleRow(payload.new || payload.old);
        })
        .subscribe();
    } catch (e) {}

    check();
    setInterval(check, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
