(function () {
  if (window.__callNotifyLoaded) return;
  window.__callNotifyLoaded = true;

  var SUPABASE_URL = 'https://perfsipperncvjocznhl.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcmZzaXBwZXJuY3Zqb2N6bmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTUyMzAsImV4cCI6MjEwMTU5MTIzMH0.I7vXkV247kAzRJ0RigDZt3Hzn8KJDyMc6o9E3oHJZoY';

  // 已在通話頁就不要重複彈
  if (/call\.html/i.test(location.pathname)) return;

  var sb = null;
  var me = null;
  var shownId = null;
  var ringTimer = null;
  var audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function beep(freq, dur) {
    try {
      var ctx = ensureAudio();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.12;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (dur || 0.2));
    } catch (e) {}
  }
  function startRing(kind) {
    stopRing();
    if (navigator.vibrate) {
      try { navigator.vibrate([300, 200, 300, 200]); } catch (e) {}
    }
    // 語音：較低雙音；視訊：較高三連音
    ringTimer = setInterval(function () {
      if (kind === 'audio') {
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

  function ensureUI() {
    if (document.getElementById('globalIncoming')) return;
    var style = document.createElement('style');
    style.textContent =
      '#globalIncoming{display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);' +
      'color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:14px;}' +
      '#globalIncoming.show{display:flex;}' +
      '#globalIncoming .t{font-size:22px;font-weight:700;}' +
      '#globalIncoming .s{font-size:14px;opacity:.9;}' +
      '#globalIncoming .btns{display:flex;gap:20px;margin-top:16px;}' +
      '#globalIncoming button{border:none;border-radius:50%;width:64px;height:64px;font-size:14px;font-weight:700;color:#fff;}' +
      '#globalIncoming .rej{background:#e53935;}' +
      '#globalIncoming .acc{background:#06C755;}';
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.id = 'globalIncoming';
    box.innerHTML =
      '<div class="t">來電</div>' +
      '<div class="s" id="globalIncomingSub">通話邀請</div>' +
      '<div class="btns">' +
      '<button type="button" class="rej" id="globalRej">拒接</button>' +
      '<button type="button" class="acc" id="globalAcc">接聽</button>' +
      '</div>';
    document.body.appendChild(box);

    document.getElementById('globalRej').onclick = async function () {
      stopRing();
      box.classList.remove('show');
      if (shownId && sb) {
        await sb.from('call_sessions').update({ status: 'rejected' }).eq('id', shownId);
      }
      shownId = null;
    };
    document.getElementById('globalAcc').onclick = function () {
      stopRing();
      var id = shownId;
      shownId = null;
      box.classList.remove('show');
      if (id) location.href = 'call.html?call=' + encodeURIComponent(id);
    };
  }

  function showIncoming(row) {
    if (!row || !row.id) return;
    if (shownId === row.id) return;
    ensureUI();
    shownId = row.id;
    var isAudio = row.mode === 'audio';
    var mode = isAudio ? '語音' : '視訊';
    document.getElementById('globalIncomingSub').textContent = mode + '通話邀請';
    document.getElementById('globalIncoming').classList.add('show');
    startRing(isAudio ? 'audio' : 'video');
  }

  async function check() {
    if (!sb || !me) return;
    try {
      var res = await sb.from('call_sessions')
        .select('*')
        .eq('callee_id', me.id)
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })
        .limit(1);
      if (res.data && res.data[0]) showIncoming(res.data[0]);
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

    document.body.addEventListener('click', function () {
      try { ensureAudio(); } catch (e) {}
    }, { once: true });

    try {
      sb.channel('global-incoming-' + me.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: 'callee_id=eq.' + me.id
        }, function (payload) {
          if (payload.new && payload.new.status === 'ringing') showIncoming(payload.new);
        })
        .subscribe();
    } catch (e) {}

    check();
    setInterval(check, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
