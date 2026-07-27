/**
 * OrdiveX — Cinematic Feedback (Lottie)
 */

const Feedback = {
    // URLs for lottie animations (success and loading)
    animations: {
        success: 'https://assets9.lottiefiles.com/packages/lf20_pqnfbxw9.json', // Checkmark green
        loading: 'https://assets10.lottiefiles.com/packages/lf20_p8bfn5to.json', // Dots loading
    },

    trigger(type = 'success', message = '') {
        const existing = document.getElementById('feedback-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'feedback-overlay';
        overlay.className = 'feedback-overlay';

        const content = type === 'success' ? `
            <svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="success-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="success-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
        ` : `<div class="feedback-loader"></div>`;

        overlay.innerHTML = `
            <div class="feedback-container">
                ${content}
                ${message ? `<div class="feedback-message">${message}</div>` : ''}
            </div>
        `;
        document.body.appendChild(overlay);

        // Durée optimisée : 1.5 secondes (professionnel et rapide)
        setTimeout(() => {
            overlay.style.pointerEvents = 'none';
            overlay.classList.add('hide');
            setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 400);
        }, 1500);
    }
};

window.triggerFeedback = (type, msg) => Feedback.trigger(type, msg);
