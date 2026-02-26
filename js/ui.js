// frontend/js/ui.js
const Toast = {
    init() {
        if (!document.getElementById('toast-provider')) {
            const container = document.createElement('div');
            container.id = 'toast-provider';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    },

    show(message, type = 'info', duration = 5000) {
        this.init();
        const container = document.getElementById('toast-provider');
        const toast = document.createElement('div');
        toast.className = `toast-item ${type}`;

        // Errors should stay longer or potentially forever until clicked
        if (type === 'error') duration = 10000;
        if (type === 'warning') duration = 7000;

        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            info: 'fa-circle-info',
            warning: 'fa-triangle-exclamation'
        };

        const icon = icons[type] || icons.info;

        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${icon} toast-icon"></i>
                <div class="toast-msg">${message}</div>
            </div>
            <div class="toast-progress"></div>
        `;

        const progressBar = toast.querySelector('.toast-progress');
        if (progressBar) {
            progressBar.style.animationDuration = `${duration}ms`;
        }

        container.appendChild(toast);

        // State for pause/resume
        let timer;
        let start = Date.now();
        let remaining = duration;

        const setTimer = (delay) => {
            timer = setTimeout(() => this.dismiss(toast), delay);
        };

        // Initialize timer
        setTimer(remaining);

        // Interaction: Pause on hover
        toast.onmouseenter = () => {
            clearTimeout(timer);
            remaining -= Date.now() - start;
            if (progressBar) progressBar.style.animationPlayState = 'paused';
        };

        toast.onmouseleave = () => {
            start = Date.now();
            if (remaining > 0) {
                setTimer(remaining);
                if (progressBar) progressBar.style.animationPlayState = 'running';
            }
        };

        // Manual dismiss on click
        toast.onclick = () => {
            clearTimeout(timer);
            this.dismiss(toast);
        };
    },

    dismiss(toast) {
        if (toast.classList.contains('dismissing')) return;
        toast.classList.add('dismissing');

        // Ensure we only remove when the toastItem's own animation ends
        toast.addEventListener('animationend', (e) => {
            if (e.animationName === 'toastSlideOut') {
                toast.remove();
            }
        }, { once: true });
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
    warn(msg) { this.show(msg, 'warning'); }
};

// Button Loading Utility
const UiUtils = {
    setBtnLoading(btn, isLoading, customText = null) {
        if (!btn) return;
        if (isLoading) {
            btn.setAttribute('data-original-html', btn.innerHTML);
            btn.disabled = true;
            btn.classList.add('loading-state');
            btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${customText || 'Processing...'}`;
        } else {
            btn.disabled = false;
            btn.classList.remove('loading-state');
            btn.innerHTML = btn.getAttribute('data-original-html') || 'Continue';
        }
    }
};

// Global Initialization
document.addEventListener('DOMContentLoaded', () => Toast.init());
