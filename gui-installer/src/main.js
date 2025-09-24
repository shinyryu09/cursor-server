import electron from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { app, BrowserWindow, ipcMain, dialog, shell } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class InstallerApp {
  constructor() {
    this.mainWindow = null;
    this.installPath = '';
    this.installStatus = {
      step: 0,
      totalSteps: 6,
      currentStep: '',
      progress: 0,
      logs: []
    };
  }

  async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 700,
      minHeight: 500,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: 'hiddenInset',
      show: false
    });

    await this.mainWindow.loadFile(path.join(__dirname, 'index.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupIPC() {
    // 설치 경로 선택
    ipcMain.handle('select-install-path', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: '설치 경로 선택',
        defaultPath: path.join(process.env.HOME, 'Documents')
      });

      if (!result.canceled) {
        this.installPath = result.filePaths[0];
        return this.installPath;
      }
      return null;
    });

    // 설치 시작
    ipcMain.handle('start-installation', async (event, options) => {
      try {
        await this.performInstallation(options);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 설치 상태 조회
    ipcMain.handle('get-install-status', () => {
      return this.installStatus;
    });

    // 로그 조회
    ipcMain.handle('get-logs', () => {
      return this.installStatus.logs;
    });

    // 외부 링크 열기
    ipcMain.handle('open-external', async (event, url) => {
      await shell.openExternal(url);
    });

    // 설치 완료 후 서버 시작
    ipcMain.handle('start-server', async () => {
      try {
        await this.startServer();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  async performInstallation(options) {
    this.installStatus = {
      step: 0,
      totalSteps: 6,
      currentStep: '',
      progress: 0,
      logs: []
    };

    try {
      // 1. 시스템 요구사항 확인
      await this.updateStatus(1, '시스템 요구사항 확인 중...', 16);
      await this.checkSystemRequirements();

      // 2. 저장소 클론
      await this.updateStatus(2, '저장소 클론 중...', 33);
      await this.cloneRepository();

      // 3. 의존성 설치
      await this.updateStatus(3, '의존성 설치 중...', 50);
      await this.installDependencies();

      // 4. 환경 변수 설정
      await this.updateStatus(4, '환경 변수 설정 중...', 66);
      await this.setupEnvironment();

      // 5. Cursor Editor 확인
      await this.updateStatus(5, 'Cursor Editor 확인 중...', 83);
      await this.checkCursorEditor();

      // 6. 설치 완료
      await this.updateStatus(6, '설치 완료!', 100);
      this.addLog('✅ 설치가 성공적으로 완료되었습니다!', 'success');

    } catch (error) {
      this.addLog(`❌ 설치 실패: ${error.message}`, 'error');
      throw error;
    }
  }

  async checkSystemRequirements() {
    this.addLog('Node.js 버전 확인 중...', 'info');
    
    // Node.js 버전 확인
    const nodeVersion = process.versions.node;
    const requiredVersion = '18.0.0';
    
    if (this.compareVersions(nodeVersion, requiredVersion) < 0) {
      throw new Error(`Node.js 버전이 너무 낮습니다. 현재: v${nodeVersion}, 필요: v${requiredVersion} 이상`);
    }
    
    this.addLog(`✅ Node.js 버전 확인 완료: v${nodeVersion}`, 'success');
    
    // npm 확인
    try {
      const { execSync } = await import('child_process');
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.addLog(`✅ npm 버전 확인 완료: v${npmVersion}`, 'success');
    } catch (error) {
      throw new Error('npm이 설치되지 않았습니다.');
    }
  }

  async cloneRepository() {
    const repoUrl = 'https://github.com/shinyryu09/cursor-server.git';
    const targetPath = path.join(this.installPath, 'cursor-server');
    
    this.addLog(`저장소 클론 중: ${repoUrl}`, 'info');
    this.addLog(`대상 경로: ${targetPath}`, 'info');
    
    try {
      const { execSync } = await import('child_process');
      
      // 기존 디렉토리가 있으면 삭제
      try {
        await fs.access(targetPath);
        await fs.rm(targetPath, { recursive: true, force: true });
        this.addLog('기존 디렉토리 삭제 완료', 'info');
      } catch {
        // 디렉토리가 없으면 무시
      }
      
      // git clone 실행
      execSync(`git clone ${repoUrl} "${targetPath}"`, { 
        stdio: 'pipe',
        cwd: this.installPath 
      });
      
      this.addLog('✅ 저장소 클론 완료', 'success');
      
      // 작업 디렉토리 업데이트
      this.installPath = targetPath;
      
    } catch (error) {
      throw new Error(`저장소 클론 실패: ${error.message}`);
    }
  }

  async installDependencies() {
    this.addLog('의존성 설치 중... (시간이 걸릴 수 있습니다)', 'info');
    
    try {
      const { execSync } = await import('child_process');
      
      // npm 캐시 정리
      this.addLog('npm 캐시 정리 중...', 'info');
      execSync('npm cache clean --force', { 
        stdio: 'pipe',
        cwd: this.installPath 
      });
      
      // 의존성 설치
      this.addLog('패키지 설치 중...', 'info');
      execSync('npm install', { 
        stdio: 'pipe',
        cwd: this.installPath 
      });
      
      this.addLog('✅ 의존성 설치 완료', 'success');
      
    } catch (error) {
      throw new Error(`의존성 설치 실패: ${error.message}`);
    }
  }

  async setupEnvironment() {
    const envPath = path.join(this.installPath, '.env');
    const envExamplePath = path.join(this.installPath, 'env.example');
    
    try {
      // env.example 파일 확인
      await fs.access(envExamplePath);
      
      // .env 파일이 없으면 복사
      try {
        await fs.access(envPath);
        this.addLog('.env 파일이 이미 존재합니다', 'info');
      } catch {
        await fs.copyFile(envExamplePath, envPath);
        this.addLog('✅ .env 파일 생성 완료', 'success');
      }
      
      this.addLog('⚠️  .env 파일에 API 키를 설정해주세요', 'warning');
      
    } catch (error) {
      this.addLog('⚠️  환경 변수 파일 설정에 문제가 있습니다', 'warning');
    }
  }

  async checkCursorEditor() {
    try {
      const { execSync } = await import('child_process');
      const cursorVersion = execSync('cursor --version', { encoding: 'utf8' }).trim();
      this.addLog(`✅ Cursor Editor 확인 완료: ${cursorVersion}`, 'success');
    } catch (error) {
      this.addLog('⚠️  Cursor Editor가 설치되지 않았습니다', 'warning');
      this.addLog('https://cursor.sh/ 에서 다운로드하여 설치해주세요', 'info');
    }
  }

  async startServer() {
    this.addLog('서버 시작 중...', 'info');
    
    try {
      const { execSync } = await import('child_process');
      
      // 서버 시작 테스트
      execSync('npm start -- --help', { 
        stdio: 'pipe',
        cwd: this.installPath 
      });
      
      this.addLog('✅ 서버 시작 테스트 완료', 'success');
      
    } catch (error) {
      throw new Error(`서버 시작 실패: ${error.message}`);
    }
  }

  async updateStatus(step, currentStep, progress) {
    this.installStatus.step = step;
    this.installStatus.currentStep = currentStep;
    this.installStatus.progress = progress;
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('status-update', this.installStatus);
    }
  }

  addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type
    };
    
    this.installStatus.logs.push(logEntry);
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('log-update', logEntry);
    }
  }

  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }
    
    return 0;
  }

  async run() {
    await app.whenReady();
    
    await this.createWindow();
    this.setupIPC();
    
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });
  }
}

const installerApp = new InstallerApp();
installerApp.run();
