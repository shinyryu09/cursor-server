const WebSocket = require('ws');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * WebSocket 어댑터 - IDE 플러그인과의 실시간 통신
 */
class WebSocketAdapter extends EventEmitter {
    constructor(port = 3001) {
        super();
        this.port = port;
        this.server = null;
        this.clients = new Map(); // clientId -> WebSocket
        this.sessions = new Map(); // clientId -> session info
    }

    /**
     * WebSocket 서버 시작
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = new WebSocket.Server({ 
                    port: this.port,
                    perMessageDeflate: false // 성능 최적화
                });

                this.server.on('connection', (ws, req) => {
                    this.handleConnection(ws, req);
                });

                this.server.on('error', (error) => {
                    logger.error('WebSocket 서버 오류:', error);
                    reject(error);
                });

                logger.info(`WebSocket 서버가 시작되었습니다: ws://localhost:${this.port}`);
                resolve();
            } catch (error) {
                logger.error('WebSocket 서버 시작 실패:', error);
                reject(error);
            }
        });
    }

    /**
     * 새 클라이언트 연결 처리
     */
    handleConnection(ws, req) {
        const clientId = this.generateClientId();
        const clientInfo = this.extractClientInfo(req);
        
        logger.info(`새 클라이언트 연결: ${clientId} (${clientInfo.ide})`);

        // 클라이언트 등록
        this.clients.set(clientId, ws);
        this.sessions.set(clientId, {
            id: clientId,
            ide: clientInfo.ide,
            version: clientInfo.version,
            capabilities: clientInfo.capabilities,
            connectedAt: new Date(),
            lastActivity: new Date()
        });

        // WebSocket 이벤트 핸들러 설정
        ws.on('message', (data) => {
            this.handleMessage(clientId, data);
        });

        ws.on('close', () => {
            this.handleDisconnection(clientId);
        });

        ws.on('error', (error) => {
            logger.error(`클라이언트 ${clientId} 오류:`, error);
            this.handleDisconnection(clientId);
        });

        // 연결 확인 메시지 전송
        this.sendMessage(clientId, {
            jsonrpc: '2.0',
            method: 'connection.established',
            params: {
                clientId,
                serverInfo: {
                    name: 'Cursor MCP Server',
                    version: '2.0.0',
                    protocolVersion: '2024-11-05'
                }
            }
        });
    }

    /**
     * 클라이언트 정보 추출
     */
    extractClientInfo(req) {
        const userAgent = req.headers['user-agent'] || '';
        const ide = this.detectIDE(userAgent);
        
        return {
            ide,
            version: this.extractVersion(userAgent),
            capabilities: this.getDefaultCapabilities(ide),
            userAgent
        };
    }

    /**
     * IDE 감지
     */
    detectIDE(userAgent) {
        if (userAgent.includes('Xcode')) return 'xcode';
        if (userAgent.includes('Android Studio')) return 'android-studio';
        if (userAgent.includes('IntelliJ')) return 'intellij';
        if (userAgent.includes('VS Code')) return 'vscode';
        return 'unknown';
    }

    /**
     * 버전 추출
     */
    extractVersion(userAgent) {
        const versionMatch = userAgent.match(/(\d+\.\d+\.\d+)/);
        return versionMatch ? versionMatch[1] : '1.0.0';
    }

    /**
     * IDE별 기본 기능 설정
     */
    getDefaultCapabilities(ide) {
        const baseCapabilities = {
            tools: true,
            resources: true,
            prompts: true
        };

        switch (ide) {
            case 'xcode':
                return {
                    ...baseCapabilities,
                    swift: true,
                    objectivec: true,
                    ios: true
                };
            case 'android-studio':
                return {
                    ...baseCapabilities,
                    kotlin: true,
                    java: true,
                    android: true
                };
            case 'intellij':
                return {
                    ...baseCapabilities,
                    java: true,
                    kotlin: true,
                    scala: true
                };
            case 'vscode':
                return {
                    ...baseCapabilities,
                    javascript: true,
                    typescript: true,
                    python: true
                };
            default:
                return baseCapabilities;
        }
    }

    /**
     * 메시지 처리
     */
    handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            const session = this.sessions.get(clientId);
            
            if (session) {
                session.lastActivity = new Date();
            }

            logger.debug(`클라이언트 ${clientId} 메시지 수신:`, message);

            // MCP 요청을 Core MCP Server로 전달
            this.emit('mcpRequest', {
                clientId,
                message,
                session
            });

        } catch (error) {
            logger.error(`클라이언트 ${clientId} 메시지 파싱 오류:`, error);
            this.sendError(clientId, -32700, 'Parse error', null);
        }
    }

    /**
     * 클라이언트 연결 해제 처리
     */
    handleDisconnection(clientId) {
        logger.info(`클라이언트 연결 해제: ${clientId}`);
        
        this.clients.delete(clientId);
        this.sessions.delete(clientId);
        
        this.emit('clientDisconnected', clientId);
    }

    /**
     * 메시지 전송
     */
    sendMessage(clientId, message) {
        const ws = this.clients.get(clientId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
                logger.debug(`클라이언트 ${clientId} 메시지 전송:`, message);
            } catch (error) {
                logger.error(`클라이언트 ${clientId} 메시지 전송 오류:`, error);
            }
        } else {
            logger.warn(`클라이언트 ${clientId} 연결이 없거나 닫혀있음`);
        }
    }

    /**
     * 오류 메시지 전송
     */
    sendError(clientId, code, message, id) {
        this.sendMessage(clientId, {
            jsonrpc: '2.0',
            error: {
                code,
                message
            },
            id
        });
    }

    /**
     * MCP 응답 전송
     */
    sendMCPResponse(clientId, response) {
        this.sendMessage(clientId, response);
    }

    /**
     * 클라이언트 ID 생성
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 활성 세션 목록 조회
     */
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * 특정 클라이언트 세션 조회
     */
    getSession(clientId) {
        return this.sessions.get(clientId);
    }

    /**
     * 서버 중지
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                // 모든 클라이언트 연결 종료
                for (const [clientId, ws] of this.clients) {
                    ws.close();
                }
                
                this.server.close(() => {
                    logger.info('WebSocket 서버가 중지되었습니다');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = WebSocketAdapter;
