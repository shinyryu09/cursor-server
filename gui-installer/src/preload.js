import { contextBridge, ipcRenderer } from 'electron';

// 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 설치 경로 선택
  selectInstallPath: () => ipcRenderer.invoke('select-install-path'),
  
  // 설치 시작
  startInstallation: (options) => ipcRenderer.invoke('start-installation', options),
  
  // 설치 상태 조회
  getInstallStatus: () => ipcRenderer.invoke('get-install-status'),
  
  // 로그 조회
  getLogs: () => ipcRenderer.invoke('get-logs'),
  
  // 외부 링크 열기
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 서버 시작
  startServer: () => ipcRenderer.invoke('start-server'),
  
  // 이벤트 리스너
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, status) => callback(status));
  },
  
  onLogUpdate: (callback) => {
    ipcRenderer.on('log-update', (event, log) => callback(log));
  },
  
  // 이벤트 리스너 제거
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

