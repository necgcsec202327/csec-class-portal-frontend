document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const btnText = loginButton.querySelector('.btn-text');
    const btnLoader = loginButton.querySelector('.btn-loader');

    const API_BASE = (window.CONFIG && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL : '';

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            showError('Please enter the admin key');
            return;
        }

        // Show loading state
        setLoading(true);
        hideError();

        try {
            // Call backend auth endpoint
            const resp = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: password })
            });

            if (!resp.ok) {
                const data = await safeJson(resp);
                throw new Error(data && data.error ? data.error : 'Authentication failed');
            }

            const data = await resp.json();
            const token = data.token;
            if (!token) throw new Error('Invalid response from server');

            // Persist admin session and token
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('authToken', token);
            // Also store in localStorage for API utilities if needed
            localStorage.setItem('authToken', token);

            // Success animation
            btnText.textContent = 'Success!';
            loginButton.style.background = 'var(--success-color)';

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 400);
        } catch (err) {
            setLoading(false);
            showError(err.message || 'Login failed');
            passwordInput.focus();
            passwordInput.select();
        }
    });

    // Handle Enter key
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });

    // Auto-focus password field
    passwordInput.focus();

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loginButton.classList.add('loading');
            loginButton.disabled = true;
            if (btnLoader) btnLoader.style.display = 'inline-block';
            if (btnText) btnText.textContent = 'Signing in...';
        } else {
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
            if (btnLoader) btnLoader.style.display = 'none';
            if (btnText) btnText.textContent = 'Sign In';
        }
    }

    async function safeJson(resp) {
        try {
            return await resp.json();
        } catch {
            return null;
        }
    }
});
