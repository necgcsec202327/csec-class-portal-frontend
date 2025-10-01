document.getElementById('login-button').addEventListener('click', () => {
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // This is a simple, insecure password check.
    // In a real application, you would use a more secure method.
    if (password === 'admin123') {
        sessionStorage.setItem('isAdmin', 'true');
        window.location.href = 'dashboard.html';
    } else {
        errorMessage.textContent = 'Incorrect password.';
    }
});
