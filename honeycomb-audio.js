/**
 * HoneyComb – 사운드 (BGM, 매치/폭발/레벨업 SFX)
 */
(function (G) {
  'use strict';

  G.preloadMatchComboAudio = function () {
    if (!G.matchAudio) { G.matchAudio = new Audio('match.mp3'); G.matchAudio.volume = 0.7; G.matchAudio.load(); }
    if (!G.comboAudio) { G.comboAudio = new Audio('combo.mp3'); G.comboAudio.volume = 0.7; G.comboAudio.load(); }
    if (!G.levelupAudio) { G.levelupAudio = new Audio('levelup.mp3'); G.levelupAudio.volume = 0.7; G.levelupAudio.load(); }
    if (!G.bombAudio) { G.bombAudio = new Audio('bomb.mp3'); G.bombAudio.volume = 0.7; G.bombAudio.load(); }
    if (!G.itemAudio) { G.itemAudio = new Audio('Missile.mp3'); G.itemAudio.volume = 0.7; G.itemAudio.load(); }
  };
  G.initAudio = function () {
    try {
      if (!G.audioCtx) G.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (G.audioCtx.state === 'suspended') {
        if (!G.audioResumePromise) G.audioResumePromise = G.audioCtx.resume();
        G.audioResumePromise.then(function () { G.audioReady = true; }).catch(function () {});
        return;
      }
      if (!G.audioReady && G.audioCtx.state === 'running') G.audioReady = true;
    } catch (e) {}
  };
  G.startBGM = function () {};
  G.stopBGM = function () {
    if (G.bgmInterval) { clearInterval(G.bgmInterval); G.bgmInterval = null; }
  };
  G.playExplosion = function () {
    if (!G.audioCtx || !G.audioReady) return;
    try {
      var bufferSize = G.audioCtx.sampleRate * 0.2;
      var buffer = G.audioCtx.createBuffer(1, bufferSize, G.audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      var src = G.audioCtx.createBufferSource();
      src.buffer = buffer;
      var g = G.audioCtx.createGain();
      g.gain.setValueAtTime(0.25, G.audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, G.audioCtx.currentTime + 0.2);
      src.connect(g);
      g.connect(G.audioCtx.destination);
      src.start(G.audioCtx.currentTime);
    } catch (e) {}
  };
  G.playLevelUp = function () {
    try {
      G.preloadMatchComboAudio();
      var a = new Audio('levelup.mp3');
      a.volume = 0.7;
      a.play().catch(function () {});
    } catch (e) {}
  };
  G.playMatchMp3 = function () {
    try {
      G.preloadMatchComboAudio();
      var a = new Audio('match.mp3');
      a.volume = 0.7;
      a.play().catch(function () {});
    } catch (e) {}
  };
  G.playComboMp3 = function () {
    try {
      G.preloadMatchComboAudio();
      var a = new Audio('combo.mp3');
      a.volume = 0.7;
      a.play().catch(function () {});
    } catch (e) {}
  };
  G.playBombMp3 = function () {
    try {
      G.preloadMatchComboAudio();
      var a = new Audio('bomb.mp3');
      a.volume = 0.7;
      a.play().catch(function () {});
    } catch (e) {}
  };
  G.playItemMp3 = function () {
    try {
      G.preloadMatchComboAudio();
      var a = new Audio('Missile.mp3');
      a.volume = 0.7;
      a.play().catch(function () {});
    } catch (e) {}
  };
})(window.HoneyComb = window.HoneyComb || {});
