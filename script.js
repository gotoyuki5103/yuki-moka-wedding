// =====================================
// 設定とユーティリティ
// =====================================
const CONFIG = {
    sliders: {
        memories: { folder: 'images/memories', count: 5 },
        preshoot: { folder: 'images/preshoot', count: 7 }
    },
    autoPlayInterval: 4000,
    swipeThreshold: 50,
    maxDetectCount: 50
};

// =====================================
// 画像の自動検出
// =====================================
async function detectImageCount(folderPath, maxCount = CONFIG.maxDetectCount) {
    const results = await Promise.all(
        Array.from({ length: maxCount }, (_, i) => {
            const fileName = `${String(i + 1).padStart(2, '0')}.jpg`;
            const url = `${folderPath}/${fileName}`;

            return fetch(url, { method: 'HEAD' })
                .then(response => response.ok)
                .catch(() => false);
        })
    );

    const lastValidIndex = results.lastIndexOf(true);
    return lastValidIndex + 1;
}

// =====================================
// スライダークラス
// =====================================
class Slider {
    constructor(containerId, dotsContainerId, slideClass, dotClass, folder, count) {
        this.containerId = containerId;
        this.dotsContainerId = dotsContainerId;
        this.slideClass = slideClass;
        this.dotClass = dotClass;
        this.folder = folder;
        this.count = count;
        this.currentIndex = 1;
        this.timer = null;
        this.touchStartX = 0;
        this.isTransitioning = false;
    }

    build() {
        const container = document.getElementById(this.containerId);
        const dotsContainer = document.getElementById(this.dotsContainerId);

        if (!container || !dotsContainer || this.count === 0) return;

        // --- ズレ防止の修正：既存の要素をクリア ---
        const oldSlides = container.querySelectorAll(`.${this.slideClass}`);
        oldSlides.forEach(s => s.remove());
        dotsContainer.innerHTML = '';

        // スライド生成
        const slideFragment = document.createDocumentFragment();
        for (let i = 1; i <= this.count; i++) {
            const slide = document.createElement('div');
            slide.className = `${this.slideClass} fade-slide`;
            // 初期状態は1枚目以外非表示
            slide.style.display = i === 1 ? 'block' : 'none';

            const img = document.createElement('img');
            img.src = `${this.folder}/${String(i).padStart(2, '0')}.jpg`;
            img.alt = `写真 ${i}`;
            img.loading = 'lazy';

            slide.appendChild(img);
            slideFragment.appendChild(slide);
        }

        // 矢印ボタンの前に挿入
        const arrow = container.querySelector('.prev-arrow');
        if (arrow) {
            container.insertBefore(slideFragment, arrow);
        } else {
            container.appendChild(slideFragment);
        }

        // ドット生成
        const dotsFragment = document.createDocumentFragment();
        for (let i = 1; i <= this.count; i++) {
            const dot = document.createElement('button');
            dot.className = this.dotClass;
            if (i === 1) dot.classList.add('active-dot'); // 1枚目をアクティブに
            
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `写真 ${i}を表示`);
            dot.onclick = () => this.goToSlide(i);
            dotsFragment.appendChild(dot);
        }
        dotsContainer.appendChild(dotsFragment);

        this.setupEventListeners(container);
    }

    setupEventListeners(container) {
        container.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
            this.stopAutoPlay();
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            if (this.isTransitioning) return;
            const touchEndX = e.changedTouches[0].clientX;
            const diff = this.touchStartX - touchEndX;
            if (Math.abs(diff) > CONFIG.swipeThreshold) {
                this.navigate(diff > 0 ? 1 : -1);
            }
            this.startAutoPlay();
        }, { passive: true });

        container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.navigate(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.navigate(1);
            }
        });
    }

    navigate(direction) {
        if (this.isTransitioning) return;
        this.stopAutoPlay();
        this.show(this.currentIndex + direction);
    }

    goToSlide(index) {
        if (this.isTransitioning) return;
        this.stopAutoPlay();
        this.show(index);
    }

    show(n) {
        const container = document.getElementById(this.containerId);
        const dotsContainer = document.getElementById(this.dotsContainerId);
        if (!container || !dotsContainer) return;

        const slides = container.getElementsByClassName(this.slideClass);
        const dots = dotsContainer.getElementsByClassName(this.dotClass);

        if (slides.length === 0) return;

        if (n > slides.length) this.currentIndex = 1;
        else if (n < 1) this.currentIndex = slides.length;
        else this.currentIndex = n;

        Array.from(slides).forEach(slide => slide.style.display = 'none');
        Array.from(dots).forEach(dot => {
            dot.classList.remove('active-dot');
            dot.setAttribute('aria-selected', 'false');
        });

        if (slides[this.currentIndex - 1]) {
            slides[this.currentIndex - 1].style.display = 'block';
        }
        if (dots[this.currentIndex - 1]) {
            dots[this.currentIndex - 1].classList.add('active-dot');
            dots[this.currentIndex - 1].setAttribute('aria-selected', 'true');
        }

        this.isTransitioning = true;
        setTimeout(() => {
            this.isTransitioning = false;
            this.startAutoPlay();
        }, 100);
    }

    startAutoPlay() {
        this.stopAutoPlay();
        this.timer = setTimeout(() => {
            this.show(this.currentIndex + 1);
        }, CONFIG.autoPlayInterval);
    }

    stopAutoPlay() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}

// =====================================
// 初期化関数
// =====================================
let memoriesSlider, preshootSlider;

async function initSliders() {
    try {
        const response = await fetch('config.json');
        if (response.ok) {
            const jsonConfig = await response.json();
            Object.assign(CONFIG.sliders, jsonConfig.sliders);
        }
    } catch (error) {
        console.warn('config.json読み込みスキップ:', error);
    }

    const [memoriesCount, preshootCount] = await Promise.all([
        detectImageCount(CONFIG.sliders.memories.folder),
        detectImageCount(CONFIG.sliders.preshoot.folder)
    ]);

    const finalMemCount = memoriesCount > 0 ? memoriesCount : CONFIG.sliders.memories.count;
    const finalPreCount = preshootCount > 0 ? preshootCount : CONFIG.sliders.preshoot.count;

    memoriesSlider = new Slider(
        'slideshow', 'dotsMemories', 'mySlides', 'dot',
        CONFIG.sliders.memories.folder, finalMemCount
    );
    memoriesSlider.build();

    preshootSlider = new Slider(
        'slideshowPre', 'dotsPreshoot', 'mySlidesPre', 'dotPre',
        CONFIG.sliders.preshoot.folder, finalPreCount
    );
    preshootSlider.build();

    setTimeout(() => {
        hideLoading();
    }, 100);
}

// グローバル関数（HTML onclick用）
function plusSlides(n) { if (memoriesSlider) memoriesSlider.navigate(n); }
function plusSlidesPre(n) { if (preshootSlider) preshootSlider.navigate(n); }

// =====================================
// 各種UI制御
// =====================================
function initBiographyTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const bioContents = document.querySelectorAll('.bio-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            bioContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetId) content.classList.add('active');
            });
        });
    });
}

function initModals() {
    const menuModal = document.getElementById('menuModal');
    const imgModal = document.getElementById('imgModal');
    const openMenuBtn = document.getElementById('openMenuModal');
    const seatingChartImg = document.getElementById('seatingChartImg');
    const expandedImg = document.getElementById('expandedImg');

    openMenuBtn.onclick = () => {
        menuModal.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    };

    seatingChartImg.onclick = () => {
        imgModal.classList.add('is-active');
        expandedImg.src = seatingChartImg.src;
        document.body.style.overflow = 'hidden';
    };

    document.querySelectorAll('.modal .close-btn').forEach(btn => {
        btn.onclick = function() {
            this.closest('.modal').classList.remove('is-active');
            document.body.style.overflow = '';
        };
    });

    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('is-active');
            document.body.style.overflow = '';
        }
    };

    document.querySelectorAll('#menuModal a').forEach(link => {
        link.onclick = (e) => {
            const targetId = link.getAttribute('href');
            if (targetId.startsWith('#')) {
                e.preventDefault();
                menuModal.classList.remove('is-active');
                document.body.style.overflow = '';
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({ top: targetElement.offsetTop - 20, behavior: 'smooth' });
                }
            }
        };
    });
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// =====================================
// 初期化実行
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    // フェードイン監視
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // UI初期化
    initModals();
    initBiographyTabs();
    initSliders();
});
