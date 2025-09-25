const logger = require('../utils/logger');

/**
 * 요청 라우터 - IDE 감지, 프로토콜 버전 관리, 로드 밸런싱
 */
class RequestRouter {
    constructor() {
        this.routes = new Map();
        this.middlewares = [];
        this.loadBalancer = new RoundRobinBalancer();
        this.protocolVersions = new Map();
        this.ideHandlers = new Map();
        
        this.initializeDefaultRoutes();
        this.initializeProtocolVersions();
        this.initializeIDEHandlers();
    }

    /**
     * 기본 라우트 초기화
     */
    initializeDefaultRoutes() {
        // MCP 표준 메서드들
        this.routes.set('initialize', { handler: 'initialize', version: '2024-11-05' });
        this.routes.set('tools/list', { handler: 'listTools', version: '2024-11-05' });
        this.routes.set('tools/call', { handler: 'callTool', version: '2024-11-05' });
        this.routes.set('resources/list', { handler: 'listResources', version: '2024-11-05' });
        this.routes.set('resources/read', { handler: 'readResource', version: '2024-11-05' });
        this.routes.set('prompts/list', { handler: 'listPrompts', version: '2024-11-05' });
        this.routes.set('prompts/get', { handler: 'getPrompt', version: '2024-11-05' });

        // 커스텀 도구들
        this.routes.set('refactor.code', { handler: 'refactorCode', version: '2024-11-05' });
        this.routes.set('complete.code', { handler: 'completeCode', version: '2024-11-05' });
        this.routes.set('explain.code', { handler: 'explainCode', version: '2024-11-05' });
        this.routes.set('test.generate', { handler: 'generateTest', version: '2024-11-05' });
        this.routes.set('analyze.code', { handler: 'analyzeCode', version: '2024-11-05' });
        this.routes.set('review.code', { handler: 'reviewCode', version: '2024-11-05' });

        logger.info('기본 라우트 초기화 완료');
    }

    /**
     * 프로토콜 버전 초기화
     */
    initializeProtocolVersions() {
        this.protocolVersions.set('2024-11-05', {
            version: '2024-11-05',
            features: [
                'tools',
                'resources', 
                'prompts',
                'logging',
                'progress'
            ],
            deprecated: false
        });

        this.protocolVersions.set('2024-10-07', {
            version: '2024-10-07',
            features: [
                'tools',
                'resources',
                'prompts'
            ],
            deprecated: true
        });

        logger.info('프로토콜 버전 초기화 완료');
    }

    /**
     * IDE별 핸들러 초기화
     */
    initializeIDEHandlers() {
        // Xcode 핸들러
        this.ideHandlers.set('xcode', {
            ide: 'xcode',
            languages: ['swift', 'objectivec'],
            capabilities: [
                'code_completion',
                'refactoring',
                'code_explanation',
                'test_generation',
                'ios_specific'
            ],
            handler: 'XcodeHandler'
        });

        // Android Studio 핸들러
        this.ideHandlers.set('android-studio', {
            ide: 'android-studio',
            languages: ['kotlin', 'java'],
            capabilities: [
                'code_completion',
                'refactoring',
                'code_explanation',
                'test_generation',
                'android_specific'
            ],
            handler: 'AndroidStudioHandler'
        });

        // IntelliJ 핸들러
        this.ideHandlers.set('intellij', {
            ide: 'intellij',
            languages: ['java', 'kotlin', 'scala'],
            capabilities: [
                'code_completion',
                'refactoring',
                'code_explanation',
                'test_generation',
                'enterprise_features'
            ],
            handler: 'IntelliJHandler'
        });

        // VS Code 핸들러
        this.ideHandlers.set('vscode', {
            ide: 'vscode',
            languages: ['javascript', 'typescript', 'python', 'go', 'rust'],
            capabilities: [
                'code_completion',
                'refactoring',
                'code_explanation',
                'test_generation',
                'multi_language'
            ],
            handler: 'VSCodeHandler'
        });

        logger.info('IDE별 핸들러 초기화 완료');
    }

    /**
     * 요청 라우팅
     */
    async routeRequest(request, session) {
        try {
            // 1. 미들웨어 실행
            for (const middleware of this.middlewares) {
                const result = await middleware(request, session);
                if (result && result.block) {
                    return result;
                }
            }

            // 2. IDE 감지 및 핸들러 선택
            const ideHandler = this.detectIDEHandler(request, session);
            
            // 3. 프로토콜 버전 확인
            const protocolVersion = this.validateProtocolVersion(request);
            
            // 4. 라우트 찾기
            const route = this.findRoute(request.method);
            if (!route) {
                return {
                    error: {
                        code: -32601,
                        message: `Method not found: ${request.method}`
                    }
                };
            }

            // 5. 로드 밸런싱
            const handler = this.loadBalancer.selectHandler(route.handler);

            // 6. 요청 컨텍스트 생성
            const context = {
                request,
                session,
                ideHandler,
                protocolVersion,
                route,
                handler,
                timestamp: new Date()
            };

            logger.debug('요청 라우팅 완료:', {
                method: request.method,
                ide: ideHandler?.ide,
                version: protocolVersion?.version,
                handler: route.handler
            });

            return {
                success: true,
                context
            };

        } catch (error) {
            logger.error('요청 라우팅 오류:', error);
            return {
                error: {
                    code: -32603,
                    message: 'Internal error during routing',
                    data: error.message
                }
            };
        }
    }

    /**
     * IDE 핸들러 감지
     */
    detectIDEHandler(request, session) {
        // 세션에서 IDE 정보 추출
        if (session && session.clientInfo && session.clientInfo.ide) {
            const ide = session.clientInfo.ide;
            const handler = this.ideHandlers.get(ide);
            if (handler) {
                return handler;
            }
        }

        // 요청 헤더에서 IDE 정보 추출
        const userAgent = request.headers?.['user-agent'] || '';
        const ide = this.extractIDEFromUserAgent(userAgent);
        
        return this.ideHandlers.get(ide) || this.ideHandlers.get('vscode'); // 기본값
    }

    /**
     * User-Agent에서 IDE 추출
     */
    extractIDEFromUserAgent(userAgent) {
        if (userAgent.includes('Xcode')) return 'xcode';
        if (userAgent.includes('Android Studio')) return 'android-studio';
        if (userAgent.includes('IntelliJ')) return 'intellij';
        if (userAgent.includes('VS Code')) return 'vscode';
        return 'unknown';
    }

    /**
     * 프로토콜 버전 검증
     */
    validateProtocolVersion(request) {
        const requestedVersion = request.params?.protocolVersion || '2024-11-05';
        const versionInfo = this.protocolVersions.get(requestedVersion);
        
        if (!versionInfo) {
            logger.warn(`지원하지 않는 프로토콜 버전: ${requestedVersion}`);
            return this.protocolVersions.get('2024-11-05'); // 기본값
        }

        if (versionInfo.deprecated) {
            logger.warn(`사용 중단된 프로토콜 버전: ${requestedVersion}`);
        }

        return versionInfo;
    }

    /**
     * 라우트 찾기
     */
    findRoute(method) {
        return this.routes.get(method);
    }

    /**
     * 미들웨어 추가
     */
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
        logger.info('미들웨어 추가됨');
    }

    /**
     * 라우트 추가
     */
    addRoute(method, handler, version = '2024-11-05') {
        this.routes.set(method, { handler, version });
        logger.info(`라우트 추가됨: ${method} -> ${handler}`);
    }

    /**
     * IDE 핸들러 추가
     */
    addIDEHandler(ide, handler) {
        this.ideHandlers.set(ide, handler);
        logger.info(`IDE 핸들러 추가됨: ${ide}`);
    }

    /**
     * 라우트 통계 조회
     */
    getRouteStats() {
        return {
            totalRoutes: this.routes.size,
            totalIDEHandlers: this.ideHandlers.size,
            totalMiddlewares: this.middlewares.length,
            supportedVersions: Array.from(this.protocolVersions.keys())
        };
    }

    /**
     * 활성 라우트 목록 조회
     */
    getActiveRoutes() {
        return Array.from(this.routes.entries()).map(([method, info]) => ({
            method,
            handler: info.handler,
            version: info.version
        }));
    }
}

/**
 * 라운드 로빈 로드 밸런서
 */
class RoundRobinBalancer {
    constructor() {
        this.handlers = new Map();
        this.counters = new Map();
    }

    /**
     * 핸들러 등록
     */
    registerHandler(name, handler) {
        this.handlers.set(name, handler);
        this.counters.set(name, 0);
    }

    /**
     * 핸들러 선택
     */
    selectHandler(name) {
        const handler = this.handlers.get(name);
        if (!handler) {
            return null;
        }

        // 단일 핸들러인 경우 바로 반환
        if (typeof handler === 'function') {
            return handler;
        }

        // 여러 핸들러가 있는 경우 라운드 로빈
        if (Array.isArray(handler)) {
            const counter = this.counters.get(name) || 0;
            const selected = handler[counter % handler.length];
            this.counters.set(name, counter + 1);
            return selected;
        }

        return handler;
    }

    /**
     * 핸들러 상태 조회
     */
    getHandlerStats() {
        const stats = {};
        for (const [name, handler] of this.handlers) {
            stats[name] = {
                type: Array.isArray(handler) ? 'array' : typeof handler,
                count: Array.isArray(handler) ? handler.length : 1,
                requests: this.counters.get(name) || 0
            };
        }
        return stats;
    }
}

module.exports = RequestRouter;
