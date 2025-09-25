const { EventEmitter } = require('events');
const SessionManager = require('./SessionManager');
const ProtocolHandler = require('./ProtocolHandler');
const FeatureHandlers = require('./FeatureHandlers');
const logger = require('../utils/logger');

/**
 * Core MCP Server - 세션 관리, 프로토콜 핸들러, 기능 핸들러를 통합 관리
 */
class CoreMCPServer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableSessionManagement: true,
            enableProtocolHandling: true,
            enableFeatureHandling: true,
            ...config
        };

        // 핵심 컴포넌트들
        this.sessionManager = null;
        this.protocolHandler = null;
        this.featureHandlers = null;

        this.isRunning = false;
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            activeSessions: 0,
            averageResponseTime: 0
        };

        this.responseTimes = [];
    }

    /**
     * Core MCP Server 시작
     */
    async start() {
        try {
            logger.info('Core MCP Server 시작 중...');

            // 1. 세션 매니저 초기화
            if (this.config.enableSessionManagement) {
                this.sessionManager = new SessionManager();
                this.setupSessionManagerHandlers();
                logger.info('세션 매니저 초기화 완료');
            }

            // 2. 프로토콜 핸들러 초기화
            if (this.config.enableProtocolHandling) {
                this.protocolHandler = new ProtocolHandler();
                this.setupProtocolHandlerHandlers();
                logger.info('프로토콜 핸들러 초기화 완료');
            }

            // 3. 기능 핸들러 초기화
            if (this.config.enableFeatureHandling) {
                this.featureHandlers = new FeatureHandlers();
                this.setupFeatureHandlerHandlers();
                logger.info('기능 핸들러 초기화 완료');
            }

            this.isRunning = true;
            logger.info('Core MCP Server가 성공적으로 시작되었습니다');

        } catch (error) {
            logger.error('Core MCP Server 시작 실패:', error);
            throw error;
        }
    }

    /**
     * 세션 매니저 핸들러 설정
     */
    setupSessionManagerHandlers() {
        this.sessionManager.on('sessionCreated', (session) => {
            logger.info(`새 세션 생성: ${session.id} (${session.ide})`);
            this.emit('sessionCreated', session);
        });

        this.sessionManager.on('sessionUpdated', (session) => {
            logger.debug(`세션 업데이트: ${session.id}`);
            this.emit('sessionUpdated', session);
        });

        this.sessionManager.on('sessionEnded', (session) => {
            logger.info(`세션 종료: ${session.id} (${session.ide})`);
            this.emit('sessionEnded', session);
        });

        this.sessionManager.on('sessionActivity', (data) => {
            logger.debug(`세션 활동: ${data.sessionId} - ${data.activity.type}`);
            this.emit('sessionActivity', data);
        });
    }

    /**
     * 프로토콜 핸들러 핸들러 설정
     */
    setupProtocolHandlerHandlers() {
        this.protocolHandler.on('cursorAIRequest', (request) => {
            logger.debug('Cursor AI 요청:', request);
            this.emit('cursorAIRequest', request);
        });
    }

    /**
     * 기능 핸들러 핸들러 설정
     */
    setupFeatureHandlerHandlers() {
        this.featureHandlers.on('cursorAIRequest', (request) => {
            logger.debug('Cursor AI 기능 요청:', request);
            this.emit('cursorAIRequest', request);
        });
    }

    /**
     * MCP 요청 처리
     */
    async handleMCPRequest(requestData) {
        const startTime = Date.now();
        const { clientId, message, context, adapterType } = requestData;

        try {
            this.stats.totalRequests++;

            // 1. 세션 관리
            let session = null;
            if (this.sessionManager) {
                session = await this.manageSession(clientId, message, context);
            }

            // 2. 프로토콜 처리
            let response = null;
            if (this.protocolHandler) {
                response = await this.protocolHandler.handleRequest(message, session);
            }

            // 3. 응답 시간 기록
            const responseTime = Date.now() - startTime;
            this.recordResponseTime(responseTime);

            // 4. 세션 활동 기록
            if (this.sessionManager && session) {
                this.sessionManager.recordActivity(session.id, 'request', {
                    method: message.method,
                    responseTime,
                    success: !response.error
                });
            }

            this.stats.successfulRequests++;
            
            logger.debug(`MCP 요청 처리 완료: ${message.method} (${responseTime}ms)`);
            
            return {
                clientId,
                response,
                session,
                adapterType,
                responseTime
            };

        } catch (error) {
            logger.error('MCP 요청 처리 오류:', error);
            this.stats.failedRequests++;

            // 오류 응답 생성
            const errorResponse = {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: error.message
                },
                id: message.id
            };

            return {
                clientId,
                response: errorResponse,
                session: null,
                adapterType,
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * 세션 관리
     */
    async manageSession(clientId, message, context) {
        // 기존 세션 조회
        let session = this.sessionManager.getSessionByClientId(clientId);

        // 세션이 없으면 새로 생성
        if (!session) {
            const sessionData = {
                clientId,
                ide: context?.ideHandler?.ide || 'unknown',
                version: context?.ideHandler?.version || '1.0.0',
                capabilities: context?.ideHandler?.capabilities || {},
                workingDirectory: message.params?.workingDirectory,
                projectPath: message.params?.projectPath,
                currentFile: message.params?.currentFile,
                cursorPosition: message.params?.cursorPosition,
                selectedText: message.params?.selectedText,
                openFiles: message.params?.openFiles
            };

            session = this.sessionManager.createSession(sessionData);
        } else {
            // 세션 컨텍스트 업데이트
            const contextUpdates = {
                workingDirectory: message.params?.workingDirectory,
                projectPath: message.params?.projectPath,
                currentFile: message.params?.currentFile,
                cursorPosition: message.params?.cursorPosition,
                selectedText: message.params?.selectedText,
                openFiles: message.params?.openFiles
            };

            // 변경된 컨텍스트만 업데이트
            const hasChanges = Object.values(contextUpdates).some(value => value !== undefined);
            if (hasChanges) {
                this.sessionManager.updateSessionContext(session.id, contextUpdates);
                session = this.sessionManager.getSession(session.id);
            }
        }

        return session;
    }

    /**
     * 클라이언트 연결 해제 처리
     */
    handleClientDisconnection(disconnectionData) {
        const { clientId, adapterType } = disconnectionData;
        
        logger.info(`클라이언트 연결 해제: ${clientId} (${adapterType})`);

        if (this.sessionManager) {
            this.sessionManager.handleClientDisconnection(clientId);
        }

        this.emit('clientDisconnected', disconnectionData);
    }

    /**
     * 알림 처리
     */
    async handleNotification(notificationData) {
        const { notification, adapterType } = notificationData;
        
        logger.debug('알림 처리:', notification);

        // 알림을 적절한 핸들러로 전달
        this.emit('notification', notificationData);
    }

    /**
     * 메시지 처리
     */
    async handleMessage(messageData) {
        const { message, adapterType } = messageData;
        
        logger.debug('메시지 처리:', message);

        // 메시지를 적절한 핸들러로 전달
        this.emit('message', messageData);
    }

    /**
     * 프로세스 종료 처리
     */
    handleProcessClosed(processData) {
        const { code, adapterType } = processData;
        
        logger.info(`프로세스 종료: 코드 ${code} (${adapterType})`);

        // 프로세스 종료를 적절한 핸들러로 전달
        this.emit('processClosed', processData);
    }

    /**
     * 응답 시간 기록
     */
    recordResponseTime(responseTime) {
        this.responseTimes.push(responseTime);
        
        // 최근 1000개 응답 시간만 보관
        if (this.responseTimes.length > 1000) {
            this.responseTimes = this.responseTimes.slice(-1000);
        }

        // 평균 응답 시간 계산
        this.stats.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }

    /**
     * 활성 세션 조회
     */
    getActiveSessions() {
        if (!this.sessionManager) {
            return [];
        }
        return this.sessionManager.getActiveSessions();
    }

    /**
     * 세션 통계 조회
     */
    getSessionStats() {
        if (!this.sessionManager) {
            return null;
        }
        return this.sessionManager.getSessionStats();
    }

    /**
     * 지원되는 메서드 목록 조회
     */
    getSupportedMethods() {
        if (!this.protocolHandler) {
            return [];
        }
        return this.protocolHandler.getSupportedMethods();
    }

    /**
     * 지원되는 언어 목록 조회
     */
    getSupportedLanguages() {
        if (!this.featureHandlers) {
            return [];
        }
        return this.featureHandlers.getSupportedLanguages();
    }

    /**
     * 지원되는 핸들러 목록 조회
     */
    getSupportedHandlers() {
        if (!this.featureHandlers) {
            return [];
        }
        return this.featureHandlers.getSupportedHandlers();
    }

    /**
     * Core MCP Server 통계 조회
     */
    getStats() {
        const sessionStats = this.getSessionStats();
        const protocolStats = this.protocolHandler ? this.protocolHandler.getStats() : null;
        const featureStats = this.featureHandlers ? this.featureHandlers.getStats() : null;

        return {
            ...this.stats,
            activeSessions: this.sessionManager ? this.sessionManager.getActiveSessions().length : 0,
            session: sessionStats,
            protocol: protocolStats,
            features: featureStats,
            uptime: this.isRunning ? Date.now() - this.startTime : 0
        };
    }

    /**
     * Core MCP Server 중지
     */
    async stop() {
        try {
            logger.info('Core MCP Server 중지 중...');

            this.isRunning = false;

            // 세션 매니저 중지
            if (this.sessionManager) {
                this.sessionManager.stop();
                logger.info('세션 매니저 중지 완료');
            }

            logger.info('Core MCP Server가 중지되었습니다');

        } catch (error) {
            logger.error('Core MCP Server 중지 오류:', error);
            throw error;
        }
    }
}

module.exports = CoreMCPServer;
