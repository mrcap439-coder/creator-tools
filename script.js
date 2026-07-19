// ==========================================
// Creator Tools - Main JavaScript
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // --- Theme Toggle ---
  const themeToggle = document.getElementById('themeToggle');
  const htmlElement = document.documentElement;
  
  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem('theme') || 'light';
  htmlElement.setAttribute('data-theme', savedTheme);
  
  if (themeToggle) {
    themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    
    themeToggle.addEventListener('click', () => {
      const currentTheme = htmlElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      htmlElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });
  }

  // --- Navbar Scroll Effect ---
  const navbar = document.getElementById('navbar');
  const handleNavbarScroll = () => {
    if (navbar) {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  };
  
  window.addEventListener('scroll', handleNavbarScroll);
  handleNavbarScroll(); // Initialize on load

  // --- Mobile Menu ---
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when a link is clicked
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // --- Smooth Scroll ---
  const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
  smoothScrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return; // Ignore top links (handled separately)
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const navbarHeight = navbar ? navbar.offsetHeight : 72; // Account for navbar height
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // --- Back to Top Smooth Scroll (Logo/Top Links) ---
  // Matches typical logo links pointing back to root/index
  const logoLinks = document.querySelectorAll('.navbar__logo, #navbar a[href="/"], #navbar a[href="index.html"]');
  logoLinks.forEach(logo => {
    logo.addEventListener('click', (e) => {
      const href = logo.getAttribute('href');
      // Only smooth scroll if we are already on the target page
      if (href === '#' || window.location.pathname.endsWith(href) || (href === '/' && window.location.pathname === '/')) {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    });
  });

  // --- Scroll Animations ---
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  if (animateElements.length > 0) {
    if ('IntersectionObserver' in window) {
      const animationObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Add staggered animation class
            entry.target.classList.add('animated');
            observer.unobserve(entry.target); // Unobserve after animating once
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      animateElements.forEach(el => {
        animationObserver.observe(el);
      });
    } else {
      // Fallback for browsers without IntersectionObserver
      animateElements.forEach(el => el.classList.add('animated'));
    }
  }

  // --- FAQ Accordion ---
  const faqItems = document.querySelectorAll('.faq__item');
  if (faqItems.length > 0) {
    faqItems.forEach(item => {
      const question = item.querySelector('.faq__question');
      if (question) {
        question.addEventListener('click', () => {
          const isActive = item.classList.contains('active');
          
          // Close all other items (only one open at a time)
          faqItems.forEach(otherItem => {
            otherItem.classList.remove('active');
          });

          // Toggle current item
          if (!isActive) {
            item.classList.add('active');
          }
        });
      }
    });
  }

  // --- Product Search & Filter ---
  const searchInput = document.querySelector('.filter-bar__search') || document.getElementById('searchInput');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card');
  
  if ((searchInput || filterButtons.length > 0) && productCards.length > 0) {
    // Create and insert a "No Results" message dynamically if it doesn't exist
    let noResultsMsg = document.querySelector('.no-results-message');
    if (!noResultsMsg) {
      noResultsMsg = document.createElement('div');
      noResultsMsg.className = 'no-results-message';
      noResultsMsg.textContent = 'No products found matching your criteria.';
      noResultsMsg.style.display = 'none';
      noResultsMsg.style.width = '100%';
      noResultsMsg.style.textAlign = 'center';
      noResultsMsg.style.padding = '2rem';
      noResultsMsg.style.fontSize = '1.1rem';
      noResultsMsg.style.opacity = '0.8';
      
      // Append after the products container
      const container = productCards[0].parentElement;
      if (container) {
        container.appendChild(noResultsMsg);
      }
    }

    let currentCategory = 'all';
    let currentSearchTerm = '';

    const filterProducts = () => {
      let visibleCount = 0;

      productCards.forEach(card => {
        const category = card.getAttribute('data-category') || '';
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        
        const matchesCategory = currentCategory === 'all' || category === currentCategory;
        const matchesSearch = name.includes(currentSearchTerm);

        if (matchesCategory && matchesSearch) {
          card.style.display = 'block'; // Assume block/flex is default, card classes will handle layout
          
          // Trigger re-animation if element supports it
          if (card.classList.contains('animate-on-scroll')) {
            card.classList.remove('animated');
            // Small delay to allow reflow
            setTimeout(() => card.classList.add('animated'), 10);
          }
          
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      // Show or hide the no results message
      if (noResultsMsg) {
        noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    };

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        filterProducts();
      });
    }

    if (filterButtons.length > 0) {
      filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // Update active states on buttons
          filterButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          currentCategory = btn.getAttribute('data-category') || 'all';
          filterProducts();
        });
      });
    }
  }

  // --- Plan Selection ---
  const planCards = document.querySelectorAll('.plan-card');
  if (planCards.length > 0) {
    planCards.forEach(card => {
      card.addEventListener('click', () => {
        // Remove selected from siblings
        planCards.forEach(c => c.classList.remove('selected'));
        // Add selected to clicked card
        card.classList.add('selected');
      });
    });
  }

  // --- WhatsApp Order ---
  const orderBtn = document.getElementById('orderBtn');
  if (orderBtn) {
    orderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      const selectedPlan = document.querySelector('.plan-card.selected');
      if (!selectedPlan) {
        alert('Please select a plan first!');
        return;
      }

      // Extract plan details
      const planNameElement = selectedPlan.querySelector('.plan-card__name');
      const planPriceElement = selectedPlan.querySelector('.plan-card__price');
      const productTitleElement = document.querySelector('.product-detail__title');

      const planName = planNameElement ? planNameElement.textContent.trim() : 'Selected Plan';
      const planPrice = planPriceElement ? planPriceElement.textContent.trim() : 'Price TBD';
      const productTitle = productTitleElement ? productTitleElement.textContent.trim() : 'Digital Product';

      const message = `Hi! I want to order:
  
Product: ${productTitle}
Plan: ${planName}
Price: ${planPrice}
  
Please share payment details.`;

      const encodedMessage = encodeURIComponent(message);
      // Optional: Replace with a specific phone number if required, e.g. https://wa.me/1234567890?text=...
      const whatsappUrl = `https://wa.me/923126575447?text=${encodedMessage}`;
      
      // Open WhatsApp in a new tab
      window.open(whatsappUrl, '_blank');
    });
  }

  // --- Active Nav Highlighting ---
  const sections = document.querySelectorAll('section[id]');
  // Only run if there are sections to track (e.g. on home page)
  if (sections.length > 0) {
    const highlightNavOnScroll = () => {
      let scrollY = window.scrollY;
      const navbarHeight = navbar ? navbar.offsetHeight : 72;

      sections.forEach(current => {
        const sectionHeight = current.offsetHeight;
        // Offset mapping to trigger slightly before the section reaches the exact top
        const sectionTop = current.offsetTop - navbarHeight - 10;
        const sectionId = current.getAttribute('id');
        
        // Find matching nav link
        const navLink = document.querySelector(`#navLinks a[href="#${sectionId}"]`);

        if (navLink) {
          if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLink.classList.add('active');
          } else {
            navLink.classList.remove('active');
          }
        }
      });
    };
    
    window.addEventListener('scroll', highlightNavOnScroll);
    highlightNavOnScroll(); // Initial check on load
  }

  // --- Auto-link Product Cards to Dynamic Detail Page ---
  if (window.productsData) {
    // Build a name-to-slug lookup
    const nameToSlug = {};
    Object.keys(window.productsData).forEach(slug => {
      const name = window.productsData[slug].name.toLowerCase().trim();
      nameToSlug[name] = slug;
    });

    // Update all "View Plans" links
    document.querySelectorAll('.product-card').forEach(card => {
      const nameAttr = card.getAttribute('data-name');
      const titleEl = card.querySelector('.product-card__title');
      const productName = (nameAttr || (titleEl ? titleEl.textContent : '')).toLowerCase().trim();
      
      const slug = nameToSlug[productName];
      if (slug) {
        const ctaLink = card.querySelector('.product-card__cta');
        if (ctaLink) {
          ctaLink.href = 'product-detail.html?id=' + slug;
        }
      }
    });
  }

});
