document.addEventListener('DOMContentLoaded', () => {

    // --- 1. FADE-IN ANIMATIONS ON SCROLL ---
    // This works perfectly on a multi-page site without any changes.
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
            }
        });
    }, {
        threshold: 0.1
    });

    const hiddenElements = document.querySelectorAll('.hidden');
    hiddenElements.forEach(el => observer.observe(el));


    // --- 2. ACTIVE NAVIGATION LINK HIGHLIGHTING (FOR MULTI-PAGE SITES) ---
    // This new code checks the current page URL and highlights the corresponding link.
    const currentPage = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('.main-nav ul a');

    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });

    // Special case for the homepage (index.html)
    if (currentPage === '' || currentPage === 'index.html') {
         // This assumes there isn't a "Home" link, but you could add one
         // Or highlight the logo, though that's less common.
    }


    // --- 3. CONTACT FORM SUBMISSION FEEDBACK ---
    const contactForm = document.querySelector('.contact-form');
    
    // We add a check to make sure the form exists on the page before adding the event listener.
    // This prevents errors on pages that don't have the contact form.
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Stop the form from actually submitting/reloading
            alert('Thank you for your message! I will get back to you soon.');
            this.reset(); // Clear the form fields
        });
    }

});