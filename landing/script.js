/**
 * Cianbox POS - Landing Page JavaScript
 * ======================================
 * Interactividad y funcionalidades de la landing page
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initScrollEffects();
    initFAQ();
    initContactForm();
    initSmoothScroll();
    initAnimations();
});

/**
 * Navigation functionality
 * - Mobile menu toggle
 * - Active link highlighting
 */
function initNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav__link');

    // Mobile menu toggle
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('open');
        });

        // Close menu when clicking a link
        navLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                navToggle.classList.remove('active');
                navMenu.classList.remove('open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navToggle.classList.remove('active');
                navMenu.classList.remove('open');
            }
        });
    }

    // Highlight active section in navigation
    const sections = document.querySelectorAll('section[id]');

    function highlightNav() {
        const scrollY = window.scrollY;

        sections.forEach(function(section) {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 100;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector('.nav__link[href="#' + sectionId + '"]');

            if (navLink) {
                if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    navLink.classList.add('active');
                } else {
                    navLink.classList.remove('active');
                }
            }
        });
    }

    window.addEventListener('scroll', throttle(highlightNav, 100));
}

/**
 * Scroll-based effects
 * - Header shadow on scroll
 * - Scroll-triggered animations
 */
function initScrollEffects() {
    const header = document.getElementById('header');

    function handleScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', throttle(handleScroll, 50));
    handleScroll(); // Check initial state
}

/**
 * FAQ accordion functionality
 */
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(function(item) {
        const question = item.querySelector('.faq-item__question');
        const answer = item.querySelector('.faq-item__answer');

        question.addEventListener('click', function() {
            const isOpen = question.getAttribute('aria-expanded') === 'true';

            // Close all other items
            faqItems.forEach(function(otherItem) {
                const otherQuestion = otherItem.querySelector('.faq-item__question');
                const otherAnswer = otherItem.querySelector('.faq-item__answer');
                otherQuestion.setAttribute('aria-expanded', 'false');
                otherAnswer.classList.remove('open');
            });

            // Toggle current item
            if (!isOpen) {
                question.setAttribute('aria-expanded', 'true');
                answer.classList.add('open');
            }
        });
    });
}

/**
 * Contact form handling
 * - Validation
 * - Submission (demo)
 */
function initContactForm() {
    const form = document.getElementById('contact-form');

    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(form);
        const data = {};

        formData.forEach(function(value, key) {
            data[key] = value;
        });

        // Validate required fields
        if (!data.name || !data.email) {
            showNotification('Por favor completa los campos requeridos', 'error');
            return;
        }

        // Validate email format
        if (!isValidEmail(data.email)) {
            showNotification('Por favor ingresa un email valido', 'error');
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Enviando...';
        submitBtn.disabled = true;

        // Simulate form submission (replace with actual API call)
        setTimeout(function() {
            showNotification('Gracias! Te contactaremos pronto.', 'success');
            form.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            // Track conversion (Google Analytics, etc.)
            if (typeof gtag === 'function') {
                gtag('event', 'generate_lead', {
                    event_category: 'Contact',
                    event_label: 'Demo Request'
                });
            }
        }, 1500);
    });
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            if (href === '#') return;

            const target = document.querySelector(href);

            if (target) {
                e.preventDefault();

                const headerHeight = document.getElementById('header').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Scroll-triggered animations
 */
function initAnimations() {
    const animatedElements = document.querySelectorAll(
        '.feature-card, .problem__card, .pricing-card, .benefit, .step, .stat-card'
    );

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });

    // Add CSS for animated state
    const style = document.createElement('style');
    style.textContent = '.animate-in { opacity: 1 !important; transform: translateY(0) !important; }';
    document.head.appendChild(style);
}

/**
 * Show notification toast
 * @param {string} message - Notification message
 * @param {string} type - 'success' or 'error'
 */
function showNotification(message, type) {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification notification--' + type;
    notification.innerHTML = '<p>' + message + '</p>';

    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '8px',
        backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        zIndex: '9999',
        animation: 'slideIn 0.3s ease'
    });

    // Add animation keyframes
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = '@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(function() {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(function() {
            notification.remove();
        }, 300);
    }, 4000);
}

/**
 * Email validation helper
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Throttle helper function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Throttle limit in ms
 * @returns {Function}
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(function() {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Counter animation for stats
 */
function animateCounters() {
    const counters = document.querySelectorAll('.stat-card__number, .trust-number');

    counters.forEach(function(counter) {
        const text = counter.textContent;
        const isPercentage = text.includes('%');
        const isMultiplier = text.includes('x');
        const value = parseInt(text.replace(/[^0-9]/g, ''));

        if (isNaN(value)) return;

        let current = 0;
        const increment = value / 50;
        const duration = 1500;
        const stepTime = duration / 50;

        counter.textContent = '0' + (isPercentage ? '%' : isMultiplier ? 'x' : '');

        const timer = setInterval(function() {
            current += increment;
            if (current >= value) {
                current = value;
                clearInterval(timer);
            }

            let display = Math.floor(current);
            if (text.includes('+')) display = '+' + display;
            if (isPercentage) display += '%';
            if (isMultiplier) display += 'x';

            counter.textContent = display;
        }, stepTime);
    });
}

// Trigger counter animation when stats section is visible
const statsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            animateCounters();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.benefits__stats');
if (statsSection) {
    statsObserver.observe(statsSection);
}

const trustSection = document.querySelector('.hero__trust');
if (trustSection) {
    statsObserver.observe(trustSection);
}
