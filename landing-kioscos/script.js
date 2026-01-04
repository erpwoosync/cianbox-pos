/**
 * Cianbox POS - Landing Kioscos
 * Interactividad basica
 */

document.addEventListener('DOMContentLoaded', function() {
    // ============================================
    // Mobile Menu Toggle
    // ============================================
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function() {
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
        });

        // Cerrar menu al hacer click en un link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
            });
        });
    }

    // ============================================
    // FAQ Accordion
    // ============================================
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(function(item) {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', function() {
            // Cerrar otros items abiertos
            faqItems.forEach(function(otherItem) {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle el item actual
            item.classList.toggle('active');
        });
    });

    // ============================================
    // Smooth Scroll para anchors
    // ============================================
    const anchors = document.querySelectorAll('a[href^="#"]');

    anchors.forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Solo si es un anchor valido (no solo #)
            if (href.length > 1) {
                const target = document.querySelector(href);

                if (target) {
                    e.preventDefault();

                    // Calcular offset considerando el header fijo
                    const headerHeight = 80;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ============================================
    // Header scroll effect
    // ============================================
    const header = document.querySelector('.header');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;

        // Agregar sombra cuando hay scroll
        if (currentScroll > 10) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.boxShadow = 'none';
        }

        lastScroll = currentScroll;
    });

    // ============================================
    // Animacion de numeros en stats
    // ============================================
    const stats = document.querySelectorAll('.stat-number');
    let statsAnimated = false;

    function animateStats() {
        if (statsAnimated) return;

        stats.forEach(function(stat) {
            const text = stat.textContent;
            const hasPlus = text.includes('+');
            const hasSeg = text.includes('seg');
            const hasPercent = text.includes('%');

            // Extraer el numero
            let number = parseFloat(text.replace(/[^0-9.]/g, ''));
            let decimals = text.includes('.') ? 1 : 0;

            if (isNaN(number)) return;

            let current = 0;
            const increment = number / 50;
            const duration = 1500;
            const stepTime = duration / 50;

            const timer = setInterval(function() {
                current += increment;

                if (current >= number) {
                    current = number;
                    clearInterval(timer);
                }

                let displayValue = current.toFixed(decimals);

                // Restaurar formato original
                if (hasPlus) displayValue = '+' + displayValue;
                if (hasSeg) displayValue = displayValue + ' seg';
                if (hasPercent) displayValue = displayValue + '%';

                stat.textContent = displayValue;
            }, stepTime);
        });

        statsAnimated = true;
    }

    // Observer para activar animacion cuando sea visible
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    animateStats();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(statsSection);
    }

    // ============================================
    // Tracking de CTAs (ejemplo con console.log)
    // En produccion, reemplazar con Google Analytics, etc.
    // ============================================
    const ctaButtons = document.querySelectorAll('.btn-primary, .btn-cta');

    ctaButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const buttonText = this.textContent.trim();
            const section = this.closest('section');
            const sectionClass = section ? section.className.split(' ')[0] : 'unknown';

            // Log para desarrollo - en produccion usar analytics
            console.log('CTA Click:', {
                button: buttonText,
                section: sectionClass,
                timestamp: new Date().toISOString()
            });

            // Ejemplo de evento para Google Analytics (descomentar si se usa)
            // if (typeof gtag !== 'undefined') {
            //     gtag('event', 'cta_click', {
            //         'button_text': buttonText,
            //         'section': sectionClass
            //     });
            // }
        });
    });

    // ============================================
    // Lazy loading para imagenes (si se agregan)
    // ============================================
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('img[data-src]');

        const imageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        lazyImages.forEach(function(img) {
            imageObserver.observe(img);
        });
    }

    // ============================================
    // Formulario de contacto (si se agrega)
    // ============================================
    const contactForm = document.querySelector('#contact-form');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Validacion basica
            const email = this.querySelector('[type="email"]');
            const name = this.querySelector('[name="name"]');

            if (!email.value || !email.value.includes('@')) {
                alert('Por favor, ingresa un email valido.');
                return;
            }

            // Aqui iria la logica de envio
            console.log('Form submitted:', {
                email: email.value,
                name: name ? name.value : ''
            });

            alert('Gracias! Te contactaremos pronto.');
            this.reset();
        });
    }

    // ============================================
    // Deteccion de dispositivo para ajustes
    // ============================================
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        document.body.classList.add('is-mobile');
    }

    // ============================================
    // Prevencion de scroll cuando menu esta abierto
    // ============================================
    function toggleBodyScroll(disable) {
        if (disable) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    // Observar cambios en el menu mobile
    if (mobileMenu) {
        const menuObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class') {
                    const isActive = mobileMenu.classList.contains('active');
                    toggleBodyScroll(isActive);
                }
            });
        });

        menuObserver.observe(mobileMenu, { attributes: true });
    }
});

// ============================================
// Utilidad: Debounce para eventos frecuentes
// ============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

// ============================================
// Utilidad: Throttle para eventos muy frecuentes
// ============================================
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const context = this;
        const args = arguments;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(function() {
                inThrottle = false;
            }, limit);
        }
    };
}
