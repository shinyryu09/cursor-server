const WebSocketAdapter = require('./WebSocketAdapter');
const StdioAdapter = require('./StdioAdapter');
const AuthenticationLayer = require('./AuthenticationLayer');
const RequestRouter = require('./RequestRouter');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * Gateway Layer - WebSocket/Stdio 어댑터, 인증, 요청 라우팅을 통합 관리
 */
class GatewayLayer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            websocketPort: 3001,
            enableWebSocket: true,
            enableStdio: true,
            enableAuthentication: true,
            ...config
        };

        // 어댑터들 초기화
        this.websocketAdapter = null;
        this.stdioAdapter = null;
        this.authLayer = null;
        this.requestRouter = null;

        this.isRunning = false;
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0
        };
    }

    /**
     * Gateway Layer 시작
     */
    async start() {
        try {
            logger.info('Gateway Layer 시작 중...');

            // 1. 인증 레이어 초기화
            if (this.config.enableAuthentication) {
                this.authLayer = new AuthenticationLayer();
                this.authLayer.startCleanupTask();
                logger.info('인증 레이어 초기화 완료');
            }

            // 2. 요청 라우터 초기화
            this.requestRouter = new RequestRouter();
            logger.info('요청 라우터 초기화 완료');

            // 3. WebSocket 어댑터 시작
            if (this.config.enableWebSocket) {
                this.websocketAdapter = new WebSocketAdapter(this.config.websocketPort);
                await this.setupWebSocketHandlers();
                await this.websocketAdapter.start();
                logger.info('WebSocket 어댑터 시작 완료');
            }

            // 4. Stdio 어댑터 시작
            if (this.config.enableStdio) {
                this.stdioAdapter = new StdioAdapter();
                await this.setupStdioHandlers();
                await this.stdioAdapter.start();
                logger.info('Stdio 어댑터 시작 완료');
            }

            this.isRunning = true;
            logger.info('Gateway Layer가 성공적으로 시작되었습니다');

            // 통계 업데이트 시작
            this.startStatsUpdate();

        } catch (error) {
            logger.error('Gateway Layer 시작 실패:', error);
            throw error;
        }
    }

    /**
     * WebSocket 핸들러 설정
     */
    async setupWebSocketHandlers() {
        // MCP 요청 처리
        this.websocketAdapter.on('mcpRequest', async (data) => {
            await this.handleMCPRequest(data, 'websocket');
        });

        // 클라이언트 연결 해제 처리
        this.websocketAdapter.on('clientDisconnected', (clientId) => {
            this.handleClientDisconnection(clientId, 'websocket');
        });
    }

    /**
     * Stdio 핸들러 설정
     */
    async setupStdioHandlers() {
        // 알림 처리
        this.stdioAdapter.on('notification', async (notification) => {
            await this.handleNotification(notification, 'stdio');
        });

        // 메시지 처리
        this.stdioAdapter.on('message', async (message) => {
            await this.handleMessage(message, 'stdio');
        });

        // 프로세스 종료 처리
        this.stdioAdapter.on('processClosed', (code) => {
            this.handleProcessClosed(code);
        });
    }

    /**
     * MCP 요청 처리
     */
    async handleMCPRequest(data, adapterType) {
        const { clientId, message, session } = data;
        
        try {
            this.stats.totalRequests++;

            // 1. 인증 확인
            let authResult = { valid: true, session };
            if (this.authLayer && message.params?.token) {
                authResult = this.authLayer.validateToken(message.params.token);
                if (!authResult.valid) {
                    this.sendError(clientId, -32000, authResult.error, message.id, adapterType);
                    return;
                }
            }

            // 2. 요청 라우팅
            const routingResult = await this.requestRouter.routeRequest(message, authResult.session);
            if (routingResult.error) {
                this.sendError(clientId, routingResult.error.code, routingResult.error.message, message.id, adapterType);
                return;
            }

            // 3. 핸들러로 요청 전달
            const context = routingResult.context;
            this.emit('mcpRequest', {
                clientId,
                message,
                context,
                adapterType
            });

            this.stats.successfulRequests++;

        } catch (error) {
            logger.error('MCP 요청 처리 오류:', error);
            this.sendError(clientId, -32603, 'Internal error', message.id, adapterType);
            this.stats.failedRequests++;
        }
    }

    /**
     * 알림 처리
     */
    async handleNotification(notification, adapterType) {
        logger.debug('알림 수신:', notification);
        
        // 알림을 Core MCP Server로 전달
        this.emit('notification', {
            notification,
            adapterType
        });
    }

    /**
     * 메시지 처리
     */
    async handleMessage(message, adapterType) {
        logger.debug('메시지 수신:', message);
        
        // 메시지를 Core MCP Server로 전달
        this.emit('message', {
            message,
            adapterType
        });
    }

    /**
     * 클라이언트 연결 해제 처리
     */
    handleClientDisconnection(clientId, adapterType) {
        logger.info(`클라이언트 연결 해제: ${clientId} (${adapterType})`);
        
        this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
        
        // Core MCP Server에 연결 해제 알림
        this.emit('clientDisconnected', {
            clientId,
            adapterType
        });
    }

    /**
     * 프로세스 종료 처리
     */
    handleProcessClosed(code) {
        logger.info(`Stdio 프로세스 종료: 코드 ${code}`);
        
        // Core MCP Server에 프로세스 종료 알림
        this.emit('processClosed', {
            code,
            adapterType: 'stdio'
        });
    }

    /**
     * MCP 응답 전송
     */
    sendMCPResponse(clientId, response, adapterType) {
        if (adapterType === 'websocket' && this.websocketAdapter) {
            this.websocketAdapter.sendMCPResponse(clientId, response);
        } else if (adapterType === 'stdio' && this.stdioAdapter) {
            // Stdio는 요청-응답 모델이므로 별도 처리 불필요
            logger.debug('Stdio 응답:', response);
        }
    }

    /**
     * 오류 메시지 전송
     */
    sendError(clientId, code, message, id, adapterType) {
        const errorResponse = {
            jsonrpc: '2.0',
            error: {
                code,
                message
            },
            id
        };

        this.sendMCPResponse(clientId, errorResponse, adapterType);
    }

    /**
     * 토큰 생성
     */
    generateToken(clientInfo) {
        if (!this.authLayer) {
            throw new Error('인증 레이어가 활성화되지 않았습니다');
        }
        return this.authLayer.generateToken(clientInfo);
    }

    /**
     * IDE별 기본 토큰 생성
     */
    generateIDETokens() {
        if (!this.authLayer) {
            throw new Error('인증 레이어가 활성화되지 않았습니다');
        }
        return this.authLayer.generateIDETokens();
    }

    /**
     * 토큰 검증
     */
    validateToken(token) {
        if (!this.authLayer) {
            return { valid: false, error: '인증 레이어가 활성화되지 않았습니다' };
        }
        return this.authLayer.validateToken(token);
    }

    /**
     * 세션 생성
     */
    createSession(token, additionalInfo) {
        if (!this.authLayer) {
            throw new Error('인증 레이어가 활성화되지 않았습니다');
        }
        return this.authLayer.createSession(token, additionalInfo);
    }

    /**
     * 활성 세션 조회
     */
    getActiveSessions() {
        if (!this.authLayer) {
            return [];
        }
        return this.authLayer.getActiveSessions();
    }

    /**
     * WebSocket 세션 조회
     */
    getWebSocketSessions() {
        if (!this.websocketAdapter) {
            return [];
        }
        return this.websocketAdapter.getActiveSessions();
    }

    /**
     * 통계 정보 조회
     */
    getStats() {
        const authStats = this.authLayer ? this.authLayer.getStats() : {};
        const routerStats = this.requestRouter ? this.requestRouter.getRouteStats() : {};
        
        return {
            ...this.stats,
            auth: authStats,
            router: routerStats,
            adapters: {
                websocket: this.websocketAdapter ? 'active' : 'inactive',
                stdio: this.stdioAdapter ? 'active' : 'inactive'
            }
        };
    }

    /**
     * 통계 업데이트 시작
     */
    startStatsUpdate() {
        setInterval(() => {
            if (this.websocketAdapter) {
                const wsSessions = this.websocketAdapter.getActiveSessions();
                this.stats.activeConnections = wsSessions.length;
            }
        }, 5000); // 5초마다 업데이트
    }

    /**
     * Gateway Layer 중지
     */
    async stop() {
        try {
            logger.info('Gateway Layer 중지 중...');

            this.isRunning = false;

            // WebSocket 어댑터 중지
            if (this.websocketAdapter) {
                await this.websocketAdapter.stop();
                logger.info('WebSocket 어댑터 중지 완료');
            }

            // Stdio 어댑터 중지
            if (this.stdioAdapter) {
                await this.stdioAdapter.stop();
                logger.info('Stdio 어댑터 중지 완료');
            }

            logger.info('Gateway Layer가 중지되었습니다');

        } catch (error) {
            logger.error('Gateway Layer 중지 오류:', error);
            throw error;
        }
    }
}

module.exports = GatewayLayer;
