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
background.src = safeUrl(config.background.url);
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
const tracks = config.tracks || [];
let trackIndex = 0;
let seeking = false;
audio.volume = Math.max(0, Math.min(1, Number(config.volume) || 0));
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
  status('');
  try { await audio.play(); }
  catch { status('Не удалось воспроизвести музыку. Проверьте URL трека.'); }
}
function loadTrack(index, autoplay = false) {
  if (!tracks.length) { $('play').disabled = true; status('Трек не указан.'); return; }
  trackIndex = (index + tracks.length) % tracks.length;
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
$('play').addEventListener('click', () => { if (audio.paused) playAudio(); else audio.pause(); });
$('mute').addEventListener('click', () => {
  audio.muted = !audio.muted;
  $('mute').setAttribute('aria-pressed', String(audio.muted));
  $('mute').setAttribute('aria-label', audio.muted ? 'Включить звук' : 'Выключить звук');
});
$('previous').addEventListener('click', () => {
  if (audio.currentTime > 3 || tracks.length === 1) { audio.currentTime = 0; updateProgress(); }
  else loadTrack(trackIndex - 1, !audio.paused);
});
$('next').addEventListener('click', () => loadTrack(trackIndex + 1, !audio.paused));
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
audio.addEventListener('error', () => status('Музыка недоступна. Проверьте URL трека.'));
audio.addEventListener('ended', () => { if (tracks.length > 1) loadTrack(trackIndex + 1, true); });
loadTrack(0);
