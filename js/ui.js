/* UI stays separate from simulation, so adding a creature does not affect controls. */
(() => {
  'use strict';
  const world = window.CyberAquarium.world;
  const $ = id => document.getElementById(id);
  const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
  const dialog = $('help-dialog');
  let toastTimer, hintTimer, settingsTimer;

  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('is-visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('is-visible'), 2600);
  }
  function sync() {
    document.documentElement.dataset.theme = world.theme;
    for (const button of themeButtons) {
      const active = button.dataset.themeChoice === world.theme;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active);
    }
    $('scene-number').textContent = world.theme === 'day' ? '01' : '02';
    $('scene-name').textContent = world.theme === 'day' ? 'THE SUNLIT SHALLOWS' : 'THE NEON DEPTHS';
    $('pause-label').textContent = world.paused ? '继续' : '暂停';
    $('pause-icon').setAttribute('href', world.paused ? '#i-play' : '#i-pause');
    $('pause-button').setAttribute('aria-label', world.paused ? '恢复动画' : '暂停动画');
    $('pause-button').setAttribute('aria-pressed', world.paused);
    $('paused-badge').hidden = !world.paused;
    $('fish-count').value = world.count;
    $('fish-count').setAttribute('aria-valuetext', `${world.count} 条小鱼`);
    $('fish-count-output').textContent = world.count;
    $('fish-count').style.background = `linear-gradient(to right, #a3d1cb ${(world.count - 10) * 5}%, #435864 ${(world.count - 10) * 5}%)`;
    $('ecosystem-count').textContent = `${world.count} 尾小鱼`;
    $('ecosystem-state').textContent = world.paused ? '时光暂停中' : '自在游弋中';
    document.querySelector('meta[name="theme-color"]').content = world.theme === 'day' ? '#126c83' : '#061d31';
  }
  for (const button of themeButtons) button.addEventListener('click', () => world.setTheme(button.dataset.themeChoice));
  $('pause-button').addEventListener('click', () => world.setPaused(!world.paused));
  $('feed-button').addEventListener('click', () => world.feed(world.width * (.5 + Math.random() * .23), world.height * (.3 + Math.random() * .18)));
  $('fish-count').addEventListener('input', event => {
    // Immediate visual feedback, while persistence is cheap at this scale.
    world.setCount(event.target.value);
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => { $('ecosystem-count').setAttribute('aria-label', `${world.count} 尾小鱼`); }, 150);
  });
  $('help-button').addEventListener('click', () => dialog.showModal());
  const closeHelp = () => dialog.close();
  $('close-help').addEventListener('click', closeHelp);
  $('start-exploring').addEventListener('click', closeHelp);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeHelp();
  });
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('此浏览器可用 Control + ⌘ + F 进入全屏');
    } catch { toast('可使用浏览器菜单进入全屏'); }
  }
  $('fullscreen-button').addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
    $('fullscreen-button').title = document.fullscreenElement ? '退出全屏 · F' : '全屏 · F';
  });
  window.addEventListener('keydown', event => {
    if (dialog.open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const tag = event.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) || event.target.isContentEditable) return;
    if (event.code === 'Space') { event.preventDefault(); world.setPaused(!world.paused); }
    if (event.code === 'KeyF') fullscreen();
    if (event.code === 'KeyG') world.feed();
  });
  window.addEventListener('ocean:ready', sync);
  window.addEventListener('ocean:change', sync);
  window.addEventListener('ocean:notify', event => toast(event.detail));
  window.addEventListener('ocean:feed', () => {
    $('interaction-hint').querySelector('span').textContent = '惊喜已送达，看看谁会先发现';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { $('interaction-hint').querySelector('span').textContent = '轻点海水，投下一点小小的惊喜'; }, 4500);
  });
  sync();
})();
