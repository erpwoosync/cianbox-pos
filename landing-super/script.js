/**
 * Cianbox POS - Landing Page Supermercados
 * JavaScript para interactividad y animaciones
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initHeader();
    initMobileMenu();
    initCounterAnimation();
    initMulticajaDemo();
    initFAQ();
    initContactForm();
    initScrollAnimations();
    initSmoothScroll();
});

/**
 * Header scroll effect
 */
function initHeader() {
    const header = document.querySelector('.header');

    function updateHeader() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', updateHeader);
    updateHeader();
}

/**
 * Mobile menu toggle
 */
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const menu = document.querySelector('.mobile-menu');

    if (!toggle || !menu) return;

    toggle.addEventListener('click', function() {
        menu.classList.toggle('active');
        toggle.classList.toggle('active');
    });

    // Close menu when clicking a link
    const menuLinks = menu.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            menu.classList.remove('active');
            toggle.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!menu.contains(e.target) && !toggle.contains(e.target)) {
            menu.classList.remove('active');
            toggle.classList.remove('active');
        }
    });
}

/**
 * Counter animation for stats
 */
function initCounterAnimation() {
    const counters = document.querySelectorAll('[data-target]');
    const proofNumbers = document.querySelectorAll('.proof-number[data-target]');

    const animateCounter = (element, target, duration = 2000) => {
        const isDecimal = target % 1 !== 0;
        const startTime = performance.now();

        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = target * easeOut;

            if (isDecimal) {
                element.textContent = current.toFixed(1);
            } else {
                element.textContent = Math.floor(current).toLocaleString('es-AR');
            }

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };

        requestAnimationFrame(updateCounter);
    };

    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseFloat(entry.target.dataset.target);
                animateCounter(entry.target, target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    counters.forEach(counter => observer.observe(counter));
    proofNumbers.forEach(counter => observer.observe(counter));
}

/**
 * Multi-caja interactive demo
 */
function initMulticajaDemo() {
    const container = document.getElementById('cajasGrid');
    const countDisplay = document.getElementById('cajaCount');
    const minusBtn = document.querySelector('.counter-btn.minus');
    const plusBtn = document.querySelector('.counter-btn.plus');
    const transPerHour = document.getElementById('transPerHour');
    const maxClients = document.getElementById('maxClients');
    const waitTime = document.getElementById('waitTime');

    if (!container || !countDisplay) return;

    let cajaCount = 6;
    const MIN_CAJAS = 1;
    const MAX_CAJAS = 15;

    // Calculate stats based on number of registers
    function calculateStats(count) {
        const transactionsPerCaja = 50; // transactions per hour per register
        const clientsPerCaja = 30; // clients per hour per register
        const baseWaitTime = 10; // base wait time in minutes with 1 register

        return {
            transactions: count * transactionsPerCaja,
            clients: count * clientsPerCaja,
            waitTime: Math.max(0.5, baseWaitTime / count).toFixed(1)
        };
    }

    // Update stats display
    function updateStats(count) {
        const stats = calculateStats(count);
        transPerHour.textContent = stats.transactions;
        maxClients.textContent = stats.clients + '/hora';
        waitTime.textContent = stats.waitTime + ' min';
    }

    // Generate register cards
    function generateCajas(count) {
        container.innerHTML = '';

        for (let i = 1; i <= count; i++) {
            const isActive = Math.random() > 0.3; // 70% chance of being active
            const caja = document.createElement('div');
            caja.className = `caja-item ${isActive ? 'active' : ''}`;
            caja.innerHTML = `
                <div class="caja-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M12 8v8M8 12h8"/>
                    </svg>
                </div>
                <span class="caja-name">Caja ${i}</span>
                <span class="caja-status">${isActive ? 'Operando' : 'Disponible'}</span>
            `;
            container.appendChild(caja);
        }
    }

    // Update count and regenerate
    function updateCount(newCount) {
        cajaCount = Math.min(MAX_CAJAS, Math.max(MIN_CAJAS, newCount));
        countDisplay.textContent = cajaCount;
        generateCajas(cajaCount);
        updateStats(cajaCount);

        // Update button states
        minusBtn.disabled = cajaCount <= MIN_CAJAS;
        plusBtn.disabled = cajaCount >= MAX_CAJAS;
    }

    // Event listeners
    if (minusBtn) {
        minusBtn.addEventListener('click', () => updateCount(cajaCount - 1));
    }

    if (plusBtn) {
        plusBtn.addEventListener('click', () => updateCount(cajaCount + 1));
    }

    // Initial render
    updateCount(cajaCount);

    // Simulate activity
    setInterval(() => {
        const items = container.querySelectorAll('.caja-item');
        items.forEach(item => {
            if (Math.random() > 0.8) { // 20% chance to toggle
                item.classList.toggle('active');
                const status = item.querySelector('.caja-status');
                status.textContent = item.classList.contains('active') ? 'Operando' : 'Disponible';
            }
        });
    }, 3000);
}

/**
 * FAQ accordion
 */
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

/**
 * Contact form handling
 */
function initContactForm() {
    const form = document.getElementById('contactForm');

    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Show loading state
        submitBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
            Enviando...
        `;
        submitBtn.disabled = true;

        // Collect form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Show success
        submitBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Enviado con exito
        `;
        submitBtn.classList.add('success');

        // Reset form
        form.reset();

        // Reset button after delay
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('success');
        }, 3000);

        console.log('Form submitted:', data);
    });
}

/**
 * Scroll animations for elements
 */
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll(
        '.problem-card, .feature-card, .step, .testimonial-card, .pricing-card'
    );

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add staggered delay
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    animatedElements.forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            if (href === '#') return;

            const target = document.querySelector(href);

            if (target) {
                e.preventDefault();

                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Hero register simulation
 */
(function initHeroSimulation() {
    const registerCards = document.querySelectorAll('.register-card');

    if (!registerCards.length) return;

    // Random amounts for simulation
    const generateAmount = () => {
        return '$' + (Math.floor(Math.random() * 30000) + 5000).toLocaleString('es-AR');
    };

    const generateItems = () => {
        return Math.floor(Math.random() * 15) + 1 + ' items';
    };

    // Update registers periodically
    setInterval(() => {
        registerCards.forEach(card => {
            if (Math.random() > 0.6) {
                const amount = card.querySelector('.register-amount');
                const items = card.querySelector('.register-items');
                const indicator = card.querySelector('.register-indicator');

                if (amount) amount.textContent = generateAmount();
                if (items) items.textContent = generateItems();

                // Toggle indicator state
                if (indicator) {
                    const states = ['Procesando...', 'Cobrando...', 'Lista'];
                    indicator.textContent = states[Math.floor(Math.random() * states.length)];
                    indicator.classList.toggle('idle', indicator.textContent === 'Lista');
                }

                // Toggle active state
                card.classList.toggle('active', Math.random() > 0.5);
            }
        });
    }, 2500);
})();

/**
 * Update dashboard value periodically
 */
(function initDashboardSimulation() {
    const dashboardValue = document.querySelector('.dashboard-value');

    if (!dashboardValue) return;

    let currentValue = 458320;

    setInterval(() => {
        // Random increase between 100 and 2000
        const increase = Math.floor(Math.random() * 1900) + 100;
        currentValue += increase;
        dashboardValue.textContent = '$' + currentValue.toLocaleString('es-AR');
    }, 4000);
})();

/**
 * Add CSS for spin animation
 */
(function addSpinAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        button.success {
            background-color: #10b981 !important;
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Intersection Observer polyfill check
 */
if (!('IntersectionObserver' in window)) {
    // Simple fallback for older browsers
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        el.classList.add('visible');
    });

    document.querySelectorAll('[data-target]').forEach(el => {
        el.textContent = el.dataset.target;
    });
}
