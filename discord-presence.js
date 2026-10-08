'use strict';

(() => {
  const userId = String(
    window.PROFILE_CONFIG.discordAvatar?.userId || ''
  ).trim();

  const dot = document.getElementById('discord-status-dot');
  const tooltip = document.getElementById('discord-game-tooltip');
  const wrapper = document.querySelector('.avatar-wrapper');

  if (!dot || !tooltip || !wrapper) return;

  function updatePresence(user = null) {
  const isOnline = user?.discord_status === 'online';
  const statusText = isOnline ? 'В сети' : 'Не в сети';

  dot.classList.toggle('is-online', isOnline);
  dot.setAttribute('aria-label', statusText);

  tooltip.textContent = statusText;
  tooltip.hidden = false;
  wrapper.setAttribute('aria-describedby', tooltip.id);

  const game = user && user.discord_status !== 'offline'
    ? user.activities?.find(activity =>
        activity.type === 0 &&
        typeof activity.name === 'string' &&
        activity.name.trim()
      )
    : null;

  if (contactName) {
    contactName.textContent = game
      ? `Играет в ${game.name}`
      : defaultName;
  }
}

  const contactName = document.getElementById('contact-name');
  const defaultName = window.PROFILE_CONFIG.author || 'Автор';

  updatePresence();

  if (!/^\d{17,20}$/.test(userId)) return;

  let loading = false;

  async function refreshPresence() {
    if (loading || document.hidden) return;

    loading = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        `https://api.lanyard.rest/v1/users/${userId}`,
        {
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
        }
      );

      if (!response.ok) throw new Error('Lanyard недоступен');

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Пользователь не найден');
      }

      updatePresence(result.data);
    } catch {
      updatePresence();
      dot.setAttribute('aria-label', 'Статус недоступен');
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  }

  refreshPresence();

  setInterval(refreshPresence, 15000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshPresence();
  });
})();