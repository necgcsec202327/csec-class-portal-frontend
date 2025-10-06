document.getElementById('login-button').addEventListener('click', async () => {
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');
    
    if (!password) {
        errorMessage.textContent = 'Please enter the admin password.';
        return;
    }

    // Disable button during request
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    errorMessage.textContent = '';

    try {
        // Call the backend authentication API
        const response = await window.API.call(window.CONFIG.ENDPOINTS.AUTH, {
            method: 'POST',
            body: JSON.stringify({ key: password })
        });

        // Store the JWT token
        localStorage.setItem('authToken', response.token);
        sessionStorage.setItem('isAdmin', 'true');
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'Incorrect password or server error.';
        
        // Re-enable button
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

// Handle Enter key press
document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('login-button').click();
    }
});
