'use strict';
(() => {
  const config = window.PROFILE_CONFIG;
  const avatar = document.getElementById('avatar');
  const settings = config.discordAvatar || {};
  const userId = String(settings.userId || '').trim();
  const format = settings.format === 'gif' ? 'gif' : 'png';
  const placeholder = new URL('./assets/icons/avatar.png', document.baseURI).href;
  let fallback = placeholder;
  try {
    const url = new URL(config.avatar, document.baseURI);
    if (['https:', 'http:', 'file:'].includes(url.protocol)) fallback = url.href;
  } catch {  }
  avatar.addEventListener('error', () => {
    if (avatar.src !== placeholder) avatar.src = placeholder;
  });
  avatar.src = fallback;
  if (!/^\d{17,20}$/.test(userId)) return;

  let loading = false;
  function refreshAvatar() {
    if (loading || document.hidden) return;
    loading = true;
    const image = new Image();
    const url = `https://api.lanyard.rest/${userId}.${format}?refresh=${Math.floor(Date.now() / 300000)}`;
    const timeout = setTimeout(() => finish(false), 8000);
    function finish(success) {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      loading = false;
      avatar.src = success ? url : fallback;
    }
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  }
  refreshAvatar();
  setInterval(refreshAvatar, 300000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAvatar();
  });
})();
