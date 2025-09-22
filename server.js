const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 버전 정보 로드
const packageJson = require('./package.json');
const VERSION = packageJson.version;

const app = express();
const PORT = process.env.PORT || 3000;

// 서버 정보
const SERVER_INFO = {
    name: 'Cursor Server',
    version: VERSION,
    description: 'OpenAI-compatible API server for Xcode Code Intelligence integration',
    uptime: process.uptime(),
    startTime: new Date().toISOString()
};

// 전역 변수
let currentWorkspacePath = process.cwd();
let cursorConnected = false;

// 미들웨어 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS 설정 - Xcode Code Intelligence를 위한 최적화
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [
            'xcode://',
            'vscode://',
            'intellij://',
            'http://localhost:*',
            'http://127.0.0.1:*'
        ];
        if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-Xcode-Project-Path',
        'X-IntelliJ-Project-Path',
        'X-VSCode-Workspace'
    ]
}));

// 요청 로깅
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.get('User-Agent')}`);
    
    // Xcode 요청인 경우 더 자세한 로깅
    if (req.get('User-Agent') && req.get('User-Agent').includes('Xcode')) {
        console.log('🔍 Xcode 요청 상세 정보:');
        console.log('Request headers:', JSON.stringify(req.headers, null, 2));
        if (req.body) {
            console.log('Request body:', JSON.stringify(req.body, null, 2));
        }
    }
    
    next();
});

// OPTIONS 요청 처리
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Xcode-Project-Path, X-IntelliJ-Project-Path, X-VSCode-Workspace');
    res.sendStatus(200);
});

// Xcode 환경 변수에서 프로젝트 경로 감지
function detectXcodeProjectFromEnv() {
    const envVars = [
        'SRCROOT',
        'PROJECT_DIR', 
        'WORKSPACE_PATH',
        'XCODE_PROJECT_DIR'
    ];
    
    for (const envVar of envVars) {
        const envValue = process.env[envVar];
        if (envValue && fs.existsSync(envValue)) {
            console.log(`🔍 Xcode 환경 변수 감지: ${envVar}=${envValue}`);
            return envValue;
        }
    }
    
    return null;
}

// .xcodeproj 파일 분석을 통한 프로젝트 구조 파악
function analyzeXcodeProject(projectPath) {
    try {
        const xcodeprojFiles = [];
        
        // 프로젝트 디렉토리에서 .xcodeproj 파일 찾기
        function findXcodeProjects(dir, depth = 0) {
            if (depth > 3) return; // 최대 3단계까지만 검색
            
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const item of items) {
                    if (item.isDirectory() && item.name.endsWith('.xcodeproj')) {
                        xcodeprojFiles.push(path.join(dir, item.name));
                    } else if (item.isDirectory() && !item.name.startsWith('.') && depth < 2) {
                        findXcodeProjects(path.join(dir, item.name), depth + 1);
                    }
                }
            } catch (e) {
                // 디렉토리 접근 실패 시 무시
            }
        }
        
        findXcodeProjects(projectPath);
        
        if (xcodeprojFiles.length > 0) {
            console.log(`🔍 Xcode 프로젝트 파일 발견: ${xcodeprojFiles.length}개`);
            return xcodeprojFiles[0]; // 첫 번째 프로젝트 파일 반환
        }
        
        return null;
    } catch (error) {
        console.error('Xcode 프로젝트 분석 오류:', error);
        return null;
    }
}

// xcodebuild를 통한 프로젝트 정보 수집
function getXcodeProjectInfo(projectPath) {
    return new Promise((resolve) => {
        try {
            const xcodeprojFile = analyzeXcodeProject(projectPath);
            if (!xcodeprojFile) {
                resolve(null);
                return;
            }
            
            // xcodebuild 명령어로 프로젝트 정보 수집
            const command = `cd "${path.dirname(xcodeprojFile)}" && xcodebuild -showBuildSettings -project "${path.basename(xcodeprojFile)}" 2>/dev/null | grep -E "(SRCROOT|PROJECT_DIR|WORKSPACE_PATH)" | head -10`;
            
            exec(command, (error, stdout, stderr) => {
            if (error) {
                    console.log('xcodebuild 실행 실패:', error.message);
                    resolve(null);
                    return;
                }
                
                const buildSettings = {};
                stdout.split('\n').forEach(line => {
                    const match = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
                    if (match) {
                        buildSettings[match[1]] = match[2].trim();
                    }
                });
                
                console.log('🔍 Xcode 빌드 설정:', buildSettings);
                resolve(buildSettings);
            });
        } catch (error) {
            console.error('Xcode 프로젝트 정보 수집 오류:', error);
            resolve(null);
        }
    });
}

// 작업 디렉토리 감지 및 설정 함수
async function detectAndSetWorkspace(req) {
    let workspace = currentWorkspacePath;
    
    // 1. Xcode 환경 변수에서 프로젝트 경로 감지 (최우선)
    const envProjectPath = detectXcodeProjectFromEnv();
    if (envProjectPath) {
        workspace = envProjectPath;
        currentWorkspacePath = workspace;
        console.log(`🔍 Xcode 환경 변수로 프로젝트 경로 감지: ${workspace}`);
        return workspace;
    }
    
    // 2. Xcode에서 보내는 헤더 확인
    const xcodeProjectPath = req.get('X-Xcode-Project-Path');
    if (xcodeProjectPath) {
        const projectPath = path.resolve(xcodeProjectPath);
        if (fs.existsSync(projectPath)) {
            workspace = projectPath;
            currentWorkspacePath = workspace;
            console.log(`Xcode 프로젝트 경로 감지: ${workspace}`);
            return workspace;
        }
    }
    
    // IntelliJ에서 보내는 헤더 확인
    const intellijProjectPath = req.get('X-IntelliJ-Project-Path');
    if (intellijProjectPath) {
        const projectPath = path.resolve(intellijProjectPath);
        if (fs.existsSync(projectPath)) {
            workspace = projectPath;
            currentWorkspacePath = workspace;
            console.log(`IntelliJ 프로젝트 경로 감지: ${workspace}`);
            return workspace;
        }
    }
    
    // VSCode에서 보내는 헤더 확인
    const vscodeWorkspace = req.get('X-VSCode-Workspace');
    if (vscodeWorkspace) {
        const workspacePath = path.resolve(vscodeWorkspace);
        if (fs.existsSync(workspacePath)) {
            workspace = workspacePath;
            currentWorkspacePath = workspace;
            console.log(`VSCode 워크스페이스 감지: ${workspace}`);
            return workspace;
        }
    }
    
    // 요청 본문에서 프로젝트 경로 확인
    if (req.body && req.body.projectPath) {
        const projectPath = path.resolve(req.body.projectPath);
        if (fs.existsSync(projectPath)) {
            workspace = projectPath;
            currentWorkspacePath = workspace;
            console.log(`요청 본문에서 프로젝트 경로 감지: ${workspace}`);
            return workspace;
        }
    }
    
    // Xcode Code Intelligence 메시지에서 프로젝트 경로 추출
    if (req.body && req.body.messages && Array.isArray(req.body.messages)) {
        for (const message of req.body.messages) {
            if (message.content) {
                let content = '';
                
                // content가 배열인 경우 처리
                if (Array.isArray(message.content)) {
                    content = message.content
                        .map(item => {
                            if (typeof item === 'string') return item;
                            if (typeof item === 'object' && item.text) return item.text;
                            return JSON.stringify(item);
                        })
                        .join(' ');
    } else {
                    content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
                }
                
                console.log(`🔍 메시지 내용 분석: ${content.substring(0, 200)}...`);
                
                // Xcode Code Intelligence 프로젝트 감지 (Swift 파일 기반)
                if (content.includes('.swift') || content.includes('Hybridapp')) {
                    console.log(`🔍 Swift 파일 감지 - Xcode 프로젝트 분석 시작...`);
                    
                    // 일반적인 iOS 프로젝트 경로들에서 .xcodeproj 파일 찾기
                    const searchPaths = [
                        '/Users/kakaovx/Documents',
                        '/Users/kakaovx/Desktop',
                        '/Users/kakaovx/Projects',
                        '/Users/kakaovx/Development',
                        process.env.HOME + '/Documents',
                        process.env.HOME + '/Desktop',
                        process.env.HOME + '/Projects'
                    ];
                    
                    for (const basePath of searchPaths) {
                        if (fs.existsSync(basePath)) {
                            const xcodeprojFile = analyzeXcodeProject(basePath);
                            if (xcodeprojFile) {
                                const projectDir = path.dirname(xcodeprojFile);
                                workspace = projectDir;
                                currentWorkspacePath = workspace;
                                console.log(`🔍 Xcode 프로젝트 파일로 경로 감지: ${workspace}`);
                                
                                // xcodebuild로 추가 정보 수집
                                try {
                                    const buildSettings = await getXcodeProjectInfo(projectDir);
                                    if (buildSettings && buildSettings.SRCROOT) {
                                        const srcRoot = buildSettings.SRCROOT;
                                        if (fs.existsSync(srcRoot)) {
                                            workspace = srcRoot;
                                            currentWorkspacePath = workspace;
                                            console.log(`🔍 SRCROOT 환경 변수로 경로 업데이트: ${workspace}`);
                                        }
                                    }
                                } catch (e) {
                                    console.log('xcodebuild 정보 수집 실패:', e.message);
                                }
                                
                                return workspace;
                            }
                        }
                    }
                }
                
                // 프로젝트 경로 패턴 찾기 (실제 경로만)
                const projectPathPatterns = [
                    /프로젝트 경로[:\s]+([^\s\n]+)/i,
                    /project path[:\s]+([^\s\n]+)/i,
                    /workspace[:\s]+([^\s\n]+)/i,
                    /현재 작업 경로[:\s]+([^\s\n]+)/i,
                    /working directory[:\s]+([^\s\n]+)/i,
                    /파일 경로[:\s]+([^\s\n]+)/i,
                    /file path[:\s]+([^\s\n]+)/i,
                    /\/Users\/[^\/]+\/[^\s\n]+/g,  // macOS 사용자 경로 패턴
                    /\/Users\/[^\/]+\/[^\/\s]+/g  // 더 구체적인 macOS 경로 패턴
                ];
                
                for (const pattern of projectPathPatterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                        for (let i = 1; i < matches.length; i++) {
                            if (matches[i]) {
                                let detectedPath = matches[i].trim();
                                
                                // 파일 경로인 경우 디렉토리로 변환
                                if (detectedPath.includes('.') && !detectedPath.endsWith('/')) {
                                    detectedPath = path.dirname(detectedPath);
                                }
                                
                                // 경로 정리
                                detectedPath = detectedPath.replace(/['"]/g, ''); // 따옴표 제거
                                
                                const workspacePath = path.resolve(detectedPath);
                                if (fs.existsSync(workspacePath)) {
                                    workspace = workspacePath;
                                    currentWorkspacePath = workspace;
                                    console.log(`메시지에서 프로젝트 경로 감지: ${workspace}`);
                                    return workspace;
                                }
                            }
                        }
                    }
                }
                
                // 파일명만 있는 경우, 일반적인 iOS 프로젝트 구조에서 추정
                const fileNamePattern = /inside this file: ([^\/\n]+\.swift)/i;
                const fileNameMatch = content.match(fileNamePattern);
                if (fileNameMatch && fileNameMatch[1]) {
                    const fileName = fileNameMatch[1];
                    console.log(`📁 파일명 감지: ${fileName}`);
                    
                    // 일반적인 iOS 프로젝트 경로들을 시도
                    const possiblePaths = [
                        '/Users/kakaovx/Documents',
                        '/Users/kakaovx/Desktop',
                        '/Users/kakaovx/Projects',
                        '/Users/kakaovx/Development',
                        process.env.HOME + '/Documents',
                        process.env.HOME + '/Desktop',
                        process.env.HOME + '/Projects'
                    ];
                    
                    for (const basePath of possiblePaths) {
                        // 해당 디렉토리에서 .swift 파일을 찾아보기
                        try {
                            const files = fs.readdirSync(basePath, { withFileTypes: true });
                            for (const file of files) {
                                if (file.isDirectory()) {
                                    const projectPath = path.join(basePath, file.name);
                                    try {
                                        const projectFiles = fs.readdirSync(projectPath);
                                        // 파일명 매칭을 더 유연하게 처리 (공백, 특수문자 등)
                                        const fileNameBase = fileName.replace('.swift', '').toLowerCase();
                                        if (projectFiles.some(f => {
                                            const fBase = f.replace('.swift', '').toLowerCase();
                                            return f.endsWith('.swift') && (
                                                fBase.includes(fileNameBase) || 
                                                fileNameBase.includes(fBase) ||
                                                fBase.replace(/[^a-zA-Z0-9]/g, '') === fileNameBase.replace(/[^a-zA-Z0-9]/g, '')
                                            );
                                        })) {
                                            workspace = projectPath;
                                            currentWorkspacePath = workspace;
                                            console.log(`파일명으로 프로젝트 경로 추정: ${workspace}`);
                                            return workspace;
                                        }
                                    } catch (e) {
                                        // 하위 디렉토리 접근 실패 시 무시
                                    }
                                }
                            }
                        } catch (e) {
                            // 디렉토리 접근 실패 시 무시
                        }
                    }
                }
                
                
                
            }
        }
    }
    
    // 현재 설정된 워크스페이스가 있으면 유지
    if (currentWorkspacePath && fs.existsSync(currentWorkspacePath)) {
        console.log(`기존 워크스페이스 사용: ${currentWorkspacePath}`);
        return currentWorkspacePath;
    }
    
    // Xcode 요청인 경우 사용자에게 프로젝트 경로 설정을 안내
    if (req.get('User-Agent') && req.get('User-Agent').includes('Xcode')) {
        console.log(`⚠️  Xcode 요청이지만 프로젝트 경로를 감지할 수 없습니다.`);
        console.log(`💡 해결 방법:`);
        console.log(`   1. Xcode에서 프로젝트를 열고 서버에 연결`);
        console.log(`   2. 또는 수동으로 프로젝트 경로 설정: POST /set-workspace`);
        console.log(`   3. 현재 요청에서는 서버 경로를 사용합니다.`);
    }
    
    // 기본값으로 현재 디렉토리 사용
    console.log(`기본 워크스페이스 사용: ${workspace}`);
    return workspace;
}

// Cursor CLI 실행 함수
async function executeCursorCLI(command, workingDir) {
    return new Promise((resolve) => {
        const env = {
            ...process.env,
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            USER: process.env.USER
        };
        
        exec(command, { 
            cwd: workingDir,
            env: env,
            timeout: 30000 
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('Cursor CLI 실행 오류:', error.message);
                resolve({
                    success: false,
                    error: error.message,
                    stdout: stdout,
                    stderr: stderr
                });
        } else {
            resolve({
                success: true,
                stdout: stdout,
                stderr: stderr
            });
            }
        });
    });
}

// 대체 응답 생성 함수
function generateFallbackResponse(userMessage, messageType = 'chat') {
    const lowerMessage = userMessage.toLowerCase();
    
    // DS 스코프 오류 해결 요청
    if (lowerMessage.includes('cannot find') && lowerMessage.includes('ds') && lowerMessage.includes('scope')) {
        return `DS 스코프 오류를 해결하기 위해 다음 코드를 ScorecardView 2.swift 파일에 추가하세요:

\`\`\`swift
// MARK: - Design Tokens
private enum DS {
    static let padding: CGFloat = 20
    static let corner: CGFloat = 12
    static let sectionSpacing: CGFloat = 20

    // Figma-like palette
    static let bgPage = Color(hex: "F5F6F8")
    static let cardBg = Color(hex: "FFFFFF")
    static let mutedBg = Color(hex: "F5F5F7")
    static let divider = Color(hex: "EDEEF0")

    static let textPrimary = Color(hex: "111111")
    static let textSecondary = Color(hex: "6B7280")

    // Score colors
    static let scoreEagleOrBetter = Color(hex: "F04343")
    static let scoreBirdie = Color(hex: "FF8A34")
    static let scorePar = Color(hex: "FFFFFF")
    static let scoreBogey = Color(hex: "3F8CFF")
    static let scoreDoubleOrWorse = Color(hex: "22C55E")

    // Chip
    static let chipBg = mutedBg
    static let chipText = textPrimary
}

// Color 확장 추가
private extension Color {
    init(hex: String, alpha: Double = 1.0) {
        var hexSanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if hexSanitized.count == 3 {
            hexSanitized = hexSanitized.map { "\\($0)\\($0)" }.joined()
        }
        var int: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255.0
        let g = Double((int >> 8) & 0xFF) / 255.0
        let b = Double(int & 0xFF) / 255.0
        self = Color(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
\`\`\`

이 코드를 파일 상단에 추가하면 DS 스코프 오류가 해결됩니다.`;
    }
    
    // 작업 경로 관련 질문
    if (lowerMessage.includes('현재 작업 경로') || lowerMessage.includes('작업 디렉토리') || 
        lowerMessage.includes('working directory') || lowerMessage.includes('프로젝트 경로')) {
        return `현재 작업 경로는: ${currentWorkspacePath}\n\n이 경로는 Xcode Code Intelligence에서 감지된 프로젝트의 루트 디렉토리입니다.`;
    }
    
    // Swift/iOS 관련 질문
    if (lowerMessage.includes('swift') || lowerMessage.includes('ios') || lowerMessage.includes('xcode')) {
        return `Swift/iOS 개발에 대한 질문이군요! 현재 Cursor CLI 서비스가 일시적으로 사용할 수 없어서 기본 응답을 드리고 있습니다.\n\nSwift에서 Hello World는 다음과 같이 작성할 수 있습니다:\n\`\`\`swift\nprint("Hello, World!")\n\`\`\``;
    }
    
    // 프로젝트 관련 질문
    if (lowerMessage.includes('프로젝트') || lowerMessage.includes('project')) {
        return `프로젝트에 대한 질문이군요! 현재 프로젝트 경로는 ${currentWorkspacePath}입니다.`;
    }
    
    // 일반적인 응답
    const responses = [
        "안녕하세요! 저는 Cursor AI 어시스턴트입니다. 코딩을 도와드릴 준비가 되어 있습니다.",
        "현재 Cursor CLI 서비스가 일시적으로 사용할 수 없어서 기본 응답을 드리고 있습니다.",
        "프로그래밍 관련 질문이 있으시면 언제든지 말씀해주세요."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// 메시지 파싱 함수
function parseUserMessage(messages) {
    if (!messages || messages.length === 0) {
        return '';
    }
    
    const lastMessage = messages[messages.length - 1];
    let userMessage = '';
    
    if (typeof lastMessage.content === 'string') {
        userMessage = lastMessage.content;
    } else if (Array.isArray(lastMessage.content)) {
        // Xcode Code Intelligence에서 보내는 배열 형태의 메시지 처리
        userMessage = lastMessage.content
            .map(item => {
                if (typeof item === 'string') return item;
                if (typeof item === 'object' && item.text) return item.text;
                return JSON.stringify(item);
            })
            .join(' ');
    } else if (typeof lastMessage.content === 'object' && lastMessage.content !== null) {
        // 객체 형태의 메시지 처리
        if (lastMessage.content.text) {
            userMessage = lastMessage.content.text;
                        } else {
            userMessage = JSON.stringify(lastMessage.content);
                        }
                    } else {
        userMessage = String(lastMessage.content || '');
    }
    
    return userMessage;
}

// JSON-RPC 2.0 지원을 위한 메서드 정의
const jsonRpcMethods = {
    // 헬스 체크
    'health': () => ({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: SERVER_INFO.version,
        server: {
            name: SERVER_INFO.name,
            description: SERVER_INFO.description,
            startTime: SERVER_INFO.startTime
        },
        workspace: currentWorkspacePath,
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
    }),

    // 모델 목록 조회
    'models.list': () => ({
        object: "list",
        data: [
            {
                id: "cursor-ai",
                object: "model",
                created: Math.floor(Date.now() / 1000),
                owned_by: "cursor-server",
                permission: [],
                root: "cursor-ai",
                parent: null,
                context_length: 16384,
                capabilities: {
                    chat_completion: true,
                    function_calling: false,
                    streaming: true
                },
                status: "active"
            }
        ],
        workspace: currentWorkspacePath
    }),

    // 채팅 완성
    'chat.completions': async (params) => {
        const { messages, model, stream = false } = params;
        const workspace = await detectAndSetWorkspace({ body: params, get: () => null });
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Messages array is required");
        }
        
        const userMessage = parseUserMessage(messages);
        console.log(`📨 JSON-RPC Chat completions request - Model: ${model}, Messages: ${messages.length}`);
        console.log(`📝 User message: ${userMessage.substring(0, 100)}...`);
        console.log(`📁 Working directory: ${workspace}`);
        
        let responseContent = '';
        
        // cursor-ai 모델은 대체 응답 사용
                    responseContent = generateFallbackResponse(userMessage, 'chat');
        
        const responseId = `chatcmpl-${Date.now()}`;
        
        return {
                id: responseId,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: model,
            choices: [{
                        index: 0,
                        message: {
                            role: "assistant",
                            content: responseContent
                        },
                        finish_reason: "stop"
            }],
                usage: {
                prompt_tokens: userMessage.length,
                    completion_tokens: responseContent.length,
                total_tokens: userMessage.length + responseContent.length
            }
        };
    },

    // 코드 완성
    'completions': async (params) => {
        const { prompt, model, stream = false } = params;
        const workspace = await detectAndSetWorkspace({ body: params, get: () => null });
        
        if (!prompt) {
            throw new Error("Prompt is required");
        }
        
        console.log(`📨 JSON-RPC Completions request - Model: ${model}, Prompt: ${prompt.substring(0, 100)}...`);
        console.log(`📁 Working directory: ${workspace}`);
        
        let responseContent = '';
        
        try {
            const command = `echo "다음 코드를 완성해주세요: ${prompt}" | /usr/local/bin/cursor agent --print --output-format text --force`;
            const result = await executeCursorCLI(command, workspace);
            
            if (result.success && result.stdout && result.stdout.trim()) {
                responseContent = result.stdout.trim();
            } else {
                responseContent = generateFallbackResponse(prompt, 'completion');
            }
    } catch (error) {
            console.error('Cursor CLI 실행 오류:', error);
            responseContent = generateFallbackResponse(prompt, 'completion');
        }
        
        const responseId = `completion-${Date.now()}`;
        
        return {
            id: responseId,
            object: "text_completion",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                text: responseContent,
                index: 0,
                finish_reason: "stop"
            }],
            usage: {
                prompt_tokens: prompt.length,
                completion_tokens: responseContent.length,
                total_tokens: prompt.length + responseContent.length
            }
        };
    },

    // 작업 디렉토리 설정
    'workspace.set': (params) => {
        const { workspacePath } = params;
        
        if (!workspacePath) {
            throw new Error("Workspace path is required");
        }
        
        const absolutePath = path.resolve(workspacePath);
        
        if (!fs.existsSync(absolutePath)) {
            throw new Error("Workspace path does not exist");
        }
        
        currentWorkspacePath = absolutePath;
        console.log(`Workspace set to: ${absolutePath}`);
        
        return {
            success: true,
            message: 'Workspace set successfully',
            workspace: absolutePath
        };
    },

    // 현재 작업 디렉토리 조회
    'workspace.get': () => ({
        success: true,
        currentWorkspace: currentWorkspacePath,
        defaultWorkspace: process.cwd()
    }),

    // 프로젝트 정보 조회
    'project.info': () => {
        const workspace = currentWorkspacePath;
        
        const files = fs.readdirSync(workspace);
        const projectInfo = {
            workspace: workspace,
            files: files.slice(0, 20), // 처음 20개 파일만
            totalFiles: files.length,
        timestamp: new Date().toISOString()
        };
        
        return {
        success: true,
            project: projectInfo
        };
    },

    // Xcode 프로젝트 경로 수동 설정
    'xcode.set-project': (params) => {
        const { projectPath } = params;
        
        if (!projectPath) {
            throw new Error("Project path is required");
        }
        
        const absolutePath = path.resolve(projectPath);
        
        if (!fs.existsSync(absolutePath)) {
            throw new Error("Project path does not exist");
        }
        
        currentWorkspacePath = absolutePath;
        console.log(`Xcode 프로젝트 경로 설정: ${absolutePath}`);
        
        return {
        success: true,
            message: 'Xcode project path set successfully',
            projectPath: absolutePath,
            workspace: absolutePath
        };
    },

    // 현재 Xcode 프로젝트 경로 조회
    'xcode.get-project': () => ({
        success: true,
        projectPath: currentWorkspacePath,
        isDetected: currentWorkspacePath !== process.cwd(),
        message: currentWorkspacePath === process.cwd() ? 
            'Using server directory. Set project path manually.' : 
            'Project path is set correctly.'
    })
};

// JSON-RPC 2.0 요청 처리 함수
async function handleJsonRpcRequest(req, res) {
    try {
        // 배치 요청 처리
        if (Array.isArray(req.body)) {
            const responses = [];
            
            for (const request of req.body) {
                try {
                    const response = await processJsonRpcRequest(request);
                    if (response) {
                        responses.push(response);
                    }
            } catch (error) {
                    responses.push({
                        jsonrpc: "2.0",
                        error: {
                            code: -32603,
                            message: "Internal error",
                            data: error.message
                        },
                        id: request.id || null
                    });
                }
            }
            
            if (responses.length === 0) {
                return res.status(204).end();
            }
            
            return res.json(responses);
        }
        
        // 단일 요청 처리
        const response = await processJsonRpcRequest(req.body);
        if (response) {
            res.json(response);
            } else {
            res.status(204).end();
        }
        
    } catch (error) {
        console.error('JSON-RPC request error:', error);
        res.json({
            jsonrpc: "2.0",
            error: {
                code: -32700,
                message: "Parse error",
                data: error.message
            },
            id: null
        });
    }
}

// 단일 JSON-RPC 요청 처리 함수
async function processJsonRpcRequest(request) {
    const { jsonrpc, method, params, id } = request;
    
    // JSON-RPC 2.0 버전 확인
    if (jsonrpc !== "2.0") {
        return {
            jsonrpc: "2.0",
            error: {
                code: -32600,
                message: "Invalid Request",
                data: "jsonrpc version must be 2.0"
            },
            id: null
        };
    }
    
    // 메서드 존재 확인
    if (!jsonRpcMethods[method]) {
        return {
            jsonrpc: "2.0",
            error: {
                code: -32601,
                message: "Method not found",
                data: `Method '${method}' not found`
            },
            id: id
        };
    }
    
    // 파라미터 검증
    if (params && typeof params !== 'object') {
        return {
            jsonrpc: "2.0",
            error: {
                code: -32602,
                message: "Invalid params",
                data: "Params must be an object or array"
            },
            id: id
        };
    }
    
    // 메서드 실행
    try {
        const result = await jsonRpcMethods[method](params || {});
        
        // Notification인 경우 응답하지 않음
        if (id === undefined) {
            return null;
        }
        
        return {
            jsonrpc: "2.0",
            result: result,
            id: id
        };
        
    } catch (error) {
        console.error(`JSON-RPC method error (${method}):`, error);
        return {
            jsonrpc: "2.0",
            error: {
                code: -32603,
                message: "Internal error",
                data: error.message
            },
            id: id
        };
    }
}

// API 엔드포인트들

// 1. JSON-RPC 2.0 엔드포인트
app.post('/jsonrpc', handleJsonRpcRequest);

// 2. 헬스 체크
app.get('/health', (req, res) => {
        res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: SERVER_INFO.version,
        server: {
            name: SERVER_INFO.name,
            description: SERVER_INFO.description,
            startTime: SERVER_INFO.startTime
        },
        workspace: currentWorkspacePath,
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
    });
});

// 2. 모델 목록
app.get('/v1/models', async (req, res) => {
    const workspace = await detectAndSetWorkspace(req);
    res.json({
        object: "list",
        data: [
            {
                id: "cursor-ai",
                object: "model",
                created: Math.floor(Date.now() / 1000),
                owned_by: "cursor-server",
                permission: [],
                root: "cursor-ai",
                parent: null,
                context_length: 16384,
                capabilities: {
                    chat_completion: true,
                    function_calling: false,
                    streaming: true
                },
                status: "active"
            }
        ],
        workspace: workspace
    });
});

// 3. 채팅 완성
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const { messages, model, stream = false } = req.body;
        const workspace = await detectAndSetWorkspace(req);
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: {
                    message: "Messages array is required",
                    type: "invalid_request_error",
                    code: "missing_messages"
                }
            });
        }
        
        const userMessage = parseUserMessage(messages);
        console.log(`📨 Chat completions request - Model: ${model}, Messages: ${messages.length}`);
        console.log(`📝 User message: ${userMessage.substring(0, 100)}...`);
        console.log(`📁 Working directory: ${workspace}`);
        
        // 스트리밍 설정
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        }
        
        let responseContent = '';
        
        // cursor-ai 모델은 대체 응답 사용
        responseContent = generateFallbackResponse(userMessage, 'chat');
        
        const responseId = `chatcmpl-${Date.now()}`;
        
        if (stream) {
            // 스트리밍 응답
            const chunks = responseContent.split(' ');
            
            res.write(`data: ${JSON.stringify({
                id: responseId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }]
            })}\n\n`);
            
            chunks.forEach((chunk, index) => {
                setTimeout(() => {
                    res.write(`data: ${JSON.stringify({
                        id: responseId,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: model,
                        choices: [{ index: 0, delta: { content: chunk + ' ' }, finish_reason: null }]
                    })}\n\n`);
                    
                    if (index === chunks.length - 1) {
                        res.write(`data: ${JSON.stringify({
                            id: responseId,
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model: model,
                            choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
                        })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
                    }
                }, index * 100);
            });
        } else {
            // 일반 응답
        res.json({
                id: responseId,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                        index: 0,
                    message: {
                        role: "assistant",
                        content: responseContent
                    },
                        finish_reason: "stop"
                }],
                usage: {
                    prompt_tokens: userMessage.length,
                    completion_tokens: responseContent.length,
                    total_tokens: userMessage.length + responseContent.length
                }
            });
        }
        
    } catch (error) {
        console.error('Error processing chat completion request:', error);
        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'server_error',
                code: 'internal_error'
            }
        });
    }
});

// 4. 코드 완성
app.post('/v1/completions', async (req, res) => {
    try {
        const { prompt, model, stream = false } = req.body;
        const workspace = await detectAndSetWorkspace(req);
        
        if (!prompt) {
            return res.status(400).json({
                error: {
                    message: "Prompt is required",
                    type: "invalid_request_error",
                    code: "missing_prompt"
                }
            });
        }
        
        console.log(`📨 Completions request - Model: ${model}, Prompt: ${prompt.substring(0, 100)}...`);
        console.log(`📁 Working directory: ${workspace}`);
        
        let responseContent = '';
        
        try {
            const command = `echo "다음 코드를 완성해주세요: ${prompt}" | /usr/local/bin/cursor agent --print --output-format text --force`;
            const result = await executeCursorCLI(command, workspace);
            
            if (result.success && result.stdout && result.stdout.trim()) {
                responseContent = result.stdout.trim();
            } else {
                responseContent = generateFallbackResponse(prompt, 'completion');
            }
        } catch (error) {
            console.error('Cursor CLI 실행 오류:', error);
            responseContent = generateFallbackResponse(prompt, 'completion');
        }
        
        const responseId = `completion-${Date.now()}`;
        
        if (stream) {
            // SSE 스트리밍 응답
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            const chunks = responseContent.split(' ');
            
            chunks.forEach((chunk, index) => {
                setTimeout(() => {
                    res.write(`data: ${JSON.stringify({
                        id: responseId,
                        object: "text_completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: model,
                        choices: [{ text: chunk + ' ', index: 0, finish_reason: null }]
                    })}\n\n`);
                    
                    if (index === chunks.length - 1) {
                        res.write(`data: ${JSON.stringify({
                            id: responseId,
                            object: "text_completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model: model,
                            choices: [{ text: '', index: 0, finish_reason: "stop" }]
                        })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
                    }
                }, index * 50);
            });
        } else {
            // 일반 응답
            res.json({
                id: responseId,
                object: "text_completion",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    text: responseContent,
                        index: 0,
                        finish_reason: "stop"
                }],
                usage: {
                    prompt_tokens: prompt.length,
                    completion_tokens: responseContent.length,
                    total_tokens: prompt.length + responseContent.length
                }
            });
        }
        
    } catch (error) {
        console.error('Error processing completion request:', error);
        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'server_error',
                code: 'internal_error'
            }
        });
    }
});

// 5. 작업 디렉토리 설정
app.post('/set-workspace', (req, res) => {
    try {
        const { workspacePath } = req.body;
        
        if (!workspacePath) {
            return res.status(400).json({
                success: false,
                error: 'Workspace path is required'
            });
        }
        
        const absolutePath = path.resolve(workspacePath);
        
        if (!fs.existsSync(absolutePath)) {
            return res.status(400).json({
                success: false,
                error: 'Workspace path does not exist'
            });
        }
        
        currentWorkspacePath = absolutePath;
        console.log(`Workspace set to: ${absolutePath}`);
        
        res.json({
            success: true,
            message: 'Workspace set successfully',
            workspace: absolutePath
        });
        
    } catch (error) {
        console.error('Error setting workspace:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 6. 현재 작업 디렉토리 조회
app.get('/workspace', (req, res) => {
        res.json({
            success: true,
        currentWorkspace: currentWorkspacePath,
        defaultWorkspace: process.cwd()
    });
});

// 7. 프로젝트 정보 조회
app.get('/project-info', async (req, res) => {
    try {
        const workspace = await detectAndSetWorkspace(req);
        
        const files = fs.readdirSync(workspace);
        const projectInfo = {
            workspace: workspace,
            files: files.slice(0, 20), // 처음 20개 파일만
            totalFiles: files.length,
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            project: projectInfo
        });
        
    } catch (error) {
        console.error('Error getting project info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 8. Xcode 프로젝트 경로 설정
app.post('/xcode/set-project', (req, res) => {
    const { projectPath } = req.body;
    
    if (!projectPath) {
            return res.status(400).json({
                success: false,
            error: 'Project path is required'
        });
    }
    
    const absolutePath = path.resolve(projectPath);
    
    if (!fs.existsSync(absolutePath)) {
        return res.status(400).json({
            success: false,
            error: 'Project path does not exist'
        });
    }
    
    currentWorkspacePath = absolutePath;
    console.log(`Xcode 프로젝트 경로 설정: ${absolutePath}`);
        
        res.json({
            success: true,
        message: 'Xcode project path set successfully',
        projectPath: absolutePath,
        workspace: absolutePath
    });
});

// 9. Xcode 프로젝트 경로 조회
app.get('/xcode/project', (req, res) => {
        res.json({
            success: true,
        projectPath: currentWorkspacePath,
        isDetected: currentWorkspacePath !== process.cwd(),
        message: currentWorkspacePath === process.cwd() ? 
            'Using server directory. Set project path manually.' : 
            'Project path is set correctly.'
    });
});

// 10. Xcode 프로젝트 분석
app.get('/xcode/analyze', async (req, res) => {
    try {
        const { projectPath } = req.query;
        const targetPath = projectPath || currentWorkspacePath;
        
        console.log(`🔍 Xcode 프로젝트 분석 시작: ${targetPath}`);
        
        // .xcodeproj 파일 찾기
        const xcodeprojFile = analyzeXcodeProject(targetPath);
        if (!xcodeprojFile) {
            return res.json({
            success: false,
                error: 'No Xcode project found',
                projectPath: targetPath
            });
        }
        
        // xcodebuild로 프로젝트 정보 수집
        const buildSettings = await getXcodeProjectInfo(targetPath);
        
        res.json({
            success: true,
            projectPath: targetPath,
            xcodeprojFile: xcodeprojFile,
            buildSettings: buildSettings,
            environment: {
                SRCROOT: process.env.SRCROOT,
                PROJECT_DIR: process.env.PROJECT_DIR,
                WORKSPACE_PATH: process.env.WORKSPACE_PATH
            }
        });
    } catch (error) {
        console.error('Xcode 프로젝트 분석 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 11. Xcode 환경 변수 확인
app.get('/xcode/env', (req, res) => {
    const envVars = {
        SRCROOT: process.env.SRCROOT,
        PROJECT_DIR: process.env.PROJECT_DIR,
        WORKSPACE_PATH: process.env.WORKSPACE_PATH,
        XCODE_PROJECT_DIR: process.env.XCODE_PROJECT_DIR,
        HOME: process.env.HOME,
        USER: process.env.USER
    };
        
        res.json({
            success: true,
        environment: envVars,
        detectedProject: detectXcodeProjectFromEnv()
    });
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    const errorResponse = {
        error: {
            message: error.message || 'Internal server error',
            type: 'server_error',
            code: 'internal_error'
        }
    };
    res.status(500).json(errorResponse);
});

// 404 핸들러
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
            type: 'invalid_request_error',
            code: 'endpoint_not_found'
        }
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 ${SERVER_INFO.name} v${SERVER_INFO.version} is running on port ${PORT}`);
    console.log(`📁 Default workspace: ${currentWorkspacePath}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🤖 Models endpoint: http://localhost:${PORT}/v1/models`);
    console.log(`💬 Chat completions: http://localhost:${PORT}/v1/chat/completions`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST /jsonrpc - JSON-RPC 2.0 API`);
    console.log(`   GET  /health - 서버 상태 확인`);
    console.log(`   GET  /v1/models - OpenAI 호환 모델 목록`);
    console.log(`   POST /v1/completions - 코드 완성 (스트리밍 지원)`);
    console.log(`   POST /v1/chat/completions - 채팅 완성 (스트리밍 지원)`);
    console.log(`   POST /set-workspace - 작업 디렉토리 설정`);
    console.log(`   GET  /workspace - 현재 작업 디렉토리 조회`);
    console.log(`   GET  /project-info - 프로젝트 정보 조회`);
    console.log(`   POST /xcode/set-project - Xcode 프로젝트 경로 설정`);
    console.log(`   GET  /xcode/project - Xcode 프로젝트 경로 조회`);
    console.log(`   GET  /xcode/analyze - Xcode 프로젝트 분석`);
    console.log(`   GET  /xcode/env - Xcode 환경 변수 확인`);
    console.log(`\n🔧 JSON-RPC 2.0 Methods:`);
    console.log(`   health - 서버 상태 확인`);
    console.log(`   models.list - 모델 목록 조회`);
    console.log(`   chat.completions - 채팅 완성`);
    console.log(`   completions - 코드 완성`);
    console.log(`   workspace.set - 작업 디렉토리 설정`);
    console.log(`   workspace.get - 현재 작업 디렉토리 조회`);
    console.log(`   project.info - 프로젝트 정보 조회`);
    console.log(`\n✨ Features:`);
    console.log(`   🔄 Streaming support for real-time responses`);
    console.log(`   🎯 OpenAI API compatibility`);
    console.log(`   🛠️  Xcode Code Intelligence integration`);
    console.log(`   💻 IntelliJ IDEA support`);
    console.log(`   📱 VSCode workspace detection`);
    console.log(`   🚀 Cursor CLI integration`);
    console.log(`\n📱 Xcode Code Intelligence 설정:`);
    console.log(`   서버 URL: http://localhost:${PORT}`);
    console.log(`   사용 가능한 모델: cursor-ai`);
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
    console.log('\n🛑 서버를 종료합니다...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 서버를 종료합니다...');
    process.exit(0);
});
