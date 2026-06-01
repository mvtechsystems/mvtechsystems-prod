const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const navbar = document.querySelector('.navbar');

const scrollProgress = document.createElement('div');
scrollProgress.className = 'scroll-progress';
scrollProgress.setAttribute('aria-hidden', 'true');
document.body.prepend(scrollProgress);

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        }
    });
});

function updateScrollEffects() {
    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

    document.documentElement.style.setProperty('--scroll-progress', `${progress}%`);
    document.documentElement.style.setProperty('--hero-shift', `${Math.min(scrollTop * 0.12, 90)}px`);

    if (scrollTop > 50) {
        navbar.classList.add('is-scrolled');
    } else {
        navbar.classList.remove('is-scrolled');
    }
}

window.addEventListener('scroll', updateScrollEffects, { passive: true });
window.addEventListener('resize', updateScrollEffects);
updateScrollEffects();

// Form submission handling
document.querySelector('.contact-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const message = this.querySelector('textarea').value;
    
    if (name && email && message) {
        alert('Thank you for your message! We will get back to you soon.');
        this.reset();
    } else {
        alert('Please fill in all fields.');
    }
});

function prepareReveal(selector, className = 'reveal', delayStep = 80) {
    document.querySelectorAll(selector).forEach((element, index) => {
        element.classList.add('reveal', className);
        element.style.setProperty('--reveal-delay', `${index * delayStep}ms`);
    });
}

prepareReveal('.services .section-title, .services .section-subtitle', 'reveal-zoom', 70);
prepareReveal('.service-card', 'reveal', 110);
prepareReveal('.about-text', 'reveal-left');
prepareReveal('.about-image', 'reveal-right');
prepareReveal('.stat', 'reveal-zoom', 120);
prepareReveal('.contact .section-title, .contact .section-subtitle', 'reveal-zoom', 70);
prepareReveal('.contact-item', 'reveal-left', 90);
prepareReveal('.contact-form', 'reveal-right');
prepareReveal('.footer-logo, .footer p', 'reveal-zoom', 90);

function animateStat(statNumber) {
    if (statNumber.dataset.animated === 'true') {
        return;
    }

    statNumber.dataset.animated = 'true';
    const rawValue = statNumber.textContent.trim();
    const numericValue = parseInt(rawValue.replace(/\D/g, ''), 10);
    const suffix = rawValue.replace(/[0-9]/g, '');

    if (!numericValue || prefersReducedMotion) {
        statNumber.textContent = rawValue;
        return;
    }

    const duration = 1100;
    const start = performance.now();

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        statNumber.textContent = `${Math.round(numericValue * eased)}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
}

const observerOptions = {
    threshold: 0.16,
    rootMargin: '0px 0px -70px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');

            if (entry.target.classList.contains('stat')) {
                const statNumber = entry.target.querySelector('.stat-number');
                if (statNumber) {
                    animateStat(statNumber);
                }
            }

            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(element => {
    observer.observe(element);
});

function markPageLoaded() {
    document.body.classList.add('is-loaded');
    updateScrollEffects();
}

if (document.readyState === 'complete') {
    markPageLoaded();
} else {
    window.addEventListener('load', markPageLoaded);
}
