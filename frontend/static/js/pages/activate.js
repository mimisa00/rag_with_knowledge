// ========================================
// 帳號啟用頁面邏輯
// ========================================

class ActivatePage {
    constructor() {
        this.token = this.getTokenFromUrl();
        this.userInfo = null;
        this.passwordRequirements = null;
        
        this.initializeElements();
        this.bindEvents();
        
        if (this.token) {
            this.verifyToken();
        } else {
            this.showError('連結無效', '啟用連結格式錯誤，請檢查連結是否完整。');
        }
    }

    initializeElements() {
        // 狀態元素
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.successState = document.getElementById('successState');
        this.activationForm = document.getElementById('activationForm');

        // 錯誤資訊元素
        this.errorTitle = document.getElementById('errorTitle');
        this.errorMessage = document.getElementById('errorMessage');

        // 使用者資訊元素
        this.userName = document.getElementById('userName');
        this.userEmail = document.getElementById('userEmail');

        // 表單元素
        this.setPasswordForm = document.getElementById('setPasswordForm');
        this.newPasswordInput = document.getElementById('newPassword');
        this.confirmPasswordInput = document.getElementById('confirmPassword');
        this.submitBtn = document.getElementById('submitBtn');

        // 密碼強度元素
        this.passwordStrength = document.getElementById('passwordStrength');
        this.strengthFill = this.passwordStrength.querySelector('.strength-fill');
        this.strengthText = this.passwordStrength.querySelector('.strength-text');

        // 密碼確認元素
        this.passwordMatch = document.getElementById('passwordMatch');

        // 密碼要求元素
        this.passwordRequirementsEl = document.getElementById('passwordRequirements');
        this.requirementElements = {
            length: document.getElementById('req-length'),
            uppercase: document.getElementById('req-uppercase'),
            lowercase: document.getElementById('req-lowercase'),
            number: document.getElementById('req-number'),
            special: document.getElementById('req-special')
        };
    }

    bindEvents() {
        if (this.setPasswordForm) {
            this.setPasswordForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.newPasswordInput) {
            this.newPasswordInput.addEventListener('input', () => this.checkPassword());
        }

        if (this.confirmPasswordInput) {
            this.confirmPasswordInput.addEventListener('input', () => this.checkPasswordMatch());
        }
    }

    getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token');
    }

    async verifyToken() {
        try {
            const response = await fetch('/api/auth/verify-activation-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: this.token })
            });

            const result = await response.json();

            if (response.ok && result.valid) {
                this.userInfo = result.user;
                this.passwordRequirements = result.password_requirements;
                this.showActivationForm();
            } else {
                const errorMsg = result.message || '啟用連結驗證失敗';
                this.showError('連結驗證失敗', errorMsg);
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.showError('系統錯誤', '無法連接到伺服器，請稍後再試。');
        }
    }

    showActivationForm() {
        this.loadingState.classList.add('d-none');
        this.activationForm.classList.remove('d-none');
        
        // 顯示使用者資訊
        this.userName.textContent = this.userInfo.name;
        this.userEmail.textContent = this.userInfo.email;
        
        // 更新密碼要求顯示
        this.updatePasswordRequirementsDisplay();
    }

    showError(title, message) {
        this.loadingState.classList.add('d-none');
        this.activationForm.classList.add('d-none');
        this.successState.classList.add('d-none');
        
        this.errorTitle.textContent = title;
        this.errorMessage.textContent = message;
        this.errorState.classList.remove('d-none');
    }

    showSuccess() {
        this.loadingState.classList.add('d-none');
        this.activationForm.classList.add('d-none');
        this.errorState.classList.add('d-none');
        this.successState.classList.remove('d-none');
    }

    updatePasswordRequirementsDisplay() {
        if (!this.passwordRequirements) return;

        const requirements = this.passwordRequirements;
        const reqElements = this.requirementElements;

        // 更新最小長度要求
        if (reqElements.length) {
            const lengthText = `至少 ${requirements.min_length || 8} 個字元`;
            reqElements.length.querySelector('span') || 
            (reqElements.length.innerHTML = `<i class="fas fa-times"></i> ${lengthText}`);
        }

        // 顯示/隱藏特定要求
        if (!requirements.require_uppercase && reqElements.uppercase) {
            reqElements.uppercase.style.display = 'none';
        }
        if (!requirements.require_lowercase && reqElements.lowercase) {
            reqElements.lowercase.style.display = 'none';
        }
        if (!requirements.require_numbers && reqElements.number) {
            reqElements.number.style.display = 'none';
        }
        if (!requirements.require_special_chars && reqElements.special) {
            reqElements.special.style.display = 'none';
        }
    }

    checkPassword() {
        const password = this.newPasswordInput.value;
        
        if (!password) {
            this.resetPasswordStrength();
            this.resetPasswordRequirements();
            return;
        }

        // 檢查密碼強度
        const strength = this.calculatePasswordStrength(password);
        this.updatePasswordStrength(strength);
        
        // 檢查密碼要求
        this.checkPasswordRequirements(password);
        
        // 檢查密碼匹配
        this.checkPasswordMatch();
    }

    calculatePasswordStrength(password) {
        let score = 0;
        const checks = {
            length: password.length >= (this.passwordRequirements?.min_length || 8),
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };

        // 根據密碼策略計分
        if (checks.length) score++;
        if (!this.passwordRequirements?.require_uppercase || checks.uppercase) score++;
        if (!this.passwordRequirements?.require_lowercase || checks.lowercase) score++;
        if (!this.passwordRequirements?.require_numbers || checks.number) score++;
        if (!this.passwordRequirements?.require_special_chars || checks.special) score++;

        return {
            score: score,
            maxScore: 5,
            level: score <= 2 ? 'weak' : score <= 3 ? 'fair' : score <= 4 ? 'good' : 'strong',
            valid: this.isPasswordValid(password)
        };
    }

    isPasswordValid(password) {
        if (!this.passwordRequirements) return false;
        
        const req = this.passwordRequirements;
        
        return password.length >= (req.min_length || 8) &&
               (!req.require_uppercase || /[A-Z]/.test(password)) &&
               (!req.require_lowercase || /[a-z]/.test(password)) &&
               (!req.require_numbers || /\d/.test(password)) &&
               (!req.require_special_chars || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password));
    }

    updatePasswordStrength(strength) {
        this.strengthFill.className = `strength-fill ${strength.level}`;
        
        const strengthTexts = {
            weak: '密碼強度：弱',
            fair: '密碼強度：普通',
            good: '密碼強度：良好',
            strong: '密碼強度：強'
        };
        
        this.strengthText.textContent = strengthTexts[strength.level];
    }

    resetPasswordStrength() {
        this.strengthFill.className = 'strength-fill';
        this.strengthText.textContent = '密碼強度：請輸入密碼';
    }

    checkPasswordRequirements(password) {
        const req = this.passwordRequirements;
        if (!req) return;

        const checks = {
            length: password.length >= (req.min_length || 8),
            uppercase: !req.require_uppercase || /[A-Z]/.test(password),
            lowercase: !req.require_lowercase || /[a-z]/.test(password),
            number: !req.require_numbers || /\d/.test(password),
            special: !req.require_special_chars || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };

        Object.entries(checks).forEach(([key, passed]) => {
            const element = this.requirementElements[key];
            if (element) {
                element.classList.toggle('valid', passed);
            }
        });
    }

    resetPasswordRequirements() {
        Object.values(this.requirementElements).forEach(element => {
            if (element) {
                element.classList.remove('valid');
            }
        });
    }

    checkPasswordMatch() {
        const password = this.newPasswordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        if (!confirmPassword) {
            this.passwordMatch.classList.remove('show');
            return;
        }

        this.passwordMatch.classList.add('show');
        
        if (password === confirmPassword) {
            this.passwordMatch.textContent = '密碼匹配';
            this.passwordMatch.className = 'password-match show match';
        } else {
            this.passwordMatch.textContent = '密碼不匹配';
            this.passwordMatch.className = 'password-match show no-match';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const password = this.newPasswordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        // 基本驗證
        if (!password || !confirmPassword) {
            Dialog.error('請填寫所有必填欄位');
            return;
        }

        if (password !== confirmPassword) {
            Dialog.error('密碼與確認密碼不匹配');
            return;
        }

        if (!this.isPasswordValid(password)) {
            Dialog.error('密碼不符合安全要求，請檢查密碼要求');
            return;
        }

        // 提交密碼設定
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';

        try {
            const response = await fetch('/api/auth/activate-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: this.token,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess();
                Dialog.success('帳號啟用成功！', '歡迎加入');
            } else {
                const errorMsg = result.message || '帳號啟用失敗';
                Dialog.error(errorMsg, '啟用失敗');
            }
        } catch (error) {
            console.error('Activation error:', error);
            Dialog.error('系統錯誤，請稍後再試', '啟用失敗');
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = '<i class="fas fa-check"></i> 完成啟用';
        }
    }
}

// ========================================
// 全域函數
// ========================================

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.password-toggle i');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        button.className = 'fas fa-eye';
    }
}

async function requestNewActivation() {
    if (!window.activatePage?.userInfo?.email) {
        Dialog.error('無法取得使用者資訊');
        return;
    }

    const confirmed = await Dialog.confirm(
        '確定要重新發送啟用郵件嗎？',
        null,
        {
            confirmText: '發送',
            cancelText: '取消'
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch('/api/auth/resend-activation-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: window.activatePage.userInfo.email
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            Dialog.success('啟用郵件已重新發送，請檢查您的信箱');
        } else {
            Dialog.error(result.message || '重新發送失敗');
        }
    } catch (error) {
        console.error('Resend activation email error:', error);
        Dialog.error('系統錯誤，請稍後再試');
    }
}

function goToLogin() {
    window.location.href = '/login';
}

// ========================================
// 頁面初始化
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    window.activatePage = new ActivatePage();
});