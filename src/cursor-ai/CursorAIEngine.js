const { EventEmitter } = require('events');
const LocalCommunicationLayer = require('./LocalCommunicationLayer');
const AIProcessingCore = require('./AIProcessingCore');
const ProjectContextManager = require('./ProjectContextManager');
const logger = require('../utils/logger');

/**
 * Cursor AI Engine - 로컬 AI 처리 엔진 통합 관리
 */
class CursorAIEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableLocalCommunication: true,
            enableAIProcessing: true,
            enableProjectContext: true,
            ...config
        };

        // 핵심 컴포넌트들
        this.localCommunication = null;
        this.aiProcessing = null;
        this.projectContext = null;

        this.isRunning = false;
        this.stats = {
            totalRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0
        };

        this.responseTimes = [];
    }

    /**
     * Cursor AI Engine 시작
     */
    async start() {
        try {
            logger.info('Cursor AI Engine 시작 중...');

            // 1. 로컬 통신 레이어 초기화
            if (this.config.enableLocalCommunication) {
                this.localCommunication = new LocalCommunicationLayer();
                this.setupLocalCommunicationHandlers();
                await this.localCommunication.start();
                logger.info('로컬 통신 레이어 초기화 완료');
            }

            // 2. AI 처리 코어 초기화
            if (this.config.enableAIProcessing) {
                this.aiProcessing = new AIProcessingCore();
                this.setupAIProcessingHandlers();
                await this.aiProcessing.start();
                logger.info('AI 처리 코어 초기화 완료');
            }

            // 3. 프로젝트 컨텍스트 매니저 초기화
            if (this.config.enableProjectContext) {
                this.projectContext = new ProjectContextManager();
                this.setupProjectContextHandlers();
                await this.projectContext.start();
                logger.info('프로젝트 컨텍스트 매니저 초기화 완료');
            }

            this.isRunning = true;
            logger.info('Cursor AI Engine이 성공적으로 시작되었습니다');

        } catch (error) {
            logger.error('Cursor AI Engine 시작 실패:', error);
            throw error;
        }
    }

    /**
     * 로컬 통신 레이어 핸들러 설정
     */
    setupLocalCommunicationHandlers() {
        this.localCommunication.on('cursorAIRequest', (request) => {
            logger.debug('로컬 통신 레이어에서 Cursor AI 요청:', request);
            this.emit('cursorAIRequest', request);
        });
    }

    /**
     * AI 처리 코어 핸들러 설정
     */
    setupAIProcessingHandlers() {
        this.aiProcessing.on('requestCompleted', (data) => {
            logger.debug('AI 처리 완료:', data);
            this.emit('requestCompleted', data);
        });

        this.aiProcessing.on('requestFailed', (data) => {
            logger.error('AI 처리 실패:', data);
            this.emit('requestFailed', data);
        });
    }

    /**
     * 프로젝트 컨텍스트 매니저 핸들러 설정
     */
    setupProjectContextHandlers() {
        // 프로젝트 컨텍스트 관련 이벤트 처리
        logger.debug('프로젝트 컨텍스트 매니저 핸들러 설정 완료');
    }

    /**
     * Cursor AI 요청 처리
     */
    async handleCursorAIRequest(request) {
        const startTime = Date.now();
        
        try {
            this.stats.totalRequests++;

            // 1. 프로젝트 컨텍스트 분석
            let projectContext = null;
            if (this.projectContext && request.context?.projectPath) {
                projectContext = await this.projectContext.analyzeProject(request.context.projectPath);
            }

            // 2. AI 처리 요청
            let result = null;
            if (this.aiProcessing) {
                // AI 처리 코어에 요청 추가
                this.aiProcessing.addRequest({
                    ...request,
                    projectContext
                });

                // 결과 대기 (실제 구현에서는 비동기 처리)
                result = await this.waitForAIProcessing(request);
            }

            // 3. 응답 시간 기록
            const responseTime = Date.now() - startTime;
            this.recordResponseTime(responseTime);

            this.stats.completedRequests++;
            
            logger.debug(`Cursor AI 요청 처리 완료: ${request.action} (${responseTime}ms)`);
            
            return {
                success: true,
                result,
                projectContext,
                responseTime
            };

        } catch (error) {
            logger.error('Cursor AI 요청 처리 오류:', error);
            this.stats.failedRequests++;

            return {
                success: false,
                error: error.message,
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * AI 처리 완료 대기
     */
    async waitForAIProcessing(request) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('AI 처리 타임아웃'));
            }, 30000); // 30초 타임아웃

            const onCompleted = (data) => {
                if (data.request.action === request.action) {
                    clearTimeout(timeout);
                    this.aiProcessing.removeListener('requestCompleted', onCompleted);
                    this.aiProcessing.removeListener('requestFailed', onFailed);
                    resolve(data.result);
                }
            };

            const onFailed = (data) => {
                if (data.request.action === request.action) {
                    clearTimeout(timeout);
                    this.aiProcessing.removeListener('requestCompleted', onCompleted);
                    this.aiProcessing.removeListener('requestFailed', onFailed);
                    reject(new Error(data.error.message));
                }
            };

            this.aiProcessing.on('requestCompleted', onCompleted);
            this.aiProcessing.on('requestFailed', onFailed);
        });
    }

    /**
     * 코드 완성 요청
     */
    async requestCodeCompletion(language, code, context) {
        const request = {
            action: 'complete',
            language,
            code,
            context
        };

        return await this.handleCursorAIRequest(request);
    }

    /**
     * 코드 리팩토링 요청
     */
    async requestCodeRefactoring(language, code, refactorType, context) {
        const request = {
            action: 'refactor',
            language,
            code,
            refactorType,
            context
        };

        return await this.handleCursorAIRequest(request);
    }

    /**
     * 코드 설명 요청
     */
    async requestCodeExplanation(language, code, context) {
        const request = {
            action: 'explain',
            language,
            code,
            context
        };

        return await this.handleCursorAIRequest(request);
    }

    /**
     * 테스트 생성 요청
     */
    async requestTestGeneration(language, code, testType, context) {
        const request = {
            action: 'generate_test',
            language,
            code,
            testType,
            context
        };

        return await this.handleCursorAIRequest(request);
    }

    /**
     * 코드 분석 요청
     */
    async requestCodeAnalysis(language, code, analysisType, context) {
        const request = {
            action: 'analyze',
            language,
            code,
            analysisType,
            context
        };

        return await this.handleCursorAIRequest(request);
    }

    /**
     * 코드 리뷰 요청
     */
    async requestCodeReview(language, code, context) {
        const request = {
            action: 'review',
            language,
            code,
            context
        };

        return await this.handleCursorAIRequest(request);
    }

    /**
     * 프로젝트 분석 요청
     */
    async requestProjectAnalysis(projectPath) {
        if (!this.projectContext) {
            throw new Error('프로젝트 컨텍스트 매니저가 활성화되지 않았습니다');
        }

        return await this.projectContext.analyzeProject(projectPath);
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
     * 로컬 통신 상태 조회
     */
    getLocalCommunicationStatus() {
        if (!this.localCommunication) {
            return { status: 'disabled' };
        }
        return this.localCommunication.getStats();
    }

    /**
     * AI 처리 상태 조회
     */
    getAIProcessingStatus() {
        if (!this.aiProcessing) {
            return { status: 'disabled' };
        }
        return this.aiProcessing.getStats();
    }

    /**
     * 프로젝트 컨텍스트 상태 조회
     */
    getProjectContextStatus() {
        if (!this.projectContext) {
            return { status: 'disabled' };
        }
        return this.projectContext.getStats();
    }

    /**
     * Cursor AI Engine 통계 조회
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            localCommunication: this.getLocalCommunicationStatus(),
            aiProcessing: this.getAIProcessingStatus(),
            projectContext: this.getProjectContextStatus()
        };
    }

    /**
     * Cursor AI Engine 중지
     */
    async stop() {
        try {
            logger.info('Cursor AI Engine 중지 중...');

            this.isRunning = false;

            // 로컬 통신 레이어 중지
            if (this.localCommunication) {
                await this.localCommunication.stop();
                logger.info('로컬 통신 레이어 중지 완료');
            }

            // AI 처리 코어 중지
            if (this.aiProcessing) {
                await this.aiProcessing.stop();
                logger.info('AI 처리 코어 중지 완료');
            }

            // 프로젝트 컨텍스트 매니저 중지
            if (this.projectContext) {
                await this.projectContext.stop();
                logger.info('프로젝트 컨텍스트 매니저 중지 완료');
            }

            logger.info('Cursor AI Engine이 중지되었습니다');

        } catch (error) {
            logger.error('Cursor AI Engine 중지 오류:', error);
            throw error;
        }
    }
}

module.exports = CursorAIEngine;
