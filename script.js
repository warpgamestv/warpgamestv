document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SMOOTH SCROLLING FOR NAV LINKS ---
    // Selects all navigation links that start with '#'
    const navLinks = document.querySelectorAll('nav a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Prevents the default jumpy behavior
            e.preventDefault();
            
            // Gets the target section's ID from the link's href
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            // Scrolls smoothly to the target section
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // --- 2. FADE-IN ANIMATIONS ON SCROLL ---
    // Create an observer to watch for elements entering the viewport
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // If the element is visible, add the 'show' class to trigger the animation
                entry.target.classList.add('show');
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of the element is visible
    });

    // Select all elements you want to animate
    const hiddenElements = document.querySelectorAll('section h2, .about-text, .about-image, .project-card, .social-links, .contact-form');
    // Tell the observer to watch each of these elements
    hiddenElements.forEach(el => {
        el.classList.add('hidden'); // Initially hide them
        observer.observe(el);
    });

    // --- 3. ACTIVE NAVIGATION LINK HIGHLIGHTING ON SCROLL ---
    const sections = document.querySelectorAll('section[id]');
    
    // Create an observer that watches the sections
    const navObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove 'active' class from all nav links
                document.querySelectorAll('nav a.active').forEach(link => {
                    link.classList.remove('active');
                });
                
                // Add 'active' class to the link corresponding to the visible section
                const id = entry.target.getAttribute('id');
                const activeLink = document.querySelector(`nav a[href="#${id}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, {
        rootMargin: '-50% 0px -50% 0px' // Highlights when the section is in the middle of the screen
    });
    
    // Tell the nav observer to watch each section
    sections.forEach(section => {
        navObserver.observe(section);
    });

    // --- BONUS: CONTACT FORM SUBMISSION FEEDBACK ---
    const contactForm = document.querySelector('.contact-form');
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Stop the form from actually submitting/reloading
        alert('Thank you for your message! I will get back to you soon.');
        this.reset(); // Clear the form fields
    });

});