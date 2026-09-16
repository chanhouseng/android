const form = document.querySelector('#login-form');
const passwordInput = document.querySelector('#password');
const submitButton = document.querySelector('#login-submit');
const errorMessage = document.querySelector('#login-error');

function showLoginError() {
  errorMessage.textContent = '登入未完成，請確認密碼後再試。';
  errorMessage.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const initialLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = submitButton.dataset.loadingLabel;
  errorMessage.hidden = true;

  try {
    const response = await fetch('api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    const result = await response.json();
    if (!response.ok || result.authenticated !== true) throw new Error('login failed');
    window.location.assign('./');
  } catch {
    submitButton.disabled = false;
    submitButton.textContent = initialLabel;
    showLoginError();
  }
});
