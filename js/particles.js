/**
 * Background floating particles — lightweight canvas animation.
 * Renders subtle, slow-moving dots that drift across the viewport.
 */
(function () {
  const PARTICLE_COUNT = 50;
  const COLORS_LIGHT = [
    'rgba(234, 88, 12, 0.25)',
    'rgba(234, 88, 12, 0.18)',
    'rgba(79, 70, 229, 0.18)',
    'rgba(2, 132, 199, 0.16)',
    'rgba(13, 148, 136, 0.16)',
    'rgba(217, 119, 6, 0.20)',
    'rgba(124, 58, 237, 0.14)',
    'rgba(219, 39, 119, 0.12)',
  ];
  const COLORS_DARK = [
    'rgba(234, 88, 12, 0.35)',
    'rgba(234, 88, 12, 0.22)',
    'rgba(79, 70, 229, 0.28)',
    'rgba(2, 132, 199, 0.22)',
    'rgba(13, 148, 136, 0.22)',
    'rgba(124, 58, 237, 0.22)',
    'rgba(219, 39, 119, 0.18)',
    'rgba(22, 163, 74, 0.18)',
  ];

  let canvas, ctx, particles = [], animId;

  function getColors() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? COLORS_DARK : COLORS_LIGHT;
  }

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createParticle() {
    const colors = getColors();
    return {
      x: random(0, canvas.width),
      y: random(0, canvas.height),
      r: random(2.5, 7),
      dx: random(-0.2, 0.2),
      dy: random(-0.15, -0.45),
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: random(0.5, 1),
      phase: random(0, Math.PI * 2),
      speed: random(0.004, 0.012),
    };
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%';
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }

    animate();
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.phase += p.speed;
      const wobble = Math.sin(p.phase) * 0.4;
      p.x += p.dx + wobble;
      p.y += p.dy;

      // wrap around
      if (p.y < -10) {
        p.y = canvas.height + 10;
        p.x = random(0, canvas.width);
      }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity * (0.7 + 0.3 * Math.sin(p.phase));
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    animId = requestAnimationFrame(animate);
  }

  // pause when tab hidden to save CPU
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      animate();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
