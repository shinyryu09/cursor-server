class InstallerApp {
    constructor() {
        this.currentStep = 0;
        this.installPath = '';
        this.isInstalling = false;
        
        this.initializeEventListeners();
        this.setupElectronListeners();
    }

    initializeEventListeners() {
        // 이벤트 리스너는 DOM이 로드된 후에 설정됩니다
        document.addEventListener('DOMContentLoaded', () => {
            this.setupUI();
        });
    }

    setupUI() {
        // 초기 UI 설정
        this.updateStepDisplay();
    }

    setupElectronListeners() {
        if (window.electronAPI) {
            // 상태 업데이트 리스너
            window.electronAPI.onStatusUpdate((status) => {
                this.updateInstallProgress(status);
            });

            // 로그 업데이트 리스너
            window.electronAPI.onLogUpdate((log) => {
                this.addLogEntry(log);
            });
        }
    }

    nextStep() {
        if (this.currentStep < 3) {
            this.currentStep++;
            this.updateStepDisplay();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    updateStepDisplay() {
        // 모든 섹션 숨기기
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => section.classList.remove('active'));

        // 모든 스텝 아이템 비활성화
        const stepItems = document.querySelectorAll('.step-item');
        stepItems.forEach((item, index) => {
            item.classList.remove('active', 'completed');
            if (index < this.currentStep) {
                item.classList.add('completed');
            } else if (index === this.currentStep) {
                item.classList.add('active');
            }
        });

        // 현재 섹션 표시
        const sectionIds = ['welcome', 'path-selection', 'installation', 'completion'];
        const currentSection = document.getElementById(sectionIds[this.currentStep]);
        if (currentSection) {
            currentSection.classList.add('active');
        }

        // 버튼 상태 업데이트
        this.updateButtonStates();
    }

    updateButtonStates() {
        const pathNextBtn = document.getElementById('path-next-btn');
        const installPrevBtn = document.getElementById('install-prev-btn');
        const installStartBtn = document.getElementById('install-start-btn');

        if (pathNextBtn) {
            pathNextBtn.disabled = !this.installPath;
        }

        if (installPrevBtn) {
            installPrevBtn.disabled = this.isInstalling;
        }

        if (installStartBtn) {
            installStartBtn.disabled = this.isInstalling;
            installStartBtn.textContent = this.isInstalling ? '설치 중...' : '설치 시작';
        }
    }

    async selectPath() {
        try {
            const path = await window.electronAPI.selectInstallPath();
            if (path) {
                this.installPath = path;
                document.getElementById('install-path').value = path;
                this.updateButtonStates();
            }
        } catch (error) {
            this.showError('경로 선택 실패: ' + error.message);
        }
    }

    async startInstallation() {
        if (!this.installPath) {
            this.showError('설치 경로를 선택해주세요.');
            return;
        }

        this.isInstalling = true;
        this.updateButtonStates();

        // 로그 컨테이너 초기화
        const logContainer = document.getElementById('log-container');
        logContainer.innerHTML = '';

        try {
            const result = await window.electronAPI.startInstallation({
                installPath: this.installPath
            });

            if (result.success) {
                this.currentStep = 3; // 완료 화면으로 이동
                this.updateStepDisplay();
            } else {
                this.showError('설치 실패: ' + result.error);
                this.isInstalling = false;
                this.updateButtonStates();
            }
        } catch (error) {
            this.showError('설치 중 오류 발생: ' + error.message);
            this.isInstalling = false;
            this.updateButtonStates();
        }
    }

    updateInstallProgress(status) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill) {
            progressFill.style.width = status.progress + '%';
        }

        if (progressText) {
            progressText.textContent = `${status.currentStep} (${status.progress}%)`;
        }
    }

    addLogEntry(log) {
        const logContainer = document.getElementById('log-container');
        if (!logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${log.type}`;
        
        logEntry.innerHTML = `
            <span class="log-timestamp">[${log.timestamp}]</span>
            <span class="log-message">${log.message}</span>
        `;

        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    async startServer() {
        try {
            const result = await window.electronAPI.startServer();
            if (result.success) {
                this.showSuccess('서버가 성공적으로 시작되었습니다!');
            } else {
                this.showError('서버 시작 실패: ' + result.error);
            }
        } catch (error) {
            this.showError('서버 시작 중 오류 발생: ' + error.message);
        }
    }

    async openFolder() {
        try {
            await window.electronAPI.openExternal(this.installPath);
        } catch (error) {
            this.showError('폴더 열기 실패: ' + error.message);
        }
    }

    async openDocs() {
        try {
            await window.electronAPI.openExternal('https://github.com/shinyryu09/cursor-server');
        } catch (error) {
            this.showError('문서 열기 실패: ' + error.message);
        }
    }

    showError(message) {
        // 간단한 에러 표시 (실제로는 더 정교한 모달이나 토스트를 사용할 수 있음)
        alert('오류: ' + message);
    }

    showSuccess(message) {
        // 간단한 성공 메시지 표시
        alert('성공: ' + message);
    }
}

// 전역 함수들 (HTML에서 호출)
let app;

function nextStep() {
    app.nextStep();
}

function prevStep() {
    app.prevStep();
}

function selectPath() {
    app.selectPath();
}

function startInstallation() {
    app.startInstallation();
}

function startServer() {
    app.startServer();
}

function openFolder() {
    app.openFolder();
}

function openDocs() {
    app.openDocs();
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    app = new InstallerApp();
});

