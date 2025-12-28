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
// 画像の自動検出（最適化版）
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

        // スライド生成
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= this.count; i++) {
            const slide = document.createElement('div');
            slide.className = `${this.slideClass} fade-slide`;

            const img = document.createElement('img');
            img.src = `${this.folder}/${String(i).padStart(2, '0')}.jpg`;
            img.alt = `写真 ${i}`;
            img.loading = 'lazy';

            slide.appendChild(img);
            fragment.appendChild(slide);
        }

        const arrow = container.querySelector('.prev-arrow');
        if (arrow) {
            container.insertBefore(fragment, arrow);
        } else {
            container.appendChild(fragment);
        }

        // ドット生成
        const dotsFragment = document.createDocumentFragment();
        for (let i = 1; i <= this.count; i++) {
            const dot = document.createElement('button');
            dot.className = this.dotClass;
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `写真 ${i}を表示`);
            dot.onclick = () => this.goToSlide(i);
            dotsFragment.appendChild(dot);
        }
        dotsContainer.appendChild(dotsFragment);

        // イベントリスナー
        this.setupEventListeners(container);
    }

    setupEventListeners(container) {
        // タッチイベント
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

        // キーボードナビゲーション
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
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const slides = document.getElementsByClassName(this.slideClass);
        const dots = document.getElementsByClassName(this.dotClass);

        if (slides.length === 0) {
            this.isTransitioning = false;
            return;
        }

        if (n > slides.length) this.currentIndex = 1;
        else if (n < 1) this.currentIndex = slides.length;
        else this.currentIndex = n;

        Array.from(slides).forEach(slide => slide.style.display = 'none');
        Array.from(dots).forEach(dot => {
            dot.classList.remove('active-dot');
            dot.setAttribute('aria-selected', 'false');
        });

        slides[this.currentIndex - 1].style.display = 'block';
        if (dots[this.currentIndex - 1]) {
            dots[this.currentIndex - 1].classList.add('active-dot');
            dots[this.currentIndex - 1].setAttribute('aria-selected', 'true');
        }

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
// 初期化
// =====================================
let memoriesSlider, preshootSlider;

async function initSliders() {
    try {
        const response = await fetch('config.json');
        const jsonConfig = await response.json();
        Object.assign(CONFIG.sliders, jsonConfig.sliders);
    } catch (error) {
        console.warn('config.jsonの読み込みに失敗しました。デフォルト設定を使用します。', error);
    }

    // 画像数の自動検出
    const [memoriesCount, preshootCount] = await Promise.all([
        detectImageCount(CONFIG.sliders.memories.folder),
        detectImageCount(CONFIG.sliders.preshoot.folder)
    ]);

    if (memoriesCount > 0) CONFIG.sliders.memories.count = memoriesCount;
    if (preshootCount > 0) CONFIG.sliders.preshoot.count = preshootCount;

    console.log(`MEMORIES: ${CONFIG.sliders.memories.count}枚, PRESHOOT: ${CONFIG.sliders.preshoot.count}枚`);

    // スライダー構築
    memoriesSlider = new Slider(
        'slideshow', 'dotsMemories', 'mySlides', 'dot',
        CONFIG.sliders.memories.folder, CONFIG.sliders.memories.count
    );
    memoriesSlider.build();

    preshootSlider = new Slider(
        'slideshowPre', 'dotsPreshoot', 'mySlidesPre', 'dotPre',
        CONFIG.sliders.preshoot.folder, CONFIG.sliders.preshoot.count
    );
    preshootSlider.build();

    // 初期表示
    setTimeout(() => {
        if (memoriesSlider) memoriesSlider.show(1);
        if (preshootSlider) preshootSlider.show(1);
        hideLoading();
    }, 100);
}

// グローバル関数（HTML onclick用）
function plusSlides(n) { if (memoriesSlider) memoriesSlider.navigate(n); }
function currentSlide(n) { if (memoriesSlider) memoriesSlider.goToSlide(n); }
function plusSlidesPre(n) { if (preshootSlider) preshootSlider.navigate(n); }
function currentSlidePre(n) { if (preshootSlider) preshootSlider.goToSlide(n); }

// =====================================
// フェードインアニメーション
// =====================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// =====================================
// モーダル制御
// =====================================
function initModals() {
    const menuModal = document.getElementById('menuModal');
    const imgModal = document.getElementById('imgModal');
    const openMenuBtn = document.getElementById('openMenuModal');
    const seatingChartImg = document.getElementById('seatingChartImg');
    const expandedImg = document.getElementById('expandedImg');

    // メニューを開く
    openMenuBtn.addEventListener('click', () => {
        menuModal.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    });

    // 席次表を拡大
    seatingChartImg.addEventListener('click', () => {
        imgModal.classList.add('is-active');
        expandedImg.src = seatingChartImg.src;
        expandedImg.alt = seatingChartImg.alt;
        document.body.style.overflow = 'hidden';
    });

    // 閉じるボタン
    document.querySelectorAll('.modal .close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('is-active');
            document.body.style.overflow = '';
        });
    });

    // 背景クリックで閉じる
    [menuModal, imgModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('is-active');
                document.body.style.overflow = '';
            }
        });
    });

    // メニューリンククリック
    document.querySelectorAll('#menuModal a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            menuModal.classList.remove('is-active');
            document.body.style.overflow = '';

            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 20;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Escキーで閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            menuModal.classList.remove('is-active');
            imgModal.classList.remove('is-active');
            document.body.style.overflow = '';
        }
    });
}

// =====================================
// ローディング制御
// =====================================
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

// =====================================
// 初期化実行
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    // フェードイン監視
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // モーダル初期化
    initModals();

    // スライダー初期化
    initSliders();
});

// --- Existing logic from  stays here ---
//... detectImageCount, Slider Class, initSliders, etc.

function initBiographyTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const bioContents = document.querySelectorAll('.bio-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');

            // Toggle Buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle Content
            bioContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetId) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Update DOMContentLoaded to include the new feature
document.addEventListener('DOMContentLoaded', () => {
    // Existing Observer logic for.fade-in
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // Initialize core functions
    initModals();
    initSliders();
    initBiographyTabs(); // New function call
});
