/**
 * High-level Scroll Logic: Smooth Inertia, Parallax, and Frame Animation.
 */

const canvas = document.getElementById('bg-canvas');
const context = canvas.getContext('2d');
const html = document.documentElement;
const landingPage = document.querySelector('.landing-page');

const frameCount = 40;
const currentFrame = index => `../BG/ezgif-frame-${index.toString().padStart(3, '0')}.png`;

const images = [];
const state = {
    targetFrame: 0,
    currentFrame: 0,
    targetScroll: 0,
    currentScroll: 0,
    lerpSpeed: 0.07, // Liquid smoothness
    scrollInertia: 0.08
};

// Preload images using Cache API for browser-level local storage caching
for (let i = 0; i < frameCount; i++) {
    images.push(new Image());
}

async function preloadImagesWithCache() {
    const cacheName = 'bg-frames-cache-v1';
    let cache = null;

    // Check if Cache API is supported (requires HTTPS or localhost)
    if ('caches' in window) {
        try { cache = await caches.open(cacheName); } catch (e) { console.warn('Cache API not available'); }
    }

    const loadPromises = [];

    for (let i = 1; i <= frameCount; i++) {
        const url = currentFrame(i);
        const img = images[i - 1];

        const loadPromise = new Promise((resolve) => {
            img.onload = img.onerror = resolve;
        });
        loadPromises.push(loadPromise);

        (async () => {
            try {
                if (cache) {
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) {
                        const blob = await cachedResponse.blob();
                        img.src = URL.createObjectURL(blob);
                        return;
                    }

                    const response = await fetch(url);
                    if (response.ok) {
                        cache.put(url, response.clone());
                        const blob = await response.blob();
                        img.src = URL.createObjectURL(blob);
                        return;
                    }
                }
            } catch (err) {
                console.warn('Cache failed for ' + url + ', falling back to standard loading', err);
            }
            // Fallback
            img.src = url;
        })();
    }

    Promise.all(loadPromises).then(() => {
        render();
    });
}
preloadImagesWithCache();

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);
    render();
}

function render() {
    const frameIndex = Math.min(frameCount - 1, Math.max(0, Math.round(state.currentFrame)));
    const img = images[frameIndex];
    if (!img || !img.complete) return;

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const canvasAspect = cw / ch;
    const imgAspect = img.width / img.height;

    let drawWidth, drawHeight, offsetX, offsetY;
    const cropFactor = 1.1; // Slightly more crop for parallax room

    if (canvasAspect > imgAspect) {
        drawWidth = cw * cropFactor;
        drawHeight = (cw * cropFactor) / imgAspect;
    } else {
        drawWidth = ch * imgAspect * cropFactor;
        drawHeight = ch * cropFactor;
    }

    offsetX = (cw - drawWidth) / 2;
    // Parallax effect on the background itself: shifts slightly with scroll
    const parallaxShift = (state.currentScroll / (html.scrollHeight - ch)) * 40;
    offsetY = (ch - drawHeight) * 0.4 + (parallaxShift - 20);

    context.clearRect(0, 0, cw, ch);
    context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function update() {
    // 1. Smooth out the frame animation
    const frameDiff = state.targetFrame - state.currentFrame;
    state.currentFrame += frameDiff * state.lerpSpeed;

    // 2. Smooth out the overall scroll value for parallax usage
    const scrollDiff = state.targetScroll - state.currentScroll;
    state.currentScroll += scrollDiff * state.scrollInertia;

    // Apply parallax to reveal-on-scroll elements
    document.querySelectorAll('.reveal-on-scroll.visible').forEach((el, i) => {
        const speed = 0.05 + (i * 0.01);
        const yPos = -(state.currentScroll * speed);
        el.style.transform = `translateY(${yPos}px)`;
    });

    if (Math.abs(frameDiff) > 0.0001 || Math.abs(scrollDiff) > 0.1) {
        render();
    }

    requestAnimationFrame(update);
}

function updateScroll() {
    const scrollTop = window.pageYOffset || html.scrollTop;
    state.targetScroll = scrollTop;

    const maxScrollTop = html.scrollHeight - window.innerHeight;
    const scrollFraction = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

    state.targetFrame = Math.min(
        frameCount - 1,
        Math.max(0, scrollFraction * (frameCount - 1))
    );
}

window.addEventListener('scroll', updateScroll);
window.addEventListener('resize', resizeCanvas);

// Intersection Observer for initial reveal
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    revealObserver.observe(el);
});

// Initialization
updateScroll();
state.currentFrame = state.targetFrame;
state.currentScroll = state.targetScroll;
resizeCanvas();
requestAnimationFrame(update);


