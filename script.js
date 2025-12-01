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
    // --- 4. HEADER SCROLL EFFECT ---
    const header = document.querySelector('.site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

// --- 5. MOBILE MENU TOGGLE ---
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.main-nav ul'); // or '.nav-links'

if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('open');
    });
}
    // --- 6. TWITCH LIVE STATUS CHECKER ---
    const channelName = 'warpgamestv'; // Your Twitch handle
    const liveBtn = document.getElementById('live-btn');
    const liveText = document.getElementById('live-text');

    if (liveBtn) {
        // We use decapi.me as a proxy to avoid CORS issues with the official Twitch API
        fetch(`https://decapi.me/twitch/uptime/${channelName}`)
            .then(response => response.text())
            .then(data => {
                // If the user is offline, the API returns "warpgamestv is offline"
                // If the user is LIVE, it returns the uptime (e.g., "1 hour, 20 minutes")
                
                if (!data.includes('offline')) {
                    // STREAM IS LIVE!
                    liveBtn.classList.add('is-live');
                    liveText.textContent = 'LIVE NOW';
                    
                    // Optional: Update the "Offline" text to show uptime?
                    // liveText.textContent = 'LIVE: ' + data; 
                } else {
                    // STREAM IS OFFLINE
                    liveBtn.classList.remove('is-live');
                    liveText.textContent = 'Watch on Twitch'; // Standard text
                    
                    // Optional: Add a Twitch icon if offline
                    // liveBtn.innerHTML = '<i class="fab fa-twitch"></i> Watch on Twitch';
                }
            })
            .catch(error => {
                console.error('Error checking Twitch status:', error);
                // Fallback state
                liveText.textContent = 'Twitch Channel';
            });
    }

    // --- 8. KONAMI CODE EASTER EGG ---
    const konamiCode = [
        'ArrowUp', 'ArrowUp', 
        'ArrowDown', 'ArrowDown', 
        'ArrowLeft', 'ArrowRight', 
        'ArrowLeft', 'ArrowRight', 
        'b', 'a'
    ];
    let konamiIndex = 0;

    document.addEventListener('keydown', (e) => {
        // Check if the key pressed matches the next key in the sequence
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            
            // If the full code is entered
            if (konamiIndex === konamiCode.length) {
                activateWarpMode();
                konamiIndex = 0; // Reset
            }
        } else {
            konamiIndex = 0; // Reset if they mess up
        }
    });

    function activateWarpMode() {
        alert("🌀 WARP SPEED ACTIVATED! 🌀");
        document.body.classList.toggle('warp-mode');
    }

});