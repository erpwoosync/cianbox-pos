/**
 * CIANBOX POS - Landing Page Moda y Calzado
 * JavaScript v1.0
 */

document.addEventListener('DOMContentLoaded', function() {
    // ================================================
    // NAVIGATION
    // ================================================
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    // Scroll effect for navigation
    function handleScroll() {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    // Mobile navigation toggle
    navToggle.addEventListener('click', function() {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close mobile nav when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function() {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // ================================================
    // SMOOTH SCROLL
    // ================================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const navHeight = nav.offsetHeight;
                const targetPosition = targetElement.offsetTop - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ================================================
    // FAQ ACCORDION
    // ================================================
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', function() {
            const isActive = item.classList.contains('active');

            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });

            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // ================================================
    // SCROLL REVEAL ANIMATION
    // ================================================
    const revealElements = document.querySelectorAll('.problem-card, .feature-card, .step, .testimonial-card, .pricing-card');

    function reveal() {
        revealElements.forEach(element => {
            const windowHeight = window.innerHeight;
            const elementTop = element.getBoundingClientRect().top;
            const revealPoint = 100;

            if (elementTop < windowHeight - revealPoint) {
                element.classList.add('reveal', 'active');
            }
        });
    }

    // Add reveal class to elements
    revealElements.forEach(element => {
        element.classList.add('reveal');
    });

    window.addEventListener('scroll', reveal);
    reveal(); // Initial check

    // ================================================
    // SIZE CURVE MATRIX INTERACTION
    // ================================================
    const matrixCells = document.querySelectorAll('.stock-high, .stock-medium');

    matrixCells.forEach(cell => {
        cell.addEventListener('click', function() {
            // Visual feedback
            this.style.transform = 'scale(1.2)';
            setTimeout(() => {
                this.style.transform = '';
            }, 200);

            // Show tooltip or notification (placeholder)
            const stockValue = this.textContent;
            console.log(`Agregado al carrito - Stock: ${stockValue}`);
        });

        // Tooltip on hover
        cell.addEventListener('mouseenter', function() {
            const row = this.closest('tr');
            const colorLabel = row.querySelector('.color-label').textContent;
            const headerCells = this.closest('table').querySelectorAll('thead th');
            const cellIndex = Array.from(this.parentNode.children).indexOf(this);
            const size = headerCells[cellIndex].textContent;

            this.title = `${colorLabel} - Talle ${size} - Stock: ${this.textContent}`;
        });
    });

    // ================================================
    // ANIMATED COUNTER
    // ================================================
    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target.toLocaleString('es-AR');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString('es-AR');
            }
        }, 16);
    }

    // ================================================
    // PRICING AMOUNT ANIMATION
    // ================================================
    const pricingAmounts = document.querySelectorAll('.pricing-amount:not(.pricing-custom)');
    let pricingAnimated = false;

    function animatePricing() {
        if (pricingAnimated) return;

        const pricingSection = document.getElementById('precios');
        if (!pricingSection) return;

        const sectionTop = pricingSection.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (sectionTop < windowHeight - 100) {
            pricingAnimated = true;
            pricingAmounts.forEach(amount => {
                const value = parseInt(amount.textContent.replace(/\./g, ''));
                animateCounter(amount, value, 1500);
            });
        }
    }

    window.addEventListener('scroll', animatePricing);

    // ================================================
    // HERO ILLUSTRATION INTERACTIVITY
    // ================================================
    const heroIllustration = document.querySelector('.hero-illustration');
    if (heroIllustration) {
        // Add subtle parallax effect
        document.addEventListener('mousemove', function(e) {
            const x = (e.clientX / window.innerWidth - 0.5) * 20;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;
            heroIllustration.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    // ================================================
    // BUTTON RIPPLE EFFECT
    // ================================================
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // ================================================
    // TESTIMONIAL CAROUSEL (optional for mobile)
    // ================================================
    let currentTestimonial = 0;
    const testimonials = document.querySelectorAll('.testimonial-card');

    function showTestimonial(index) {
        if (window.innerWidth >= 768) return; // Only for mobile

        testimonials.forEach((card, i) => {
            card.style.display = i === index ? 'block' : 'none';
        });
    }

    // Auto-rotate testimonials on mobile
    setInterval(() => {
        if (window.innerWidth < 768) {
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            showTestimonial(currentTestimonial);
        }
    }, 5000);

    // Reset on resize
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            testimonials.forEach(card => {
                card.style.display = '';
            });
        }
    });

    // ================================================
    // FORM TRACKING (placeholder for analytics)
    // ================================================
    document.querySelectorAll('.btn-primary, .btn-white').forEach(button => {
        button.addEventListener('click', function() {
            const buttonText = this.textContent.trim();
            const section = this.closest('section');
            const sectionId = section ? section.id : 'unknown';

            // Log for analytics integration
            console.log('CTA Click:', {
                button: buttonText,
                section: sectionId,
                timestamp: new Date().toISOString()
            });

            // Here you would send to your analytics service
            // gtag('event', 'cta_click', { button: buttonText, section: sectionId });
        });
    });

    // ================================================
    // LAZY LOAD IMAGES (if needed)
    // ================================================
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // ================================================
    // KEYBOARD NAVIGATION
    // ================================================
    document.addEventListener('keydown', function(e) {
        // ESC to close mobile nav
        if (e.key === 'Escape') {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');

            // Close all FAQ items
            faqItems.forEach(item => {
                item.classList.remove('active');
            });
        }
    });

    // ================================================
    // PRINT STYLES
    // ================================================
    window.addEventListener('beforeprint', function() {
        // Expand all FAQ items for printing
        faqItems.forEach(item => {
            item.classList.add('active');
        });
    });

    // ================================================
    // CONSOLE BRANDING
    // ================================================
    console.log('%c Cianbox POS ', 'background: linear-gradient(135deg, #6366F1, #EC4899); color: white; font-size: 20px; padding: 10px 20px; border-radius: 8px;');
    console.log('%c El punto de venta para tiendas de moda ', 'color: #64748B; font-size: 12px;');
});

// ================================================
// PERFORMANCE OPTIMIZATION
// ================================================

// Debounce function for scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for frequent events
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
