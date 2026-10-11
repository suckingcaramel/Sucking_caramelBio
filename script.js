'use strict';
const config = window.PROFILE_CONFIG;
const $ = id => document.getElementById(id);
const safeUrl = (value, fallback = '#') => {
  try {
    const url = new URL(value, document.baseURI);
    return ['https:', 'http:', 'file:'].includes(url.protocol) ? url.href : fallback;
  } catch { return fallback; }
};
$('author').textContent = config.author;
$('contact-name').textContent = config.author;
$('description').textContent = config.description;
document.title = config.author;
$('discord').href = safeUrl(config.discordUrl);
for (const link of config.links) {
  const anchor = document.createElement('a');
  anchor.className = 'social-link';
  anchor.href = safeUrl(link.url);
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.setAttribute('aria-label', link.name);
  const icon = document.createElement('img');
  icon.src = safeUrl(link.icon);
  icon.alt = '';
  icon.addEventListener('error', () => { icon.hidden = true; }, { once: true });
  const tooltip = document.createElement('span');
  tooltip.className = 'tooltip';
  tooltip.textContent = link.name;
  anchor.append(icon, tooltip);
  $('socials').append(anchor);
}
const videoBackground = config.background.type === 'video';
const background = $(videoBackground ? 'background-video' : 'background-image');
$('background-image').hidden = videoBackground;
background.hidden = false;
const mobileBackgroundQuery = matchMedia('(hover: none) and (pointer: coarse)');
const updateBackgroundSource = () => {
  const url = mobileBackgroundQuery.matches && config.background.mobileUrl
    ? config.background.mobileUrl
    : config.background.url;
  const source = safeUrl(url);
  if (background.src !== source) background.src = source;
};
updateBackgroundSource();
mobileBackgroundQuery.addEventListener('change', updateBackgroundSource);
if (videoBackground) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const updateMotion = () => { if (motion.matches) background.pause(); else background.play().catch(() => {}); };
  background.addEventListener('loadeddata', updateMotion);
  motion.addEventListener('change', updateMotion);
}

const profile = $('profile');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let bounds;
let frame;
const resetTilt = () => {
  cancelAnimationFrame(frame);
  profile.style.setProperty('--rx', '0deg');
  profile.style.setProperty('--ry', '0deg');
};
profile.addEventListener('pointerenter', () => { bounds = profile.getBoundingClientRect(); });
profile.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || motionQuery.matches) return;
  if (!bounds) bounds = profile.getBoundingClientRect();
  const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
  const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
  const tilt = Math.min(15, Math.max(0, Number(config.maxTilt) || 8));
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    profile.style.setProperty('--rx', `${-y * tilt}deg`);
    profile.style.setProperty('--ry', `${x * tilt}deg`);
  });
});
profile.addEventListener('pointerleave', resetTilt);
profile.addEventListener('pointercancel', resetTilt);
window.addEventListener('blur', resetTilt);
window.addEventListener('resize', () => { bounds = null; resetTilt(); });
motionQuery.addEventListener('change', resetTilt);

const audio = $('audio');
const seek = $('seek');
let tracks = [];
let trackIndex = 0;
let seeking = false;
let shuffleEnabled = false;
const failedTracks = new Set();
let trackLoadId = 0;
let playAttemptId = 0;
function nextTrackIndex(direction = 1) {
  if (!tracks.length) return -1;
  if (!shuffleEnabled) {
    for (let offset = 1; offset <= tracks.length; offset++) {
      const index = (trackIndex + direction * offset + tracks.length) % tracks.length;
      if (!failedTracks.has(index)) return index;
    }
    return -1;
  }
  const maxNumber = Math.max(1, Math.floor(Number(config.shuffleMaxTrackNumber) || Math.max(...tracks.map(track => track.id))));
  const candidates = tracks
    .map((track, index) => ({ id: track.id, index }))
    .filter(track => track.id <= maxNumber && track.index !== trackIndex && !failedTracks.has(track.index));
  return candidates.length
    ? candidates[Math.floor(Math.random() * candidates.length)].index
    : (!failedTracks.has(trackIndex) && tracks[trackIndex].id <= maxNumber ? trackIndex : -1);
}
const fallbackTrack = {
  url: './assets/music/The_perfect_pair_Beabadoobee.mp3',
  title: 'The perfect pair',
};
let playbackRequested = false;
audio.volume = Math.max(0, Math.min(1, Number(config.volume) || 0));
const volume = $('volume');
let lastVolume = audio.volume || 0.5;
const updateVolume = () => {
  const silent = audio.muted || audio.volume === 0;
  volume.value = silent ? 0 : audio.volume;
  volume.style.setProperty('--progress', `${Number(volume.value) * 100}%`);
  $('mute').setAttribute('aria-pressed', String(silent));
  $('mute').setAttribute('aria-label', silent ? 'Включить звук' : 'Выключить звук');
  if (!silent) lastVolume = audio.volume;
};
audio.addEventListener('volumechange', updateVolume);
volume.addEventListener('input', () => {
  audio.volume = Number(volume.value);
  audio.muted = audio.volume === 0;
  updateVolume();
});
updateVolume();
const formatTime = seconds => {
  if (!Number.isFinite(seconds)) return '00:00';
  const value = Math.floor(Math.max(0, seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
const status = text => { $('audio-status').textContent = text; $('audio-status').hidden = !text; };
const updatePlay = () => {
  const paused = audio.paused;
  $('play').setAttribute('aria-label', paused ? 'Воспроизвести' : 'Приостановить');
  $('play-symbol').innerHTML = paused ? '<path d="m9 5 11 7-11 7Z"/>' : '<path d="M7 5h4v14H7zm7 0h4v14h-4Z"/>';
};
const updateProgress = () => {
  const valid = Number.isFinite(audio.duration) && audio.duration > 0;
  seek.disabled = !valid;
  $('duration').textContent = formatTime(audio.duration);
  $('elapsed').textContent = formatTime(audio.currentTime);
  if (!seeking) seek.value = valid ? audio.currentTime / audio.duration * 100 : 0;
  seek.style.setProperty('--progress', `${seek.value}%`);
  seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} из ${formatTime(audio.duration)}`);
};
async function playAudio() {
  const loadId = trackLoadId;
  const attemptId = ++playAttemptId;
  const index = trackIndex;
  playbackRequested = true;
  status('');
  try { await audio.play(); }
  catch (error) {
    if (loadId !== trackLoadId || attemptId !== playAttemptId || error.name === 'AbortError') return;
    if (error.name === 'NotAllowedError') {
      playbackRequested = false;
      status('Нажмите кнопку воспроизведения, чтобы включить музыку.');
    } else if (error.name === 'NotSupportedError' || (audio.error && audio.error.code !== 1)) {
      skipFailedTrack(index, loadId);
    } else {
      playbackRequested = false;
      status('Не удалось воспроизвести музыку. Попробуйте ещё раз.');
    }
  }
}
function stopUnavailablePlayback() {
  trackLoadId++;
  playAttemptId++;
  playbackRequested = false;
  seeking = false;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  $('play').disabled = true;
  updatePlay();
  updateProgress();
  status('Нет доступных треков. Обновите страницу, чтобы попробовать снова.');
}
function skipFailedTrack(index = trackIndex, loadId = trackLoadId) {
  if (loadId !== trackLoadId || failedTracks.has(index)) return;
  failedTracks.add(index);
  const autoplay = playbackRequested;
  loadTrack(nextTrackIndex(), autoplay);
}
function loadTrack(index, autoplay = false) {
  if (!tracks.length) { $('play').disabled = true; status('Трек не указан.'); return; }
  if (index < 0) { stopUnavailablePlayback(); return; }
  trackLoadId++;
  playAttemptId++;
  trackIndex = (index + tracks.length) % tracks.length;
  $('play').disabled = false;
  seeking = false;
  playbackRequested = autoplay;
  audio.pause();
  audio.src = safeUrl(tracks[trackIndex].url);
  const track = tracks[trackIndex];
  let titleFromUrl = '';

  try {
    const url = new URL(track.url, document.baseURI);
    const filename = url.pathname.split('/').pop() || '';

    titleFromUrl = decodeURIComponent(filename)
      .replace(/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i, '')
      .replace(/_/g, ' ')
      .trim();
  } catch {
  }

  $('track-title').textContent =
    track.title?.trim() || titleFromUrl || 'Без названия';
  status('');
  seek.value = 0;
  audio.load();
  updateProgress();
  if (autoplay) playAudio();
}
$('play').addEventListener('click', () => {
  if (audio.paused) playAudio();
  else { playbackRequested = false; playAttemptId++; audio.pause(); }
});
$('mute').addEventListener('click', () => {
  if (audio.muted || audio.volume === 0) {
    audio.volume = lastVolume;
    audio.muted = false;
  } else {
    lastVolume = audio.volume;
    audio.muted = true;
    audio.volume = 0;
  }
  updateVolume();
});
$('previous').addEventListener('click', () => {
  if (!shuffleEnabled && !failedTracks.has(trackIndex) && (audio.currentTime > 3 || tracks.length === 1)) { audio.currentTime = 0; updateProgress(); }
  else loadTrack(nextTrackIndex(-1), playbackRequested || !audio.paused);
});
$('next').addEventListener('click', () => loadTrack(nextTrackIndex(), playbackRequested || !audio.paused));
$('shuffle').addEventListener('click', () => {
  shuffleEnabled = !shuffleEnabled;
  $('shuffle').setAttribute('aria-pressed', String(shuffleEnabled));
  $('shuffle').setAttribute('aria-label', shuffleEnabled ? 'Выключить перемешивание' : 'Включить перемешивание');
});
seek.addEventListener('input', () => {
  seeking = true;
  seek.style.setProperty('--progress', `${seek.value}%`);
  $('elapsed').textContent = formatTime(Number(seek.value) / 100 * audio.duration);
});
seek.addEventListener('change', () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 100 * audio.duration;
  seeking = false;
  updateProgress();
});
seek.addEventListener('blur', () => { seeking = false; updateProgress(); });
for (const event of ['timeupdate', 'durationchange', 'loadedmetadata', 'emptied']) audio.addEventListener(event, updateProgress);
for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, updatePlay);
audio.addEventListener('playing', () => status(''));
audio.addEventListener('error', () => {
  if (!audio.error || audio.error.code === 1 || !tracks.length) return;
  skipFailedTrack();
});
audio.addEventListener('ended', () => loadTrack(nextTrackIndex(), true));
function parseTracks(text) {
  const numbers = new Set();
  const parsed = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const fields = line.split('|').map(field => field.trim());
    const [number, url, title] = fields;
    const id = Number(number);
    if (fields.length !== 3 || !/^\d+$/.test(number) || !Number.isSafeInteger(id) || id < 1 || numbers.has(id) || !url || !title || !safeUrl(url, '')) {
      throw new Error(`Ошибка в строке ${index + 1} файла с песнями.`);
    }
    numbers.add(id);
    parsed.push({ id, url, title });
  }
  if (!parsed.length) throw new Error('Файл с песнями пуст.');
  return parsed.sort((a, b) => a.id - b.id);
}

async function loadTracks() {
  failedTracks.clear();
  const buttons = [$('play'), $('previous'), $('next'), $('shuffle')];
  buttons.forEach(button => { button.disabled = true; });
  $('track-title').textContent = 'Загрузка музыки…';
  status('');
  try {
    const response = await fetch(safeUrl(config.tracksFile), { cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось загрузить файл с песнями.');
    tracks = parseTracks(await response.text());
    loadTrack(0);
    buttons.forEach(button => { button.disabled = false; });
  } catch {
    tracks = [{ ...fallbackTrack, id: 1 }];
    loadTrack(0);
    buttons.forEach(button => { button.disabled = false; });
  }
}

loadTracks();
