document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const btnText = loginButton.querySelector('.btn-text');
    const btnLoader = loginButton.querySelector('.btn-loader');

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            showError('Please enter a password');
            return;
        }

        // Show loading state
        loginButton.classList.add('loading');
        loginButton.disabled = true;
        hideError();

        // Simulate API call delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simple password check (in production, this would be server-side)
        if (password === 'admin123') {
            sessionStorage.setItem('isAdmin', 'true');
            
            // Success animation
            btnText.textContent = 'Success!';
            loginButton.style.background = 'var(--success-color)';
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            // Reset button state
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
            
            showError('Incorrect password. Please try again.');
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
});
