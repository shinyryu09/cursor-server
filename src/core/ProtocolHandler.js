const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * 프로토콜 핸들러 - JSON-RPC 요청 파싱, 검증, Cursor AI 호출, 응답 변환
 */
class ProtocolHandler extends EventEmitter {
    constructor() {
        super();
        this.supportedVersions = ['2024-11-05', '2024-10-07'];
        this.defaultVersion = '2024-11-05';
        this.methods = new Map();
        this.middlewares = [];
        
        this.initializeStandardMethods();
    }

    /**
     * 표준 MCP 메서드 초기화
     */
    initializeStandardMethods() {
        // MCP 표준 메서드들
        this.methods.set('initialize', {
            handler: this.handleInitialize.bind(this),
            version: '2024-11-05',
            description: '서버 초기화'
        });

        this.methods.set('tools/list', {
            handler: this.handleListTools.bind(this),
            version: '2024-11-05',
            description: '도구 목록 조회'
        });

        this.methods.set('tools/call', {
            handler: this.handleCallTool.bind(this),
            version: '2024-11-05',
            description: '도구 실행'
        });

        this.methods.set('resources/list', {
            handler: this.handleListResources.bind(this),
            version: '2024-11-05',
            description: '리소스 목록 조회'
        });

        this.methods.set('resources/read', {
            handler: this.handleReadResource.bind(this),
            version: '2024-11-05',
            description: '리소스 읽기'
        });

        this.methods.set('prompts/list', {
            handler: this.handleListPrompts.bind(this),
            version: '2024-11-05',
            description: '프롬프트 목록 조회'
        });

        this.methods.set('prompts/get', {
            handler: this.handleGetPrompt.bind(this),
            version: '2024-11-05',
            description: '프롬프트 가져오기'
        });

        // 커스텀 도구들
        this.methods.set('refactor.code', {
            handler: this.handleRefactorCode.bind(this),
            version: '2024-11-05',
            description: '코드 리팩토링'
        });

        this.methods.set('complete.code', {
            handler: this.handleCompleteCode.bind(this),
            version: '2024-11-05',
            description: '코드 완성'
        });

        this.methods.set('explain.code', {
            handler: this.handleExplainCode.bind(this),
            version: '2024-11-05',
            description: '코드 설명'
        });

        this.methods.set('test.generate', {
            handler: this.handleGenerateTest.bind(this),
            version: '2024-11-05',
            description: '테스트 생성'
        });

        this.methods.set('analyze.code', {
            handler: this.handleAnalyzeCode.bind(this),
            version: '2024-11-05',
            description: '코드 분석'
        });

        this.methods.set('review.code', {
            handler: this.handleReviewCode.bind(this),
            version: '2024-11-05',
            description: '코드 리뷰'
        });

        logger.info('표준 MCP 메서드 초기화 완료');
    }

    /**
     * JSON-RPC 요청 처리
     */
    async handleRequest(request, session) {
        try {
            // 1. 요청 검증
            const validation = this.validateRequest(request);
            if (!validation.valid) {
                return this.createErrorResponse(validation.error, request.id);
            }

            // 2. 미들웨어 실행
            for (const middleware of this.middlewares) {
                const result = await middleware(request, session);
                if (result && result.block) {
                    return result.response;
                }
            }

            // 3. 메서드 핸들러 실행
            const methodInfo = this.methods.get(request.method);
            if (!methodInfo) {
                return this.createErrorResponse({
                    code: -32601,
                    message: `Method not found: ${request.method}`
                }, request.id);
            }

            // 4. 버전 호환성 확인
            if (!this.isVersionCompatible(methodInfo.version, request.params?.protocolVersion)) {
                return this.createErrorResponse({
                    code: -32602,
                    message: `Version incompatibility: ${request.method} requires ${methodInfo.version}`
                }, request.id);
            }

            // 5. 핸들러 실행
            const result = await methodInfo.handler(request.params, session);
            
            // 6. 응답 생성
            return this.createSuccessResponse(result, request.id);

        } catch (error) {
            logger.error('프로토콜 핸들러 오류:', error);
            return this.createErrorResponse({
                code: -32603,
                message: 'Internal error',
                data: error.message
            }, request.id);
        }
    }

    /**
     * 요청 검증
     */
    validateRequest(request) {
        // JSON-RPC 2.0 형식 검증
        if (!request.jsonrpc || request.jsonrpc !== '2.0') {
            return {
                valid: false,
                error: {
                    code: -32600,
                    message: 'Invalid Request: jsonrpc must be "2.0"'
                }
            };
        }

        if (!request.method || typeof request.method !== 'string') {
            return {
                valid: false,
                error: {
                    code: -32600,
                    message: 'Invalid Request: method is required and must be a string'
                }
            };
        }

        if (request.params && typeof request.params !== 'object') {
            return {
                valid: false,
                error: {
                    code: -32600,
                    message: 'Invalid Request: params must be an object'
                }
            };
        }

        return { valid: true };
    }

    /**
     * 버전 호환성 확인
     */
    isVersionCompatible(requiredVersion, clientVersion) {
        if (!clientVersion) {
            return true; // 클라이언트 버전이 없으면 기본 버전 사용
        }

        return this.supportedVersions.includes(clientVersion) && 
               this.supportedVersions.includes(requiredVersion);
    }

    /**
     * 성공 응답 생성
     */
    createSuccessResponse(result, id) {
        return {
            jsonrpc: '2.0',
            result,
            id
        };
    }

    /**
     * 오류 응답 생성
     */
    createErrorResponse(error, id) {
        return {
            jsonrpc: '2.0',
            error,
            id
        };
    }

    /**
     * initialize 메서드 처리
     */
    async handleInitialize(params, session) {
        const protocolVersion = params?.protocolVersion || this.defaultVersion;
        const clientInfo = params?.clientInfo || {};
        const capabilities = params?.capabilities || {};

        // 세션 초기화
        if (session) {
            session.state.isInitialized = true;
            session.capabilities = capabilities;
            session.clientInfo = clientInfo;
        }

        const serverInfo = {
            name: 'Cursor MCP Server',
            version: '2.0.0',
            protocolVersion,
            capabilities: {
                tools: {
                    listChanged: true
                },
                resources: {
                    subscribe: true,
                    listChanged: true
                },
                prompts: {
                    listChanged: true
                },
                logging: {},
                progress: {}
            }
        };

        logger.info(`클라이언트 초기화: ${clientInfo.name} v${clientInfo.version}`);
        
        return serverInfo;
    }

    /**
     * tools/list 메서드 처리
     */
    async handleListTools(params, session) {
        const tools = [
            {
                name: 'refactor.code',
                description: '코드 리팩토링',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', description: '프로그래밍 언어' },
                        code: { type: 'string', description: '리팩토링할 코드' },
                        refactorType: { type: 'string', description: '리팩토링 타입' },
                        context: { type: 'object', description: '코드 컨텍스트' }
                    },
                    required: ['language', 'code', 'refactorType']
                }
            },
            {
                name: 'complete.code',
                description: '코드 완성',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', description: '프로그래밍 언어' },
                        code: { type: 'string', description: '완성할 코드' },
                        context: { type: 'object', description: '코드 컨텍스트' }
                    },
                    required: ['language', 'code']
                }
            },
            {
                name: 'explain.code',
                description: '코드 설명',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', description: '프로그래밍 언어' },
                        code: { type: 'string', description: '설명할 코드' },
                        context: { type: 'object', description: '코드 컨텍스트' }
                    },
                    required: ['language', 'code']
                }
            },
            {
                name: 'test.generate',
                description: '테스트 생성',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', description: '프로그래밍 언어' },
                        code: { type: 'string', description: '테스트할 코드' },
                        testType: { type: 'string', description: '테스트 타입' },
                        context: { type: 'object', description: '코드 컨텍스트' }
                    },
                    required: ['language', 'code', 'testType']
                }
            },
            {
                name: 'analyze.code',
                description: '코드 분석',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', description: '프로그래밍 언어' },
                        code: { type: 'string', description: '분석할 코드' },
                        analysisType: { type: 'string', description: '분석 타입' },
                        context: { type: 'object', description: '코드 컨텍스트' }
                    },
                    required: ['language', 'code', 'analysisType']
                }
            },
            {
                name: 'review.code',
                description: '코드 리뷰',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', description: '프로그래밍 언어' },
                        code: { type: 'string', description: '리뷰할 코드' },
                        context: { type: 'object', description: '코드 컨텍스트' }
                    },
                    required: ['language', 'code']
                }
            }
        ];

        return { tools };
    }

    /**
     * tools/call 메서드 처리
     */
    async handleCallTool(params, session) {
        const { name, arguments: args } = params;
        
        if (!name) {
            throw new Error('Tool name is required');
        }

        // Cursor AI Engine에 요청 전달
        const result = await this.callCursorAI(name, args, session);
        
        return result;
    }

    /**
     * Cursor AI Engine 호출
     */
    async callCursorAI(toolName, args, session) {
        // Cursor AI Engine으로 요청 전달
        this.emit('cursorAIRequest', {
            toolName,
            args,
            session
        });

        // 실제 구현에서는 Cursor AI Engine과 통신
        // 여기서는 임시 응답 반환
        return {
            success: true,
            result: `Cursor AI 처리 완료: ${toolName}`,
            metadata: {
                toolName,
                timestamp: new Date(),
                sessionId: session?.id
            }
        };
    }

    /**
     * 커스텀 도구 핸들러들
     */
    async handleRefactorCode(params, session) {
        return await this.callCursorAI('refactor.code', params, session);
    }

    async handleCompleteCode(params, session) {
        return await this.callCursorAI('complete.code', params, session);
    }

    async handleExplainCode(params, session) {
        return await this.callCursorAI('explain.code', params, session);
    }

    async handleGenerateTest(params, session) {
        return await this.callCursorAI('test.generate', params, session);
    }

    async handleAnalyzeCode(params, session) {
        return await this.callCursorAI('analyze.code', params, session);
    }

    async handleReviewCode(params, session) {
        return await this.callCursorAI('review.code', params, session);
    }

    /**
     * 리소스 관련 메서드들
     */
    async handleListResources(params, session) {
        return { resources: [] };
    }

    async handleReadResource(params, session) {
        const { uri } = params;
        if (!uri) {
            throw new Error('Resource URI is required');
        }
        
        return {
            uri,
            mimeType: 'text/plain',
            text: 'Resource content'
        };
    }

    /**
     * 프롬프트 관련 메서드들
     */
    async handleListPrompts(params, session) {
        return { prompts: [] };
    }

    async handleGetPrompt(params, session) {
        const { name } = params;
        if (!name) {
            throw new Error('Prompt name is required');
        }
        
        return {
            name,
            description: 'Prompt description',
            arguments: []
        };
    }

    /**
     * 미들웨어 추가
     */
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
        logger.info('프로토콜 핸들러 미들웨어 추가됨');
    }

    /**
     * 커스텀 메서드 추가
     */
    addMethod(name, handler, version = this.defaultVersion, description = '') {
        this.methods.set(name, {
            handler,
            version,
            description
        });
        logger.info(`커스텀 메서드 추가됨: ${name}`);
    }

    /**
     * 지원되는 메서드 목록 조회
     */
    getSupportedMethods() {
        return Array.from(this.methods.entries()).map(([name, info]) => ({
            name,
            version: info.version,
            description: info.description
        }));
    }

    /**
     * 프로토콜 핸들러 통계 조회
     */
    getStats() {
        return {
            supportedMethods: this.methods.size,
            supportedVersions: this.supportedVersions,
            middlewares: this.middlewares.length
        };
    }
}

module.exports = ProtocolHandler;
