// Sound for the game.
//
// Effects are made on the spot with WebAudio (short tones and bursts of noise), so they need no
// files and are always there. Music and voices are real recordings: name them in
// assets/audio/tracks.json and they play. Until a file is named there, that part stays silent.
//
// Browsers only allow sound after the player has touched the page, so nothing starts until
// start() is called from the START button.

const TRACKS = 'assets/audio/tracks.json', FOLDER = 'assets/audio/';

export function makeAudio() {
  const A = window.AudioContext || window.webkitAudioContext;
  let ctx = null, out = null, air = null, tap = null, noise = null, on = false, birds = 0, indoors = false;
  let muted = false, tracks = { music: null, musicVolume: 0.5, voices: {} }, song = null, wantSong = false;
  const voices = {}, played = [];
  try { muted = localStorage.getItem('toneda-sound') === 'off'; } catch (e) { /* private browsing: start with sound on */ }

  // the list of recordings, fetched while the title screen is up
  const ready = fetch(TRACKS).then(r => (r.ok ? r.json() : null)).then(t => {
    if (!t) return;
    tracks = { ...tracks, ...t, voices: t.voices || {} };
    if (tracks.music) {
      song = new Audio(FOLDER + tracks.music);
      song.loop = true; song.preload = 'auto'; song.volume = tracks.musicVolume; song.muted = muted;
      if (wantSong) playSong();
    }
  }).catch(() => {});
  function playSong() {
    wantSong = true;
    if (!song) return;
    const p = song.play();
    // refused because the tap that started the game is too long ago: try again on the next one
    if (p) p.catch(() => addEventListener('pointerdown', () => { if (wantSong && song.paused) song.play().catch(() => {}); }, { once: true }));
  }

  // ---------- building blocks ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  function env(t, dur, vol, attack = 0.004) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  }
  // a note that can slide from one pitch to another
  function tone(type, f0, f1, at, dur, vol, attack) {
    const t = ctx.currentTime + at, o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(env(t, dur, vol, attack));
    o.start(t); o.stop(t + dur + 0.02);
  }
  // a burst of noise through a filter whose pitch can sweep
  function hiss(kind, f0, f1, at, dur, vol, q = 0.8, attack) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    s.buffer = noise; s.loop = true;
    f.type = kind; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f); f.connect(env(t, dur, vol, attack));
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  const notes = (type, list, gap, dur, vol, at = 0) => list.forEach((f, i) => tone(type, f, f, at + i * gap, dur, vol));

  // ---------- the effects ----------
  const FX = {
    // footsteps on grass, on boards, in the pond
    step() { hiss('lowpass', rnd(700, 1000), 380, 0, 0.08, 0.75); },
    stepWood() { tone('sine', rnd(125, 150), 62, 0, 0.08, 0.17); hiss('bandpass', 1900, 1200, 0, 0.025, 0.12, 1.2); },
    stepWater() { hiss('bandpass', 900, rnd(2200, 3000), 0, 0.17, 0.5, 1.4, 0.02); },
    jump() { tone('triangle', 250, 520, 0, 0.13, 0.13); hiss('bandpass', 500, 1700, 0, 0.12, 0.25); },
    land() { tone('sine', 120, 48, 0, 0.12, 0.34); hiss('lowpass', 700, 300, 0, 0.09, 0.14); },
    roll() { hiss('bandpass', 380, 1500, 0, 0.2, 0.5, 1); hiss('bandpass', 1500, 450, 0.18, 0.22, 0.42, 1); },
    rung() { tone('triangle', rnd(470, 540), 300, 0, 0.045, 0.12); hiss('bandpass', 2400, 1500, 0, 0.02, 0.05, 2); },
    // fists and feet
    swing() { hiss('bandpass', rnd(800, 1000), 2600, 0, 0.12, 0.62, 1.6, 0.03); },
    hit() { tone('square', 190, 70, 0, 0.09, 0.2); hiss('lowpass', 1800, 500, 0, 0.07, 0.3); },
    // the Switch
    shot() {
      hiss('lowpass', 6500, 600, 0, 0.19, 0.55, 0.6, 0.002);
      tone('sawtooth', 230, 46, 0, 0.1, 0.3, 0.002);
      hiss('highpass', 4000, 4000, 0, 0.03, 0.2, 0.7, 0.001);
    },
    ricochet() { tone('sine', rnd(1700, 2300), 900, 0.02, 0.15, 0.11); },
    empty() { notes('square', [150, 150], 0.09, 0.05, 0.14); },
    oppDown() { tone('sawtooth', 420, 55, 0, 0.36, 0.2); hiss('lowpass', 2400, 300, 0.05, 0.32, 0.22); },
    // the flower pot and its ring
    lift() { tone('triangle', 290, 470, 0, 0.1, 0.14); },
    toss() { hiss('bandpass', 600, 1600, 0, 0.16, 0.5, 1.4, 0.04); },
    smash() {
      hiss('highpass', 2200, 1400, 0, 0.24, 0.38, 0.7, 0.002);
      tone('sine', 180, 80, 0, 0.07, 0.2);
      for (let i = 0; i < 5; i++) tone('sine', rnd(1900, 4400), rnd(1500, 3000), 0.03 + i * rnd(0.03, 0.05), 0.07, 0.07);
    },
    ring() { tone('sine', 1319, 1319, 0, 0.09, 0.2); tone('triangle', 1976, 1976, 0.08, 0.45, 0.2); tone('sine', 3951, 3951, 0.08, 0.3, 0.05); },
    // chests
    chest() { tone('sawtooth', 82, 150, 0, 0.42, 0.11, 0.05); hiss('bandpass', 500, 1100, 0, 0.4, 0.09, 3, 0.05); tone('sine', 110, 60, 0.42, 0.12, 0.3); },
    item() {                                         // a rising run that lands on a held chord
      notes('triangle', [392, 494, 587, 784], 0.11, 0.16, 0.17, 0.55);
      for (const f of [784, 988, 1175]) tone('triangle', f, f, 1.0, 0.9, 0.12, 0.01);
      tone('sine', 196, 196, 1.0, 0.9, 0.16, 0.01);
    },
    // talking
    blipNiggy() { tone('square', rnd(690, 880), 600, 0, 0.035, 0.085); },
    blipTree() { tone('triangle', rnd(150, 190), 130, 0, 0.055, 0.12); },
    blipItem() { tone('sine', rnd(1150, 1300), 1100, 0, 0.03, 0.09); },
    next() { tone('sine', 660, 990, 0, 0.07, 0.09); },
    listen() { notes('triangle', [1175, 1568], 0.07, 0.12, 0.16); tone('sine', 2349, 2349, 0.14, 0.3, 0.1); },
    // everything else
    transform() {
      tone('sawtooth', 110, 880, 0, 0.55, 0.11, 0.05);
      hiss('bandpass', 400, 5000, 0, 0.6, 0.12, 2, 0.1);
      notes('sine', [523, 659, 784, 1047, 1319, 1568], 0.07, 0.3, 0.09, 0.3);
    },
    quest() { notes('triangle', [523, 784], 0.13, 0.32, 0.15); tone('sine', 1047, 1047, 0.26, 0.5, 0.08); },
    start() { notes('triangle', [262, 330, 392, 523], 0.07, 0.9, 0.13); },
    win() { notes('triangle', [523, 659, 784, 1047], 0.12, 0.2, 0.16); for (const f of [523, 784, 1047]) tone('triangle', f, f, 0.5, 1.1, 0.11, 0.01); },
  };

  // ---------- the forest in the background: a little wind, a bird now and then ----------
  function forest() {
    air = ctx.createGain();
    air.gain.value = 0.07;
    air.connect(out);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), sway = ctx.createOscillator(), depth = ctx.createGain();
    s.buffer = noise; s.loop = true;
    f.type = 'lowpass'; f.frequency.value = 420;
    sway.frequency.value = 0.11; depth.gain.value = 170;           // the wind rises and falls
    sway.connect(depth); depth.connect(f.frequency);
    s.connect(f); f.connect(air);
    s.start(); sway.start();
  }
  function bird() {
    const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), base = rnd(2300, 3300), g = ctx.createGain();
    g.gain.value = indoors ? 0.25 : 1;
    let dest = g;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.8, 0.8); g.connect(pan); dest = pan; }
    dest.connect(out);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), e = ctx.createGain(), at = t + i * rnd(0.09, 0.14);
      o.frequency.setValueAtTime(base * rnd(0.9, 1.1), at);
      o.frequency.exponentialRampToValueAtTime(base * rnd(1.15, 1.4), at + 0.05);
      e.gain.setValueAtTime(0.0001, at);
      e.gain.exponentialRampToValueAtTime(0.03, at + 0.012);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
      o.connect(e); e.connect(g);
      o.start(at); o.stop(at + 0.1);
    }
  }

  const api = {
    get muted() { return muted; },
    get running() { return !!ctx && ctx.state === 'running'; },
    get song() { return song; },
    played,                                          // the last few sounds asked for (the tests read this)
    ready,

    // Call from the START button: sound is only allowed once the player has touched the page.
    start() {
      if (on) return;
      on = true;
      playSong();
      if (!A) return;
      try {
        ctx = new A();
        const limit = ctx.createDynamicsCompressor();              // keeps a pile-up of sounds from crackling
        limit.threshold.value = -10; limit.ratio.value = 12; limit.attack.value = 0.002; limit.release.value = 0.12;
        out = ctx.createGain();
        out.gain.value = muted ? 0 : 0.9;
        tap = ctx.createAnalyser(); tap.fftSize = 2048;
        out.connect(limit); limit.connect(tap); tap.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        forest();
        birds = ctx.currentTime + 2.5;
        if (ctx.state !== 'running') ctx.resume();
        api.play('start');
      } catch (e) { ctx = null; }
    },

    // Play an effect by name. Unknown names and calls before start() do nothing.
    play(name) {
      played.push(name);
      if (played.length > 300) played.shift();
      if (!ctx || muted || !FX[name]) return;
      try { FX[name](); } catch (e) { /* a sound must never stop the game */ }
    },

    // Play a recorded voice line if one has been named for this cue. Says whether it did.
    voice(name) {
      const file = tracks.voices[name];
      if (!on || !file) return false;
      played.push('voice:' + name);
      const clip = voices[name] || (voices[name] = new Audio(FOLDER + file));
      clip.muted = muted; clip.currentTime = 0;
      const p = clip.play();
      if (p) p.catch(() => {});
      return true;
    },

    // once a frame: the birds, and how much of the forest is heard from inside a room
    update(inside) {
      if (!ctx) return;
      if (inside !== indoors) { indoors = inside; air.gain.setTargetAtTime(inside ? 0.025 : 0.07, ctx.currentTime, 0.4); }
      if (ctx.currentTime > birds) { birds = ctx.currentTime + rnd(3, 8); if (!muted) bird(); }
    },

    setMuted(m) {
      muted = m;
      try { localStorage.setItem('toneda-sound', m ? 'off' : 'on'); } catch (e) { /* not saved, still works */ }
      if (out) out.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
      if (song) song.muted = m;
      for (const v of Object.values(voices)) v.muted = m;
    },

    // Play one effect on its own into a recording, faster than real time, and say how loud and
    // how long it came out. Nothing is heard. (The tests use this to check every effect.)
    async render(name, seconds = 2.5) {
      const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext, live = [ctx, out, noise], rate = 44100;
      const off = new Off(1, rate * seconds, rate);
      ctx = off; out = off.createGain(); out.connect(off.destination);
      noise = off.createBuffer(1, rate * 2, rate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      try { FX[name](); } finally { [ctx, out, noise] = live; }
      const data = (await off.startRendering()).getChannelData(0);
      let peak = 0, sum = 0, last = 0;
      for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); peak = Math.max(peak, v); sum += v * v; if (v > 0.003) last = i; }
      return { peak, rms: Math.sqrt(sum / Math.max(1, last)), seconds: last / rate };
    },

    // how loud the effects are right now, 0 to 1 (the tests read this)
    level() {
      if (!tap) return 0;
      const d = new Float32Array(tap.fftSize);
      tap.getFloatTimeDomainData(d);
      let peak = 0;
      for (const v of d) peak = Math.max(peak, Math.abs(v));
      return peak;
    },
  };

  // going to another tab or locking the phone stops the music; coming back starts it again
  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) { if (song) song.pause(); if (ctx) ctx.suspend(); }
    else { if (song && wantSong) song.play().catch(() => {}); if (ctx) ctx.resume(); }
  });
  return api;
}
