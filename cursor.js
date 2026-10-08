'use strict';

(async () => {
  const path = window.PROFILE_CONFIG?.cursor;
  if (!path || !matchMedia('(any-pointer: fine)').matches) return;
  const urls = [];
  try {
    const response = await fetch(path);
    if (!response.ok) return;
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    const tag = offset => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    if (buffer.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'ACON') {
      throw new Error('Expected a RIFF/ACON ANI file');
    }
    const frames = [];
    let defaultRate = 6;
    let rates = [];
    let sequence = [];
    let steps = 0;
    let flags = 1;
    const integers = (start, size) => {
      if (size % 4) throw new Error('Invalid ANI array');
      return Array.from({ length: size / 4 }, (_, i) => view.getUint32(start + i * 4, true));
    };
    const scan = (start, end) => {
      for (let offset = start; offset + 8 <= end;) {
        const id = tag(offset);
        const size = view.getUint32(offset + 4, true);
        const data = offset + 8;
        if (data + size > end) throw new Error('Truncated ANI chunk');
        if (id === 'LIST' && size >= 4 && tag(data) === 'fram') scan(data + 4, data + size);
        else if (id === 'anih' && size >= 36) {
          steps = view.getUint32(data + 8, true);
          defaultRate = view.getUint32(data + 28, true) || 6;
          flags = view.getUint32(data + 32, true);
        } else if (id === 'rate') rates = integers(data, size);
        else if (id === 'seq ') sequence = integers(data, size);
        else if (id === 'icon') frames.push(buffer.slice(data, data + size));
        offset = data + size + (size % 2);
      }
    };
    const end = view.getUint32(4, true) + 8;
    if (end > buffer.byteLength) throw new Error('Truncated ANI file');
    scan(12, end);
    if (!(flags & 1) || !frames.length) throw new Error('ANI must contain CUR/ICO frames');
    for (const frame of frames) {
      const header = new DataView(frame);
      if (frame.byteLength < 6) throw new Error('Invalid cursor frame');
      const type = header.getUint16(2, true);
      const count = header.getUint16(4, true);
      if (header.getUint16(0, true) !== 0 || ![1, 2].includes(type) || !count || 6 + count * 16 > frame.byteLength) {
        throw new Error('Invalid CUR/ICO header');
      }
      if (type === 1) {
        header.setUint16(2, 2, true);
        for (let i = 0; i < count; i++) {
          header.setUint16(6 + i * 16 + 4, 0, true);
          header.setUint16(6 + i * 16 + 6, 0, true);
        }
      }
      urls.push(URL.createObjectURL(new Blob([frame], { type: 'image/x-icon' })));
    }
    const order = flags & 2 ? sequence : Array.from({ length: steps || urls.length }, (_, i) => i % urls.length);
    if (!order.length || order.some(i => i >= urls.length)) throw new Error('Invalid ANI sequence');
    const style = document.createElement('style');
    document.head.append(style);
    let step = 0;
    let timer;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const render = () => {
      clearTimeout(timer);
      style.textContent = `@media (any-pointer: fine) { html, body, body * { cursor: url("${urls[order[step]]}"), auto !important; } }`;
      if (!document.hidden && !reducedMotion.matches && order.length > 1) {
        const delay = Math.max(16, (rates[step] || defaultRate) * 1000 / 60);
        timer = setTimeout(() => { step = (step + 1) % order.length; render(); }, delay);
      }
    };
    document.addEventListener('visibilitychange', render);
    reducedMotion.addEventListener('change', render);
    render();
  } catch (error) {
    urls.forEach(url => URL.revokeObjectURL(url));
    console.warn('Не удалось загрузить пользовательский курсор:', error);
  }
})();
