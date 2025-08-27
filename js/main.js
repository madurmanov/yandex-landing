function throttle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

(function () {
  function smoothScrollTo(target, duration = 500) {
    const targetY = target.getBoundingClientRect().top + window.scrollY;
    const startY = window.scrollY || document.documentElement.scrollTop;
    const diff = targetY - startY;
    let startTime;

    function step(currentTime) {
      if (!startTime) startTime = currentTime;
      const time = currentTime - startTime;
      const progress = Math.min(time / duration, 1);

      window.scrollTo(0, startY + diff * progress);

      if (time < duration) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      smoothScrollTo(target);
      history.replaceState(null, '', '#' + id);
    });
  });

  window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (target) {
        setTimeout(() => smoothScrollTo(target), 50);
      }
    }
  });
})();

(function () {
  class SwipeDetector {
    constructor(element, callbacks = {}) {
      this.element = element;
      this.callbacks = callbacks;
      this.startX = 0;
      this.startY = 0;
      this.isDragging = false;
      this.threshold = 50;
      this.restraint = 100;

      this.handleTouchStart = (e) => this.touchStart(e);
      this.handleTouchMove = (e) => this.touchMove(e);
      this.handleTouchEnd = (e) => this.touchEnd(e);

      this.element.addEventListener('touchstart', this.handleTouchStart, {
        passive: true,
      });
      this.element.addEventListener('touchmove', this.handleTouchMove, {
        passive: false,
      });
      this.element.addEventListener('touchend', this.handleTouchEnd, {
        passive: true,
      });
    }

    touchStart(e) {
      const touch = e.touches[0];
      this.startX = touch.pageX;
      this.startY = touch.pageY;
      this.isDragging = true;
    }

    touchMove(e) {
      if (!this.isDragging) return;
      const touch = e.touches[0];
      const distX = touch.pageX - this.startX;
      const distY = touch.pageY - this.startY;

      if (Math.abs(distX) > Math.abs(distY)) {
        e.preventDefault();
      }
    }

    touchEnd(e) {
      if (!this.isDragging) return;
      this.isDragging = false;

      const touch = e.changedTouches[0];
      const distX = touch.pageX - this.startX;
      const distY = touch.pageY - this.startY;

      this.startX = 0;
      this.startY = 0;

      if (
        Math.abs(distX) >= this.threshold &&
        Math.abs(distY) <= this.restraint
      ) {
        if (distX < 0 && this.callbacks.left) this.callbacks.left();
        if (distX > 0 && this.callbacks.right) this.callbacks.right();
      }
    }

    destroy() {
      this.element.removeEventListener('touchstart', this.handleTouchStart);
      this.element.removeEventListener('touchmove', this.handleTouchMove);
      this.element.removeEventListener('touchend', this.handleTouchEnd);
    }
  }

  class Slider {
    static PAGINATION_ITEM_CLASSNAME = 'Slider-PaginationItem';
    static PAGINATION_ITEM_ACTIVE_CLASSNAME = 'Slider-PaginationItem_active';
    static COUNTER_ACTIVE_CLASSNAME = 'Slider-CounterActive';

    constructor(options) {
      this.container = document.querySelector(options.selector);
      this.slider = this.container.querySelector('.Slider');
      this.slides = Array.from(this.slider.children);
      this.prevButton = this.container.querySelector('.Slider-Button_prev');
      this.nextButton = this.container.querySelector('.Slider-Button_next');
      this.counter = this.container.querySelector('.Slider-Counter');
      this.pagination = this.container.querySelector('.Slider-Pagination');

      this.loop = options.loop || false;
      this.mobileOnly = options.mobileOnly || false;
      this.mobileBreakpoint = options.mobileBreakpoint || 425;
      this.slidesToShowDesktop = options.slidesToShowDesktop || 1;
      this.autoPlay = options.autoPlay || 0;

      this.currentSlide = 0;
      this.slidesToShow = 0;
      this.autoPlayTimer = null;
      this.swipe = null;

      if (this.counter) {
        this.createCounter();
        this.updateCounter();
      }

      if (this.pagination) {
        this.createPagination();
        this.updatePagination();
      }

      this.updateSlides();
      this.updateButtons();
      this.startAutoPlay();
      this.attachEvents();

      window.addEventListener(
        'resize',
        throttle(() => this.onResize(), 200)
      );
    }

    attachEvents() {
      if (this.prevButton) {
        this.prevButton.addEventListener('click', () => {
          this.prev();
          this.restartAutoPlay();
        });
      }
      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => {
          this.next();
          this.restartAutoPlay();
        });
      }

      if (this.pagination) {
        this.pagination.addEventListener('click', (e) => {
          if (e.target.classList.contains(Slider.PAGINATION_ITEM_CLASSNAME)) {
            const index = parseInt(e.target.dataset.index);
            this.goToSlide(index);
            this.restartAutoPlay();
          }
        });
      }

      this.attachSwipes();

      if (this.autoPlay) {
        this.slider.addEventListener('click', () => this.restartAutoPlay());
      }
    }

    attachSwipes() {
      if (this.swipe) this.swipe.destroy();
      if (this.slidesToShow === 0) return;

      this.swipe = new SwipeDetector(this.container, {
        left: () => {
          this.next();
          this.restartAutoPlay();
        },
        right: () => {
          this.prev();
          this.restartAutoPlay();
        },
      });
    }

    updateSlides() {
      const width = window.innerWidth;
      const prevSlidesToShow = this.slidesToShow;

      if (this.mobileOnly && width > this.mobileBreakpoint) {
        this.slidesToShow = 0;
        this.slider.style.transform = 'translateX(0)';
      } else {
        this.slidesToShow =
          width <= this.mobileBreakpoint ? 1 : this.slidesToShowDesktop;
      }

      if (prevSlidesToShow !== this.slidesToShow) {
        this.currentSlide = 0;
        this.slider.style.transform = 'translateX(0)';
      }

      this.updateSlideWidth();
    }

    updateSlideWidth() {
      if (this.slidesToShow === 0) return;
      const slideWidth = 100 / this.slidesToShow;
      this.slides.forEach((slide) => (slide.style.flex = `0 0 ${slideWidth}`));
      this.goToSlide(this.currentSlide);
    }

    createPagination() {
      if (!this.pagination) return;
      this.pagination.innerHTML = '';
      this.slides.forEach((slide, index) => {
        const item = document.createElement('button');
        item.classList.add(Slider.PAGINATION_ITEM_CLASSNAME);
        item.dataset.index = index;
        item.setAttribute('aria-label', `Слайд ${index + 1}`);
        this.pagination.appendChild(item);
      });
    }

    updatePagination() {
      if (!this.pagination) return;
      this.pagination
        .querySelectorAll(`.${Slider.PAGINATION_ITEM_CLASSNAME}`)
        .forEach((item) => {
          item.classList.remove(Slider.PAGINATION_ITEM_ACTIVE_CLASSNAME);
        });
      const activeIndex = Math.min(this.currentSlide, this.slides.length - 1);
      this.pagination
        .querySelector(
          `.${Slider.PAGINATION_ITEM_CLASSNAME}[data-index="${activeIndex}"]`
        )
        ?.classList.add(Slider.PAGINATION_ITEM_ACTIVE_CLASSNAME);
    }

    createCounter() {
      if (!this.counter) return;
      this.counter.innerHTML = '';
      const total = this.slides.length;
      const active = document.createElement('span');
      active.classList.add(Slider.COUNTER_ACTIVE_CLASSNAME);
      active.textContent = 1;
      this.counter.appendChild(active);
      this.counter.appendChild(document.createTextNode(` / ${total}`));
    }

    updateCounter() {
      if (!this.counter) return;
      const total = this.slides.length;

      let current = Math.min(this.currentSlide + 1, total);

      if (this.slidesToShow > 1) {
        current = Math.min(this.currentSlide + this.slidesToShow, total);
      }

      this.counter.querySelector(
        `.${Slider.COUNTER_ACTIVE_CLASSNAME}`
      ).textContent = current;
    }

    updateButtons() {
      if (!this.prevButton || !this.nextButton || this.loop) return;
      this.prevButton.disabled = this.currentSlide === 0;
      this.nextButton.disabled =
        this.currentSlide >= this.slides.length - this.slidesToShow;
    }

    goToSlide(index) {
      if (this.slidesToShow === 0) return;

      if (this.loop) {
        if (index < 0) index = this.slides.length - this.slidesToShow;
        if (index > this.slides.length - this.slidesToShow) index = 0;
      } else {
        index = Math.max(
          0,
          Math.min(index, this.slides.length - this.slidesToShow)
        );
      }

      this.currentSlide = index;
      const offset = -(100 / this.slidesToShow) * index;
      this.slider.style.transform = `translateX(${offset}%)`;

      this.updateCounter();
      this.updatePagination();
      this.updateButtons();
    }

    next() {
      this.goToSlide(this.currentSlide + 1);
    }

    prev() {
      this.goToSlide(this.currentSlide - 1);
    }

    onResize() {
      this.updateSlides();
      this.updateButtons();
      this.updatePagination();
      this.updateCounter();
      this.attachSwipes();
    }

    startAutoPlay() {
      if (this.autoPlay > 0) {
        this.autoPlayTimer = setInterval(() => this.next(), this.autoPlay);
      }
    }

    stopAutoPlay() {
      if (this.autoPlayTimer) {
        clearInterval(this.autoPlayTimer);
        this.autoPlayTimer = null;
      }
    }

    restartAutoPlay() {
      this.stopAutoPlay();
      this.startAutoPlay();
    }
  }

  new Slider({
    selector: '.StepsSlider',
    mobileOnly: true,
  });

  new Slider({
    selector: '.ParticipantsSlider',
    slidesToShowDesktop: 3,
    loop: true,
    autoPlay: 4000,
  });
})();
