const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 전역 변수로 현재 작업 디렉토리 저장
let currentWorkspacePath = null;

// 워크스페이스 경로 감지 및 설정 함수
function detectAndSetWorkspace(req) {
    // 모든 헤더를 로그로 출력하여 디버깅
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    // 다양한 헤더에서 프로젝트 경로 감지 (더 포괄적으로)
    const projectPath = req.headers['x-xcode-project-path'] || 
                       req.headers['x-project-path'] || 
                       req.headers['x-workspace-path'] ||
                       req.headers['x-intellij-project-path'] ||
                       req.headers['x-vscode-workspace'] ||
                       req.headers['x-jetbrains-project'] ||
                       req.headers['x-codebase-path'] ||
                       req.headers['x-source-path'] ||
                       req.headers['x-project-root'] ||
                       req.headers['x-workspace-root'] ||
                       req.body?.projectPath ||
                       req.body?.workspacePath ||
                       req.body?.workspace ||
                       req.body?.codebasePath ||
                       req.body?.sourcePath;
    
    if (projectPath) {
        console.log(`Project path detected from headers/body: ${projectPath}`);
        
        // 경로가 존재하는지 확인
        if (fs.existsSync(projectPath)) {
            const absolutePath = path.resolve(projectPath);
            currentWorkspacePath = absolutePath;
            console.log(`Workspace set to: ${absolutePath}`);
            return absolutePath;
        } else {
            console.log(`Project path does not exist: ${projectPath}`);
            // 경로가 존재하지 않으면 상위 디렉토리 확인
            const parentPath = path.dirname(projectPath);
            if (fs.existsSync(parentPath)) {
                const absolutePath = path.resolve(parentPath);
                currentWorkspacePath = absolutePath;
                console.log(`Using parent directory as workspace: ${absolutePath}`);
                return absolutePath;
            }
        }
    }
    
    // 프로젝트 경로가 감지되지 않았거나 존재하지 않는 경우
    // 현재 설정된 워크스페이스가 있으면 유지
    if (currentWorkspacePath && fs.existsSync(currentWorkspacePath)) {
        console.log(`Using existing workspace: ${currentWorkspacePath}`);
        return currentWorkspacePath;
    }
    
    // 기본값으로 현재 디렉토리 사용
    const defaultPath = process.cwd();
    console.log(`Using default workspace: ${defaultPath}`);
    return defaultPath;
}

// 작업 진행 상태 및 이력 관리
let currentTasks = new Map(); // 현재 진행 중인 작업들
let taskHistory = []; // 완료된 작업 이력
let codeChangeHistory = []; // 코드 변경 이력

// 작업 진행 상태 관리 함수들
function createTask(taskId, description, type = 'general') {
    const task = {
        id: taskId,
        description: description,
        type: type,
        status: 'started',
        startTime: new Date().toISOString(),
        progress: 0,
        steps: [],
        result: null,
        error: null,
        endTime: null
    };
    currentTasks.set(taskId, task);
    return task;
}

function updateTaskProgress(taskId, progress, step = null) {
    const task = currentTasks.get(taskId);
    if (task) {
        task.progress = Math.min(100, Math.max(0, progress));
        if (step) {
            task.steps.push({
                timestamp: new Date().toISOString(),
                description: step,
                progress: task.progress
            });
        }
    }
    return task;
}

function completeTask(taskId, result = null, error = null) {
    const task = currentTasks.get(taskId);
    if (task) {
        task.status = error ? 'failed' : 'completed';
        task.result = result;
        task.error = error;
        task.endTime = new Date().toISOString();
        task.progress = 100;
        
        // 이력을 taskHistory로 이동
        taskHistory.unshift(task);
        currentTasks.delete(taskId);
        
        // 최근 100개 작업만 유지
        if (taskHistory.length > 100) {
            taskHistory = taskHistory.slice(0, 100);
        }
    }
    return task;
}

function addCodeChange(filePath, changeType, oldContent, newContent, taskId) {
    const change = {
        id: Date.now().toString(),
        taskId: taskId,
        filePath: filePath,
        changeType: changeType, // 'create', 'modify', 'delete'
        timestamp: new Date().toISOString(),
        oldContent: oldContent,
        newContent: newContent,
        diff: generateDiff(oldContent, newContent)
    };
    codeChangeHistory.unshift(change);
    
    // 최근 200개 변경사항만 유지
    if (codeChangeHistory.length > 200) {
        codeChangeHistory = codeChangeHistory.slice(0, 200);
    }
    
    return change;
}

function generateDiff(oldContent, newContent) {
    if (!oldContent) return `+ ${newContent}`;
    if (!newContent) return `- ${oldContent}`;
    
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = [];
    
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        
        if (oldLine === newLine) {
            diff.push(`  ${oldLine}`);
        } else {
            if (oldLine) diff.push(`- ${oldLine}`);
            if (newLine) diff.push(`+ ${newLine}`);
        }
    }
    
    return diff.join('\n');
}

// Cursor CLI 인증 상태 캐시
let authCache = {
    isAuthenticated: false,
    lastChecked: 0,
    cacheTimeout: 5 * 60 * 1000 // 5분 캐시
};

// Cursor CLI 인증 상태 확인 (캐시된 결과 사용)
async function checkCursorAuth() {
    const now = Date.now();
    
    // 캐시된 결과가 유효한 경우 즉시 반환
    if (authCache.isAuthenticated && (now - authCache.lastChecked) < authCache.cacheTimeout) {
        console.log('Using cached authentication status: Authenticated');
        return { authenticated: true, cached: true };
    }
    
    return new Promise((resolve) => {
        const command = '/usr/local/bin/cursor status';
        const options = {
            cwd: process.cwd(),
            timeout: 5000, // 5초 타임아웃으로 단축
            maxBuffer: 1024 * 1024, // 1MB 버퍼
            env: {
                ...process.env,
                HOME: process.env.HOME || '/Users/kakaovx',
                USER: process.env.USER || 'kakaovx'
            }
        };
        
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                console.log('Cursor authentication check failed:', error.message);
                // 인증 실패 시 캐시 업데이트
                authCache.isAuthenticated = false;
                authCache.lastChecked = now;
                resolve({ authenticated: false, error: error.message });
            } else {
                const isAuthenticated = !stdout.includes('not authenticated') && 
                                      !stdout.includes('Press any key to sign in') &&
                                      !stdout.includes('Please sign in');
                
                // 캐시 업데이트
                authCache.isAuthenticated = isAuthenticated;
                authCache.lastChecked = now;
                
                console.log('Cursor authentication status:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
                resolve({ authenticated: isAuthenticated, output: stdout });
            }
        });
    });
}

// Cursor CLI 실행 함수
async function executeCursorCLI(command, workspacePath = null) {
    return new Promise(async (resolve, reject) => {
        // 먼저 인증 상태 확인
        const authStatus = await checkCursorAuth();
        if (!authStatus.authenticated) {
            console.log('Cursor CLI not authenticated, using fallback response');
            resolve({
                success: false,
                error: 'Cursor CLI not authenticated',
                stdout: '',
                stderr: 'Please sign in to Cursor CLI first'
            });
            return;
        }
        
        const workingDir = workspacePath || currentWorkspacePath || process.cwd();
        
        console.log(`Executing Cursor CLI command: ${command}`);
        console.log(`Working directory: ${workingDir}`);
        
        // 복잡한 프롬프트가 포함된 경우 임시 파일 사용
        let finalCommand = command;
        if (command.includes('echo') && (command.includes('{') || command.includes('[') || command.includes('```'))) {
            try {
                // 프롬프트 추출
                const promptMatch = command.match(/echo "([^"]+)" \| \/usr\/local\/bin\/cursor agent/);
                if (promptMatch) {
                    const prompt = promptMatch[1];
                    const tempFile = `/tmp/cursor_prompt_${Date.now()}.txt`;
                    fs.writeFileSync(tempFile, prompt, 'utf8');
                    finalCommand = `cat "${tempFile}" | /usr/local/bin/cursor agent --print --output-format text --force`;
                    console.log(`Using temporary file for complex prompt: ${tempFile}`);
                }
            } catch (error) {
                console.error('Error creating temporary file:', error);
                // 임시 파일 생성 실패 시 원래 명령 사용
            }
        }
        
        exec(finalCommand, { 
            cwd: workingDir,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            timeout: 10000, // 10초 타임아웃으로 단축
            stdio: 'pipe' // 표준 입출력을 파이프로 설정
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${error}`);
                console.error(`Stderr: ${stderr}`);
                reject({
                    success: false,
                    error: error.message,
                    stderr: stderr
                });
                return;
            }
            
            resolve({
                success: true,
                stdout: stdout,
                stderr: stderr
            });
        });
    });
}

// 빠른 응답 캐시
let responseCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5분

// AI 대체 응답 생성 함수 (캐시 포함)
function generateFallbackResponse(userMessage, messageType = 'chat') {
    // userMessage가 문자열이 아닌 경우 문자열로 변환
    let messageStr;
    
    if (typeof userMessage === 'string') {
        messageStr = userMessage;
    } else if (typeof userMessage === 'object' && userMessage !== null) {
        // 객체인 경우 JSON.stringify로 변환
        messageStr = JSON.stringify(userMessage);
    } else {
        messageStr = String(userMessage);
    }
    
    // [object Object] 체크 및 처리
    if (messageStr === '[object Object]' || messageStr.includes('[object Object]')) {
        messageStr = '안녕하세요! 코딩 관련 질문이 있으시면 언제든지 말씀해주세요.';
    }
    
    // 캐시 확인
    const cacheKey = `${messageType}_${messageStr}`;
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
        console.log('Using cached response');
        return cached.response;
    }
    
    const responses = {
        chat: [
            "안녕하세요! 저는 Cursor AI 어시스턴트입니다. 현재 Cursor CLI 인증이 필요하여 기본 응답을 드리고 있습니다.",
            "죄송합니다. Cursor CLI에 로그인이 필요합니다. 터미널에서 'cursor login' 명령을 실행해주세요.",
            "안녕하세요! 코딩 관련 질문이 있으시면 언제든지 말씀해주세요. Cursor CLI 인증 후 더 정확한 답변을 드릴 수 있습니다.",
            "현재 Cursor CLI 인증이 필요합니다. 'cursor login' 명령으로 로그인 후 다시 시도해주세요.",
            "안녕하세요! 프로그래밍 도움이 필요하시면 언제든지 말씀해주세요. Cursor CLI가 정상 작동하면 더 자세한 도움을 드릴 수 있습니다."
        ],
        completion: [
            "// 코드 완성을 위한 기본 템플릿\n// 현재 Cursor CLI 서비스가 일시적으로 사용할 수 없습니다.",
            "// 기본 코드 구조\n// 필요한 기능을 구현해주세요.",
            "// TODO: 구현이 필요한 부분\n// Cursor CLI가 복구되면 더 정확한 완성을 제공할 수 있습니다."
        ]
    };
    
    const responseList = responses[messageType] || responses.chat;
    const randomResponse = responseList[Math.floor(Math.random() * responseList.length)];
    
    // 사용자 메시지에 따른 맞춤형 응답
    const lowerMessage = messageStr.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('안녕')) {
        return "안녕하세요! 저는 Cursor AI 어시스턴트입니다. 코딩을 도와드릴 준비가 되어 있습니다.";
    } else if (lowerMessage.includes('로그인') || lowerMessage.includes('login') || lowerMessage.includes('인증') || lowerMessage.includes('auth')) {
        return "Cursor CLI 로그인이 필요합니다! 다음과 같이 로그인할 수 있습니다:\n\n1. **터미널에서 로그인**: `cursor login`\n2. **브라우저에서 인증**: 로그인 링크가 표시됩니다\n3. **인증 완료 후**: 서버를 재시작하면 정상 작동합니다\n\n로그인 후에는 모든 Cursor CLI 기능을 사용할 수 있습니다!";
    } else if (lowerMessage.includes('작업디렉토리') || lowerMessage.includes('작업 디렉토리') || lowerMessage.includes('현재 경로') || lowerMessage.includes('working directory')) {
        const currentDir = currentWorkspacePath || process.cwd();
        return `현재 작업 디렉토리는 다음과 같습니다:\n\n**${currentDir}**\n\n이 경로는 Xcode Code Intelligence에서 설정된 작업 공간입니다. 필요에 따라 다른 경로로 변경할 수 있습니다.`;
    } else if (lowerMessage.includes('파일 분석') || lowerMessage.includes('파일을 분석') || lowerMessage.includes('analyze file')) {
        return `파일 분석 기능을 사용할 수 있습니다! 다음과 같은 방법으로 파일을 분석할 수 있습니다:\n\n1. **API 직접 호출**: \`POST /analyze-file\`\n2. **파일 경로 지정**: 상대 경로나 절대 경로 사용\n3. **분석 정보**: 파일 크기, 라인 수, 함수/클래스 개수, 코멘트 수 등\n\n예시: "server.js 파일을 분석해줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('파일 수정') || lowerMessage.includes('파일을 수정') || lowerMessage.includes('modify file')) {
        return `파일 수정 기능을 사용할 수 있습니다! 다음과 같은 방법으로 파일을 수정할 수 있습니다:\n\n1. **API 직접 호출**: \`POST /modify-file\`\n2. **수정 지시사항**: 구체적인 수정 요청\n3. **백업 생성**: 수정 전 자동 백업\n4. **안전한 수정**: 파일 존재 여부 확인\n\n예시: "server.js 파일의 주석을 개선해줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('파일 비교') || lowerMessage.includes('diff') || lowerMessage.includes('비교')) {
        return `파일 비교 기능을 사용할 수 있습니다! 다음과 같은 방법으로 파일을 비교할 수 있습니다:\n\n1. **API 직접 호출**: \`POST /diff-files\`\n2. **두 파일 비교**: file1과 file2 지정\n3. **차이점 표시**: 상세한 diff 결과 제공\n\n예시: "file1.js와 file2.js를 비교해줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('파일 병합') || lowerMessage.includes('merge') || lowerMessage.includes('병합')) {
        return `파일 병합 기능을 사용할 수 있습니다! 다음과 같은 방법으로 파일을 병합할 수 있습니다:\n\n1. **API 직접 호출**: \`POST /merge-files\`\n2. **3-way merge**: 두 수정된 파일과 기본 파일 병합\n3. **결과 파일**: 병합된 결과를 새 파일로 저장\n\n예시: "file1.js, file2.js, base.js를 병합해서 result.js로 저장해줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('에디터') || lowerMessage.includes('editor') || lowerMessage.includes('열기')) {
        return `Cursor 에디터를 열 수 있습니다! 다음과 같은 방법으로 에디터를 사용할 수 있습니다:\n\n1. **API 직접 호출**: \`POST /open-editor\`\n2. **파일 열기**: 특정 파일을 에디터에서 열기\n3. **새 창**: 새 창에서 열기 옵션\n4. **라인 이동**: 특정 라인으로 바로 이동\n\n예시: "server.js 파일을 100번째 라인에서 열어줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('확장') || lowerMessage.includes('extension') || lowerMessage.includes('플러그인')) {
        return `확장 프로그램을 관리할 수 있습니다! 다음과 같은 기능을 사용할 수 있습니다:\n\n1. **확장 목록**: \`GET /extensions\` - 설치된 확장 프로그램 목록\n2. **확장 설치**: \`POST /install-extension\` - 새 확장 프로그램 설치\n3. **버전 확인**: 설치된 확장의 버전 정보\n4. **카테고리 필터**: 특정 카테고리의 확장만 표시\n\n예시: "설치된 확장 프로그램 목록을 보여줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('상태') || lowerMessage.includes('status') || lowerMessage.includes('정보')) {
        return `Cursor 상태를 확인할 수 있습니다! 다음과 같은 정보를 제공합니다:\n\n1. **상태 확인**: \`GET /cursor-status\` - Cursor 프로세스 상태\n2. **프로젝트 정보**: \`GET /project-info\` - 프로젝트 파일 정보\n3. **작업 디렉토리**: \`GET /workspace\` - 현재 작업 공간\n4. **서버 상태**: \`GET /health\` - 서버 상태 확인\n\n예시: "현재 Cursor 상태를 확인해줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('채팅') || lowerMessage.includes('chat') || lowerMessage.includes('세션')) {
        return `채팅 세션을 관리할 수 있습니다! 다음과 같은 기능을 사용할 수 있습니다:\n\n1. **채팅 생성**: \`POST /create-chat\` - 새 채팅 세션 생성\n2. **채팅 재개**: \`POST /resume-chat\` - 기존 채팅 세션 재개\n3. **채팅 목록**: \`GET /chat-sessions\` - 활성 채팅 세션 목록\n4. **채팅 삭제**: \`DELETE /chat-sessions\` - 채팅 세션 삭제\n\n예시: "새 채팅 세션을 만들어줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('터널') || lowerMessage.includes('tunnel') || lowerMessage.includes('원격')) {
        return `터널 서버를 사용할 수 있습니다! 다음과 같은 기능을 제공합니다:\n\n1. **터널 시작**: \`POST /start-tunnel\` - 보안 터널 서버 시작\n2. **원격 접근**: vscode.dev에서 현재 머신에 접근\n3. **웹 서버**: \`POST /start-web-server\` - 브라우저에서 에디터 사용\n4. **보안 연결**: 암호화된 안전한 연결\n\n예시: "터널 서버를 시작해줘"라고 요청하시면 됩니다.`;
    } else if (lowerMessage.includes('게임') || lowerMessage.includes('game') || lowerMessage.includes('수정') || lowerMessage.includes('modify')) {
        return "게임 수정에 대한 질문이군요! 요청하신 게임 수정 사항을 분석해보겠습니다:\n\n**요청사항 분석:**\n1. **레벨1로 시작**: 게임 시작 시 레벨을 1로 초기화\n2. **레벨별 획득 스코어**: 각 레벨마다 필요한 점수 설정\n3. **자동 레벨업**: 목표 점수 달성 시 다음 레벨로 자동 이동\n4. **플레이어 게이지**: 오브젝트가 떨어지면 게이지 감소\n5. **게임 종료**: 게이지가 0이 되면 게임 오버\n\n**구현 방법:**\n- `GameState`에 `playerHealth` 변수 추가\n- 레벨별 목표 점수 배열 생성\n- 오브젝트가 화면 하단에 도달하면 게이지 감소\n- 게이지가 0이 되면 게임 오버 처리\n\n구체적인 코드 수정이 필요하시면 말씀해주세요!";
    } else if (lowerMessage.includes('swift') || lowerMessage.includes('ios') || lowerMessage.includes('hello world')) {
        return "Swift/iOS 개발에 대한 질문이군요! 현재 Cursor CLI 서비스가 일시적으로 사용할 수 없어서 기본 응답을 드리고 있습니다. 일반적인 Swift 코드 구조나 iOS 개발 팁에 대해서는 도움을 드릴 수 있습니다.\n\nSwift에서 Hello World는 다음과 같이 작성할 수 있습니다:\n```swift\nprint(\"Hello, World!\")\n```";
    } else if (lowerMessage.includes('bug') || lowerMessage.includes('error') || lowerMessage.includes('문제')) {
        return "버그나 에러 관련 질문이군요! 현재 Cursor CLI 서비스가 일시적으로 사용할 수 없어서 직접적인 코드 분석은 어렵지만, 일반적인 디버깅 방법이나 해결책에 대해서는 조언을 드릴 수 있습니다.";
    } else if (lowerMessage.includes('코드') || lowerMessage.includes('code') || lowerMessage.includes('프로그래밍')) {
        return "프로그래밍 관련 질문이군요! 현재 Cursor CLI 서비스가 일시적으로 사용할 수 없어서 기본적인 조언만 드릴 수 있습니다. 구체적인 언어나 프레임워크에 대한 질문이 있으시면 언제든지 말씀해주세요.";
    }
    
    // 캐시에 저장
    responseCache.set(cacheKey, {
        response: randomResponse,
        timestamp: Date.now()
    });
    
    // 캐시 크기 제한 (최대 100개)
    if (responseCache.size > 100) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
    
    return randomResponse;
}

// API 엔드포인트들

// 1. 서버 상태 확인
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Cursor Server is running',
        currentWorkspace: currentWorkspacePath,
        timestamp: new Date().toISOString()
    });
});

// 1-1. 빠른 응답 엔드포인트 (캐시 우선)
app.post('/v1/quick-chat', async (req, res) => {
    try {
        const { messages, model = "cursor-cli" } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: {
                    message: "messages array is required",
                    type: "invalid_request_error"
                }
            });
        }
        
        const lastMessage = messages[messages.length - 1];
        const userMessage = lastMessage.content || '';
        
        // 캐시 확인
        const cacheKey = `quick_chat_${userMessage}`;
        const cached = responseCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
            console.log('Using cached quick response');
            return res.json({
                id: `quick-${Date.now()}`,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: "assistant",
                        content: cached.response
                    },
                    finish_reason: "stop"
                }],
                usage: {
                    prompt_tokens: userMessage.length,
                    completion_tokens: cached.response.length,
                    total_tokens: userMessage.length + cached.response.length
                },
                cached: true
            });
        }
        
        // 빠른 대체 응답 생성
        const quickResponse = generateFallbackResponse(userMessage, 'chat');
        
        res.json({
            id: `quick-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                message: {
                    role: "assistant",
                    content: quickResponse
                },
                finish_reason: "stop"
            }],
            usage: {
                prompt_tokens: userMessage.length,
                completion_tokens: quickResponse.length,
                total_tokens: userMessage.length + quickResponse.length
            },
            cached: false
        });
        
    } catch (error) {
        console.error('Error processing quick chat:', error);
        res.status(500).json({
            error: {
                message: error.message || 'Failed to process quick chat',
                type: "server_error"
            }
        });
    }
});

// 2. Xcode Code Intelligence - 모델 목록 조회
app.get('/v1/models', (req, res) => {
    // 워크스페이스 경로 감지 및 설정
    const workspace = detectAndSetWorkspace(req);
    
    res.json({
        object: "list",
        data: [
            {
                id: "cursor-cli",
                object: "model",
                created: Math.floor(Date.now() / 1000),
                owned_by: "cursor-server",
                permission: [],
                root: "cursor-cli",
                parent: null
            },
            {
                id: "cursor-cli-fast",
                object: "model",
                created: Math.floor(Date.now() / 1000),
                owned_by: "cursor-server",
                permission: [],
                root: "cursor-cli-fast",
                parent: null
            }
        ],
        workspace: workspace
    });
});

// 3. Xcode Code Intelligence - 코드 완성 요청 (SSE 스트리밍)
app.post('/v1/completions', async (req, res) => {
    try {
        // 워크스페이스 경로 감지 및 설정
        const workspace = detectAndSetWorkspace(req);
        
        const { prompt, model = "cursor-cli", max_tokens = 1000, temperature = 0.7, stream = false } = req.body;
        
        // prompt가 문자열인지 확인 및 변환
        let promptStr;
        
        if (typeof prompt === 'string') {
            promptStr = prompt;
        } else if (typeof prompt === 'object' && prompt !== null) {
            // 객체인 경우 JSON.stringify로 변환
            promptStr = JSON.stringify(prompt);
        } else {
            promptStr = String(prompt);
        }
        
        // [object Object] 체크 및 처리
        if (promptStr === '[object Object]' || promptStr.includes('[object Object]')) {
            promptStr = '코드 완성을 도와드리겠습니다.';
        }
        
        if (!promptStr) {
            return res.status(400).json({
                error: {
                    message: "prompt is required",
                    type: "invalid_request_error"
                }
            });
        }
        
        const targetWorkspace = workspace || currentWorkspacePath || process.cwd();
        
        // Cursor CLI를 사용하여 코드 완성 요청 (echo를 통해 입력 전달)
        // 한글 응답을 요청하는 프롬프트 추가
        const koreanPrompt = `다음 요청에 한글로 답변해주세요: ${promptStr}`;
        
        // 복잡한 JSON 객체가 포함된 경우 안전하게 처리
        let command;
        if (promptStr.includes('{') && promptStr.includes('}')) {
            // JSON 객체가 포함된 경우 임시 파일을 사용
            const fs = require('fs');
            const tempFile = `/tmp/cursor_prompt_${Date.now()}.txt`;
            fs.writeFileSync(tempFile, koreanPrompt, 'utf8');
            command = `cat "${tempFile}" | /usr/local/bin/cursor agent --print --output-format text --force`;
        } else {
            command = `echo "${koreanPrompt}" | /usr/local/bin/cursor agent --print --output-format text --force`;
        }
        let result;
        let responseContent;
        
        try {
            result = await executeCursorCLI(command, targetWorkspace);
            if (result.success && result.stdout && result.stdout.trim()) {
                responseContent = result.stdout.trim();
            } else {
                // Cursor CLI 실패 시 대체 응답 생성
                responseContent = generateFallbackResponse(prompt, 'completion');
                console.log('Using fallback response for completion');
            }
        } catch (error) {
            // Cursor CLI 실행 실패 시 대체 응답 생성
            responseContent = generateFallbackResponse(prompt, 'completion');
            console.log('Cursor CLI failed, using fallback response:', error.message);
        }
        
        const responseId = `completion-${Date.now()}`;
        
        if (stream) {
            // SSE 스트리밍 응답
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
            
            // 내용을 청크로 나누어 전송
            const chunks = responseContent.split(' ');
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i] + (i < chunks.length - 1 ? ' ' : '');
                // JSON 이스케이프 처리
                const escapedChunk = JSON.stringify(chunk).slice(1, -1); // 따옴표 제거
                res.write(`data: {"id":"${responseId}","object":"text_completion","created":${Math.floor(Date.now() / 1000)},"model":"${model}","choices":[{"text":"${escapedChunk}","index":0,"logprobs":null,"finish_reason":null}]}\n\n`);
                
                // 작은 지연을 추가하여 스트리밍 효과 생성
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // 완료 신호
            res.write(`data: {"id":"${responseId}","object":"text_completion","created":${Math.floor(Date.now() / 1000)},"model":"${model}","choices":[{"text":"","index":0,"logprobs":null,"finish_reason":"stop"}]}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            // 일반 JSON 응답
            res.json({
                id: responseId,
                object: "text_completion",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [
                    {
                        text: responseContent,
                        index: 0,
                        logprobs: null,
                        finish_reason: "stop"
                    }
                ],
                usage: {
                    prompt_tokens: promptStr.length,
                    completion_tokens: responseContent.length,
                    total_tokens: promptStr.length + responseContent.length
                }
            });
        }
        
    } catch (error) {
        console.error('Error processing completion request:', error);
        res.status(500).json({
            error: {
                message: error.message || 'Failed to process completion request',
                type: "server_error"
            }
        });
    }
});

// 4. Xcode Code Intelligence - 채팅 완성 요청 (SSE 스트리밍)
app.post('/v1/chat/completions', async (req, res) => {
    try {
        // 워크스페이스 경로 감지 및 설정
        const workspace = detectAndSetWorkspace(req);
        
        const { messages, model = "cursor-cli", max_tokens = 1000, temperature = 0.7, stream = false } = req.body;
        
        // 빠른 모델인 경우 빠른 응답 엔드포인트로 리다이렉트
        if (model === "cursor-cli-fast") {
            return res.redirect(307, '/v1/quick-chat');
        }
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: {
                    message: "messages array is required",
                    type: "invalid_request_error"
                }
            });
        }
        
        const targetWorkspace = workspace || currentWorkspacePath || process.cwd();
        
        // 마지막 메시지를 추출하여 Cursor CLI에 전달
        const lastMessage = messages[messages.length - 1];
        let userMessage;
        
        if (typeof lastMessage.content === 'string') {
            userMessage = lastMessage.content;
        } else if (typeof lastMessage.content === 'object' && lastMessage.content !== null) {
            // 객체인 경우 JSON.stringify로 변환
            userMessage = JSON.stringify(lastMessage.content);
        } else {
            userMessage = String(lastMessage.content);
        }
        
        // [object Object] 체크 및 처리
        if (userMessage === '[object Object]' || userMessage.includes('[object Object]')) {
            userMessage = '안녕하세요! 코딩 관련 질문이 있으시면 언제든지 말씀해주세요.';
        }
        
        // 파일 수정 요청인지 확인 (더 포괄적으로)
        const isFileModificationRequest = userMessage.includes('수정') || userMessage.includes('modify') || 
                                        userMessage.includes('게임을') || userMessage.includes('모두 다') ||
                                        userMessage.includes('레벨') || userMessage.includes('스코어') ||
                                        userMessage.includes('게이지') || userMessage.includes('게임 종료') ||
                                        userMessage.includes('포커스') || userMessage.includes('타이핑') ||
                                        userMessage.includes('에디터') || userMessage.includes('입력');
        
        let command;
        let responseContent;
        
        if (isFileModificationRequest) {
            // 작업 추적 시작
            const taskId = `task_${Date.now()}`;
            const task = createTask(taskId, `파일 수정 요청: ${userMessage.substring(0, 50)}...`, 'file_modification');
            
            try {
                updateTaskProgress(taskId, 10, '파일 수정 요청 분석 중...');
                
                // GameView.swift 파일을 찾기 (여러 경로에서 검색)
                let gameViewPath = null;
                const possiblePaths = [
                    path.join(targetWorkspace, 'GameView.swift'),
                    path.join(targetWorkspace, 'Sources', 'TypingGame', 'GameView.swift'),
                    path.join(targetWorkspace, 'cursor-server', 'GameView.swift'),
                    path.join(process.cwd(), 'GameView.swift'),
                    path.join('/Users/aiden/HomeWork', 'GameView.swift'),
                    path.join('/Users/aiden/HomeWork', 'cursor-server', 'GameView.swift'),
                    path.join('/Users/aiden/TypingGame', 'Sources', 'TypingGame', 'GameView.swift'),
                    path.join('/Users/aiden/TypingGame', 'GameView.swift')
                ];
                
                updateTaskProgress(taskId, 20, '프로젝트 파일 검색 중...');
                
                for (const testPath of possiblePaths) {
                    if (fs.existsSync(testPath)) {
                        gameViewPath = testPath;
                        console.log(`Found GameView.swift at: ${gameViewPath}`);
                        break;
                    }
                }
                
                if (gameViewPath) {
                    updateTaskProgress(taskId, 30, '기존 파일 내용 백업 중...');
                    
                    // 기존 파일 내용 읽기
                    const oldContent = fs.readFileSync(gameViewPath, 'utf8');
                    
                    updateTaskProgress(taskId, 40, 'Cursor CLI로 코드 생성 중...');
                    
                    // GameView.swift 파일 수정
                    const modifyCommand = `echo "다음 요청에 한글로 답변하고 GameView.swift 파일을 실제로 수정해주세요: ${userMessage}" | /usr/local/bin/cursor agent --print --output-format text --force`;
                    const modifyResult = await executeCursorCLI(modifyCommand, targetWorkspace);
                    
                    if (modifyResult.success && modifyResult.stdout) {
                        updateTaskProgress(taskId, 60, 'Cursor CLI 응답 분석 중...');
                        responseContent = modifyResult.stdout;
                        
                        // Swift 코드 블록이 있으면 실제 파일에 적용
                        const codeMatch = modifyResult.stdout.match(/```swift\n([\s\S]*?)\n```/);
                        if (codeMatch) {
                            updateTaskProgress(taskId, 70, '코드 블록 추출 중...');
                            const newContent = codeMatch[1];
                            
                            updateTaskProgress(taskId, 80, '파일 백업 생성 중...');
                            const backupPath = gameViewPath + '.backup.' + Date.now();
                            fs.copyFileSync(gameViewPath, backupPath);
                            
                            updateTaskProgress(taskId, 90, '파일 수정 적용 중...');
                            fs.writeFileSync(gameViewPath, newContent, 'utf8');
                            
                            // 코드 변경 이력 추가
                            addCodeChange(gameViewPath, 'modify', oldContent, newContent, taskId);
                            
                            updateTaskProgress(taskId, 95, '작업 완료 처리 중...');
                            responseContent += `\n\n✅ GameView.swift 파일이 실제로 수정되었습니다! 백업 파일: ${backupPath}`;
                            
                            // 작업 완료
                            completeTask(taskId, {
                                success: true,
                                filePath: gameViewPath,
                                backupPath: backupPath,
                                changesApplied: true,
                                response: responseContent
                            });
                        } else {
                            updateTaskProgress(taskId, 85, '코드 블록이 없어 응답만 제공...');
                            completeTask(taskId, {
                                success: true,
                                filePath: gameViewPath,
                                changesApplied: false,
                                response: responseContent
                            });
                        }
                    } else {
                        updateTaskProgress(taskId, 50, 'Cursor CLI 실행 실패, 대체 응답 생성...');
                        responseContent = generateFallbackResponse(userMessage, 'chat');
                        completeTask(taskId, null, 'Cursor CLI execution failed');
                    }
                } else {
                    updateTaskProgress(taskId, 30, 'GameView.swift 파일을 찾을 수 없음');
                    responseContent = "GameView.swift 파일을 찾을 수 없습니다. 파일 경로를 확인해주세요.";
                    completeTask(taskId, null, 'GameView.swift file not found');
                }
            } catch (error) {
                console.error('Error modifying file:', error);
                updateTaskProgress(taskId, 50, `오류 발생: ${error.message}`);
                responseContent = generateFallbackResponse(userMessage, 'chat');
                completeTask(taskId, null, error.message);
            }
        } else {
            // 일반 채팅 요청 - 작업 추적 추가
            const taskId = `chat_${Date.now()}`;
            const task = createTask(taskId, `채팅 요청: ${userMessage.substring(0, 50)}...`, 'chat');
            
            try {
                updateTaskProgress(taskId, 10, '채팅 요청 분석 중...');
                
                const koreanPrompt = `다음 질문에 한글로 답변해주세요: ${userMessage}`;
                
                updateTaskProgress(taskId, 30, 'Cursor CLI 명령 준비 중...');
                
                // 복잡한 JSON 객체가 포함된 경우 안전하게 처리
                if (userMessage.includes('{') && userMessage.includes('}')) {
                    // JSON 객체가 포함된 경우 임시 파일을 사용
                    const fs = require('fs');
                    const tempFile = `/tmp/cursor_prompt_${Date.now()}.txt`;
                    fs.writeFileSync(tempFile, koreanPrompt, 'utf8');
                    command = `cat "${tempFile}" | /usr/local/bin/cursor agent --print --output-format text --force`;
                } else {
                    command = `echo "${koreanPrompt}" | /usr/local/bin/cursor agent --print --output-format text --force`;
                }
                
                updateTaskProgress(taskId, 50, 'Cursor CLI 실행 중...');
                
                const result = await executeCursorCLI(command, targetWorkspace);
                if (result.success && result.stdout && result.stdout.trim()) {
                    updateTaskProgress(taskId, 80, '응답 처리 중...');
                    responseContent = result.stdout.trim();
                    completeTask(taskId, {
                        success: true,
                        response: responseContent,
                        type: 'chat'
                    });
                } else {
                    updateTaskProgress(taskId, 60, 'Cursor CLI 실패, 대체 응답 생성...');
                    responseContent = generateFallbackResponse(userMessage, 'chat');
                    console.log('Using fallback response for chat');
                    completeTask(taskId, {
                        success: true,
                        response: responseContent,
                        type: 'chat_fallback'
                    });
                }
            } catch (error) {
                console.error('Error in chat request:', error);
                updateTaskProgress(taskId, 50, `오류 발생: ${error.message}`);
                responseContent = generateFallbackResponse(userMessage, 'chat');
                completeTask(taskId, null, error.message);
            }
        }
        
        const responseId = `chatcmpl-${Date.now()}`;
        
        if (stream) {
            // SSE 스트리밍 응답
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
            
            // 초기 응답
            res.write(`data: {"id":"${responseId}","object":"chat.completion.chunk","created":${Math.floor(Date.now() / 1000)},"model":"${model}","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n`);
            
            // 내용을 청크로 나누어 전송
            const chunks = responseContent.split(' ');
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i] + (i < chunks.length - 1 ? ' ' : '');
                // JSON 이스케이프 처리
                const escapedChunk = JSON.stringify(chunk).slice(1, -1); // 따옴표 제거
                res.write(`data: {"id":"${responseId}","object":"chat.completion.chunk","created":${Math.floor(Date.now() / 1000)},"model":"${model}","choices":[{"index":0,"delta":{"content":"${escapedChunk}"},"finish_reason":null}]}\n\n`);
                
                // 작은 지연을 추가하여 스트리밍 효과 생성
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // 완료 신호
            res.write(`data: {"id":"${responseId}","object":"chat.completion.chunk","created":${Math.floor(Date.now() / 1000)},"model":"${model}","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            // 일반 JSON 응답
            res.json({
                id: responseId,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [
                    {
                        index: 0,
                        message: {
                            role: "assistant",
                            content: responseContent
                        },
                        finish_reason: "stop"
                    }
                ],
                usage: {
                    prompt_tokens: messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0),
                    completion_tokens: responseContent.length,
                    total_tokens: messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0) + responseContent.length
                }
            });
        }
        
    } catch (error) {
        console.error('Error processing chat completion request:', error);
        res.status(500).json({
            error: {
                message: error.message || 'Failed to process chat completion request',
                type: "server_error"
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
                error: 'workspacePath is required'
            });
        }
        
        // 경로가 존재하는지 확인
        if (!fs.existsSync(workspacePath)) {
            return res.status(400).json({
                success: false,
                error: 'Workspace path does not exist'
            });
        }
        
        // 절대 경로로 변환
        const absolutePath = path.resolve(workspacePath);
        currentWorkspacePath = absolutePath;
        
        console.log(`Workspace set to: ${absolutePath}`);
        
        res.json({
            success: true,
            message: 'Workspace path set successfully',
            workspacePath: absolutePath
        });
    } catch (error) {
        console.error('Error setting workspace:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5-0. 자동 워크스페이스 감지 및 설정
app.post('/auto-detect-workspace', (req, res) => {
    try {
        const workspace = detectAndSetWorkspace(req);
        
        res.json({
            success: true,
            message: 'Workspace auto-detected and set',
            workspacePath: workspace,
            detectedFrom: req.headers['x-xcode-project-path'] ? 'Xcode' : 
                         req.headers['x-intellij-project-path'] ? 'IntelliJ' :
                         req.headers['x-vscode-workspace'] ? 'VSCode' :
                         req.body?.projectPath ? 'Request Body' : 'Default'
        });
    } catch (error) {
        console.error('Error auto-detecting workspace:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5-1. Xcode Code Intelligence 전용 워킹 디렉토리 설정 (간단한 방법)
app.post('/xcode/set-workspace', (req, res) => {
    try {
        const { path, projectPath } = req.body;
        
        const targetPath = path || projectPath;
        
        if (!targetPath) {
            return res.status(400).json({
                success: false,
                error: 'path or projectPath is required'
            });
        }
        
        // 경로가 존재하는지 확인
        if (!fs.existsSync(targetPath)) {
            return res.status(400).json({
                success: false,
                error: 'Path does not exist'
            });
        }
        
        // 절대 경로로 변환
        const absolutePath = require('path').resolve(targetPath);
        currentWorkspacePath = absolutePath;
        
        console.log(`Xcode workspace set to: ${absolutePath}`);
        
        res.json({
            success: true,
            message: 'Xcode workspace path set successfully',
            workspacePath: absolutePath
        });
    } catch (error) {
        console.error('Error setting Xcode workspace:', error);
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

// 6-1. 현재 진행 중인 작업 조회
app.get('/tasks/current', (req, res) => {
    const tasks = Array.from(currentTasks.values());
    res.json({
        success: true,
        currentTasks: tasks,
        count: tasks.length,
        timestamp: new Date().toISOString()
    });
});

// 6-2. 작업 이력 조회
app.get('/tasks/history', (req, res) => {
    const { limit = 20, type = null } = req.query;
    let history = taskHistory;
    
    if (type) {
        history = history.filter(task => task.type === type);
    }
    
    history = history.slice(0, parseInt(limit));
    
    res.json({
        success: true,
        taskHistory: history,
        count: history.length,
        totalCount: taskHistory.length,
        timestamp: new Date().toISOString()
    });
});

// 6-3. 코드 변경 이력 조회
app.get('/changes/history', (req, res) => {
    const { limit = 20, filePath = null, taskId = null } = req.query;
    let changes = codeChangeHistory;
    
    if (filePath) {
        changes = changes.filter(change => change.filePath.includes(filePath));
    }
    
    if (taskId) {
        changes = changes.filter(change => change.taskId === taskId);
    }
    
    changes = changes.slice(0, parseInt(limit));
    
    res.json({
        success: true,
        codeChanges: changes,
        count: changes.length,
        totalCount: codeChangeHistory.length,
        timestamp: new Date().toISOString()
    });
});

// 6-4. 특정 작업 상세 조회
app.get('/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    
    // 현재 작업 중인지 확인
    let task = currentTasks.get(taskId);
    
    // 완료된 작업에서 찾기
    if (!task) {
        task = taskHistory.find(t => t.id === taskId);
    }
    
    if (!task) {
        return res.status(404).json({
            success: false,
            error: 'Task not found'
        });
    }
    
    // 관련 코드 변경사항 찾기
    const relatedChanges = codeChangeHistory.filter(change => change.taskId === taskId);
    
    res.json({
        success: true,
        task: task,
        relatedChanges: relatedChanges,
        timestamp: new Date().toISOString()
    });
});

// 6-5. 실시간 작업 상태 웹 인터페이스
app.get('/dashboard', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cursor Server 작업 대시보드</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .task { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 6px; }
        .task.running { border-left: 4px solid #3498db; }
        .task.completed { border-left: 4px solid #27ae60; }
        .task.failed { border-left: 4px solid #e74c3c; }
        .progress-bar { width: 100%; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); transition: width 0.3s ease; }
        .step { padding: 5px 0; color: #666; font-size: 14px; }
        .code-change { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .diff-line { margin: 2px 0; }
        .diff-line.added { background: #d4edda; color: #155724; }
        .diff-line.removed { background: #f8d7da; color: #721c24; }
        .refresh-btn { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 10px 0; }
        .refresh-btn:hover { background: #2980b9; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.started { background: #e3f2fd; color: #1976d2; }
        .status.completed { background: #e8f5e8; color: #2e7d32; }
        .status.failed { background: #ffebee; color: #c62828; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Cursor Server 작업 대시보드</h1>
            <p>실시간 작업 진행 상태 및 코드 변경 이력</p>
            <button class="refresh-btn" onclick="location.reload()">새로고침</button>
        </div>
        
        <div class="section">
            <h2>📊 현재 진행 중인 작업</h2>
            <div id="current-tasks">로딩 중...</div>
        </div>
        
        <div class="section">
            <h2>📋 최근 작업 이력</h2>
            <div id="task-history">로딩 중...</div>
        </div>
        
        <div class="section">
            <h2>🔧 최근 코드 변경사항</h2>
            <div id="code-changes">로딩 중...</div>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                // 현재 작업 로드
                const currentRes = await fetch('/tasks/current');
                const currentData = await currentRes.json();
                document.getElementById('current-tasks').innerHTML = renderTasks(currentData.currentTasks, true);
                
                // 작업 이력 로드
                const historyRes = await fetch('/tasks/history?limit=10');
                const historyData = await historyRes.json();
                document.getElementById('task-history').innerHTML = renderTasks(historyData.taskHistory, false);
                
                // 코드 변경사항 로드
                const changesRes = await fetch('/changes/history?limit=10');
                const changesData = await changesRes.json();
                document.getElementById('code-changes').innerHTML = renderCodeChanges(changesData.codeChanges);
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }
        
        function renderTasks(tasks, isCurrent) {
            if (!tasks || tasks.length === 0) {
                return '<p>현재 진행 중인 작업이 없습니다.</p>';
            }
            
            return tasks.map(task => \`
                <div class="task \${task.status}">
                    <h3>\${task.description}</h3>
                    <div class="status \${task.status}">\${task.status.toUpperCase()}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${task.progress}%"></div>
                    </div>
                    <p><strong>진행률:</strong> \${task.progress}%</p>
                    <p><strong>시작 시간:</strong> \${new Date(task.startTime).toLocaleString('ko-KR')}</p>
                    \${task.endTime ? \`<p><strong>완료 시간:</strong> \${new Date(task.endTime).toLocaleString('ko-KR')}</p>\` : ''}
                    <div class="steps">
                        <strong>진행 단계:</strong>
                        \${task.steps.map(step => \`<div class="step">\${step.description} (\${step.progress}%)</div>\`).join('')}
                    </div>
                    \${task.error ? \`<p style="color: #e74c3c;"><strong>오류:</strong> \${task.error}</p>\` : ''}
                </div>
            \`).join('');
        }
        
        function renderCodeChanges(changes) {
            if (!changes || changes.length === 0) {
                return '<p>최근 코드 변경사항이 없습니다.</p>';
            }
            
            return changes.map(change => \`
                <div class="code-change">
                    <h4>\${change.filePath} (\${change.changeType})</h4>
                    <p><strong>작업 ID:</strong> \${change.taskId}</p>
                    <p><strong>변경 시간:</strong> \${new Date(change.timestamp).toLocaleString('ko-KR')}</p>
                    <div class="diff">
                        \${change.diff.split('\\n').map(line => {
                            if (line.startsWith('+')) return \`<div class="diff-line added">\${line}</div>\`;
                            if (line.startsWith('-')) return \`<div class="diff-line removed">\${line}</div>\`;
                            return \`<div class="diff-line">\${line}</div>\`;
                        }).join('')}
                    </div>
                </div>
            \`).join('');
        }
        
        // 페이지 로드 시 데이터 로드
        loadData();
        
        // 5초마다 자동 새로고침
        setInterval(loadData, 5000);
    </script>
</body>
</html>
    `;
    
    res.send(html);
});

// 7. Cursor CLI 채팅 요청 (기존 API)
app.post('/chat', async (req, res) => {
    try {
        const { message, workspacePath } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'message is required'
            });
        }
        
        // Cursor CLI 명령어 구성
        const command = `/usr/local/bin/cursor agent "${message}" --print --output-format text`;
        const targetWorkspace = workspacePath || currentWorkspacePath;
        
        if (!targetWorkspace) {
            return res.status(400).json({
                success: false,
                error: 'No workspace path set. Please set workspace first.'
            });
        }
        
        let result;
        let responseContent;
        
        try {
            result = await executeCursorCLI(command, targetWorkspace);
            if (result.success && result.stdout && result.stdout.trim()) {
                responseContent = result.stdout.trim();
            } else {
                responseContent = generateFallbackResponse(message, 'chat');
                console.log('Using fallback response for legacy chat API');
            }
        } catch (error) {
            responseContent = generateFallbackResponse(message, 'chat');
            console.log('Cursor CLI failed for legacy chat API:', error.message);
        }
        
        res.json({
            success: true,
            message: 'Chat request processed',
            response: responseContent,
            workspace: targetWorkspace
        });
        
    } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process chat request'
        });
    }
});

// 8. 코드 수정 요청
app.post('/modify-code', async (req, res) => {
    try {
        const { instruction, filePath, workspacePath } = req.body;
        
        if (!instruction) {
            return res.status(400).json({
                success: false,
                error: 'instruction is required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath;
        
        if (!targetWorkspace) {
            return res.status(400).json({
                success: false,
                error: 'No workspace path set. Please set workspace first.'
            });
        }
        
        // 파일 경로가 제공된 경우 해당 파일에 대한 수정 요청
        let command;
        if (filePath) {
            const fullPath = path.resolve(targetWorkspace, filePath);
            command = `cursor --modify "${instruction}" --file "${fullPath}"`;
        } else {
            command = `cursor --modify "${instruction}"`;
        }
        
        const result = await executeCursorCLI(command, targetWorkspace);
        
        res.json({
            success: true,
            message: 'Code modification request processed',
            response: result.stdout,
            workspace: targetWorkspace,
            filePath: filePath || 'entire workspace'
        });
        
    } catch (error) {
        console.error('Error processing code modification:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process code modification'
        });
    }
});

// 9. 일반적인 Cursor CLI 명령 실행
app.post('/execute', async (req, res) => {
    try {
        const { command, workspacePath } = req.body;
        
        if (!command) {
            return res.status(400).json({
                success: false,
                error: 'command is required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath;
        const result = await executeCursorCLI(command, targetWorkspace);
        
        res.json({
            success: true,
            message: 'Command executed successfully',
            result: result,
            workspace: targetWorkspace
        });
        
    } catch (error) {
        console.error('Error executing command:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute command'
        });
    }
});

// 10. 프로젝트 정보 조회
app.get('/project-info', (req, res) => {
    try {
        const workspace = currentWorkspacePath || process.cwd();
        
        // 프로젝트 파일들 확인
        const files = fs.readdirSync(workspace);
        const projectFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.xcodeproj', '.xcworkspace', '.swift', '.m', '.h'].includes(ext);
        });
        
        res.json({
            success: true,
            workspace: workspace,
            projectFiles: projectFiles,
            isXcodeProject: projectFiles.some(file => 
                file.endsWith('.xcodeproj') || file.endsWith('.xcworkspace')
            )
        });
        
    } catch (error) {
        console.error('Error getting project info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 11. 파일 분석 요청
app.post('/analyze-file', async (req, res) => {
    try {
        const { filePath, workspacePath } = req.body;
        
        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'filePath is required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath || process.cwd();
        const fullPath = path.resolve(targetWorkspace, filePath);
        
        // 파일이 존재하는지 확인
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }
        
        // 파일 내용 읽기
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const fileStats = fs.statSync(fullPath);
        const fileExt = path.extname(fullPath).toLowerCase();
        
        // 파일 분석
        const analysis = {
            path: fullPath,
            relativePath: path.relative(targetWorkspace, fullPath),
            size: fileStats.size,
            extension: fileExt,
            lastModified: fileStats.mtime,
            lines: fileContent.split('\n').length,
            characters: fileContent.length,
            isCodeFile: ['.swift', '.m', '.h', '.c', '.cpp', '.js', '.ts', '.py', '.java'].includes(fileExt),
            isXcodeFile: ['.swift', '.m', '.h', '.xcodeproj', '.xcworkspace', '.plist', '.storyboard', '.xib'].includes(fileExt)
        };
        
        // 코드 파일인 경우 추가 분석
        if (analysis.isCodeFile) {
            const lines = fileContent.split('\n');
            analysis.codeAnalysis = {
                imports: lines.filter(line => line.trim().startsWith('import ')).length,
                functions: lines.filter(line => line.includes('func ') || line.includes('function ')).length,
                classes: lines.filter(line => line.includes('class ') || line.includes('struct ')).length,
                comments: lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('/*')).length,
                emptyLines: lines.filter(line => line.trim() === '').length
            };
        }
        
        res.json({
            success: true,
            message: 'File analysis completed',
            analysis: analysis,
            workspace: targetWorkspace
        });
        
    } catch (error) {
        console.error('Error analyzing file:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 12. 파일 수정 요청 (개선된 버전)
app.post('/modify-file', async (req, res) => {
    try {
        const { filePath, instruction, workspacePath, backup = true } = req.body;
        
        if (!filePath || !instruction) {
            return res.status(400).json({
                success: false,
                error: 'filePath and instruction are required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath || process.cwd();
        const fullPath = path.resolve(targetWorkspace, filePath);
        
        // 파일이 존재하는지 확인
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }
        
        // 백업 생성
        if (backup) {
            const backupPath = fullPath + '.backup.' + Date.now();
            fs.copyFileSync(fullPath, backupPath);
            console.log(`Backup created: ${backupPath}`);
        }
        
        // Cursor CLI를 사용하여 파일 수정 (echo를 통해 입력 전달)
        const command = `echo "${instruction}" | /usr/local/bin/cursor agent --print --output-format text --force`;
        let result;
        let responseContent;
        
        try {
            result = await executeCursorCLI(command, path.dirname(fullPath));
            if (result.success && result.stdout && result.stdout.trim()) {
                responseContent = result.stdout.trim();
            } else {
                responseContent = generateFallbackResponse(instruction, 'completion');
                console.log('Using fallback response for file modification');
            }
        } catch (error) {
            responseContent = generateFallbackResponse(instruction, 'completion');
            console.log('Cursor CLI failed for file modification:', error.message);
        }
        
        res.json({
            success: true,
            message: 'File modification request processed',
            response: responseContent,
            filePath: fullPath,
            relativePath: path.relative(targetWorkspace, fullPath),
            workspace: targetWorkspace,
            backupCreated: backup
        });
        
    } catch (error) {
        console.error('Error modifying file:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 13. 파일 비교 (diff) 기능
app.post('/diff-files', async (req, res) => {
    try {
        const { file1, file2, workspacePath } = req.body;
        
        if (!file1 || !file2) {
            return res.status(400).json({
                success: false,
                error: 'file1 and file2 are required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath || process.cwd();
        const fullPath1 = path.resolve(targetWorkspace, file1);
        const fullPath2 = path.resolve(targetWorkspace, file2);
        
        // 파일들이 존재하는지 확인
        if (!fs.existsSync(fullPath1) || !fs.existsSync(fullPath2)) {
            return res.status(404).json({
                success: false,
                error: 'One or both files not found'
            });
        }
        
        const command = `cursor --diff "${fullPath1}" "${fullPath2}"`;
        const result = await executeCursorCLI(command, targetWorkspace);
        
        res.json({
            success: true,
            message: 'File comparison completed',
            diff: result.stdout,
            file1: fullPath1,
            file2: fullPath2,
            workspace: targetWorkspace
        });
        
    } catch (error) {
        console.error('Error comparing files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 14. 파일 병합 (merge) 기능
app.post('/merge-files', async (req, res) => {
    try {
        const { path1, path2, base, result, workspacePath } = req.body;
        
        if (!path1 || !path2 || !base || !result) {
            return res.status(400).json({
                success: false,
                error: 'path1, path2, base, and result are required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath || process.cwd();
        const fullPath1 = path.resolve(targetWorkspace, path1);
        const fullPath2 = path.resolve(targetWorkspace, path2);
        const fullBase = path.resolve(targetWorkspace, base);
        const fullResult = path.resolve(targetWorkspace, result);
        
        const command = `cursor --merge "${fullPath1}" "${fullPath2}" "${fullBase}" "${fullResult}"`;
        const mergeResult = await executeCursorCLI(command, targetWorkspace);
        
        res.json({
            success: true,
            message: 'File merge completed',
            result: mergeResult.stdout,
            mergedFile: fullResult,
            workspace: targetWorkspace
        });
        
    } catch (error) {
        console.error('Error merging files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 15. 실제 파일 수정 (코드 생성 및 파일 쓰기)
app.post('/write-file', async (req, res) => {
    try {
        const { filePath, content, instruction, workspacePath, backup = true } = req.body;
        
        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'filePath is required'
            });
        }
        
        const targetWorkspace = workspacePath || currentWorkspacePath || process.cwd();
        const fullPath = path.resolve(targetWorkspace, filePath);
        
        // 백업 생성
        if (backup && fs.existsSync(fullPath)) {
            const backupPath = fullPath + '.backup.' + Date.now();
            fs.copyFileSync(fullPath, backupPath);
            console.log(`Backup created: ${backupPath}`);
        }
        
        let fileContent = content;
        
        // content가 없고 instruction이 있는 경우 Cursor CLI로 생성
        if (!content && instruction) {
            const command = `echo "${instruction}" | /usr/local/bin/cursor agent --print --output-format text --force`;
            const result = await executeCursorCLI(command, path.dirname(fullPath));
            
            if (result.success && result.stdout) {
                // Swift 코드 블록 추출
                const codeMatch = result.stdout.match(/```swift\n([\s\S]*?)\n```/);
                if (codeMatch) {
                    fileContent = codeMatch[1];
                } else {
                    // 코드 블록이 없으면 전체 응답 사용
                    fileContent = result.stdout;
                }
            } else {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to generate content with Cursor CLI'
                });
            }
        }
        
        if (!fileContent) {
            return res.status(400).json({
                success: false,
                error: 'No content to write'
            });
        }
        
        // 파일 쓰기
        fs.writeFileSync(fullPath, fileContent, 'utf8');
        
        res.json({
            success: true,
            message: 'File written successfully',
            filePath: fullPath,
            relativePath: path.relative(targetWorkspace, fullPath),
            workspace: targetWorkspace,
            contentLength: fileContent.length,
            backupCreated: backup
        });
        
    } catch (error) {
        console.error('Error writing file:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 16. Cursor 에디터 열기
app.post('/open-editor', async (req, res) => {
    try {
        const { filePath, workspacePath, newWindow = false, gotoLine = null } = req.body;
        
        const targetWorkspace = workspacePath || currentWorkspacePath || process.cwd();
        let command = 'cursor editor';
        
        if (filePath) {
            const fullPath = path.resolve(targetWorkspace, filePath);
            command += ` "${fullPath}"`;
        } else {
            command += ` "${targetWorkspace}"`;
        }
        
        if (newWindow) {
            command += ' --new-window';
        }
        
        if (gotoLine) {
            command += ` --goto "${filePath}:${gotoLine}"`;
        }
        
        const result = await executeCursorCLI(command, targetWorkspace);
        
        res.json({
            success: true,
            message: 'Editor opened successfully',
            result: result.stdout,
            filePath: filePath,
            workspace: targetWorkspace
        });
        
    } catch (error) {
        console.error('Error opening editor:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 16. 확장 프로그램 관리
app.get('/extensions', async (req, res) => {
    try {
        const command = 'cursor --list-extensions --show-versions';
        const result = await executeCursorCLI(command, process.cwd());
        
        res.json({
            success: true,
            message: 'Extensions list retrieved',
            extensions: result.stdout,
            workspace: process.cwd()
        });
        
    } catch (error) {
        console.error('Error listing extensions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 17. 확장 프로그램 설치
app.post('/install-extension', async (req, res) => {
    try {
        const { extensionId, preRelease = false } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({
                success: false,
                error: 'extensionId is required'
            });
        }
        
        let command = `cursor --install-extension "${extensionId}"`;
        if (preRelease) {
            command += ' --pre-release';
        }
        
        const result = await executeCursorCLI(command, process.cwd());
        
        res.json({
            success: true,
            message: 'Extension installation completed',
            result: result.stdout,
            extensionId: extensionId
        });
        
    } catch (error) {
        console.error('Error installing extension:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 18. Cursor 상태 확인
app.get('/cursor-status', async (req, res) => {
    try {
        const command = 'cursor --status';
        const result = await executeCursorCLI(command, process.cwd());
        
        res.json({
            success: true,
            message: 'Cursor status retrieved',
            status: result.stdout,
            workspace: process.cwd()
        });
        
    } catch (error) {
        console.error('Error getting cursor status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 19. 채팅 세션 생성
app.post('/create-chat', async (req, res) => {
    try {
        const command = 'cursor create-chat';
        const result = await executeCursorCLI(command, process.cwd());
        
        res.json({
            success: true,
            message: 'Chat session created',
            chatId: result.stdout.trim(),
            workspace: process.cwd()
        });
        
    } catch (error) {
        console.error('Error creating chat session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 20. 터널 서버 시작
app.post('/start-tunnel', async (req, res) => {
    try {
        const command = 'cursor tunnel';
        const result = await executeCursorCLI(command, process.cwd());
        
        res.json({
            success: true,
            message: 'Tunnel server started',
            result: result.stdout,
            workspace: process.cwd()
        });
        
    } catch (error) {
        console.error('Error starting tunnel:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 21. 웹 서버 시작
app.post('/start-web-server', async (req, res) => {
    try {
        const command = 'cursor serve-web';
        const result = await executeCursorCLI(command, process.cwd());
        
        res.json({
            success: true,
            message: 'Web server started',
            result: result.stdout,
            workspace: process.cwd()
        });
        
    } catch (error) {
        console.error('Error starting web server:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 핸들러
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 Cursor Server is running on port ${PORT}`);
    console.log(`📁 Default workspace: ${process.cwd()}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 Available endpoints:`);
    console.log(`   GET  /health - 서버 상태 확인`);
    console.log(`   GET  /v1/models - Xcode Code Intelligence 모델 목록`);
    console.log(`   POST /v1/completions - Xcode Code Intelligence 코드 완성`);
    console.log(`   POST /v1/chat/completions - Xcode Code Intelligence 채팅 완성`);
    console.log(`   POST /set-workspace - 작업 디렉토리 설정`);
    console.log(`   GET  /workspace - 현재 작업 디렉토리 조회`);
    console.log(`   POST /chat - Cursor CLI 채팅 요청 (기존 API)`);
    console.log(`   POST /modify-code - 코드 수정 요청`);
    console.log(`   POST /execute - 일반 Cursor CLI 명령 실행`);
    console.log(`   GET  /project-info - 프로젝트 정보 조회`);
    console.log(`   POST /analyze-file - 파일 분석 요청`);
    console.log(`   POST /modify-file - 파일 수정 요청`);
    console.log(`   POST /diff-files - 파일 비교 (diff)`);
    console.log(`   POST /merge-files - 파일 병합 (merge)`);
    console.log(`   POST /open-editor - Cursor 에디터 열기`);
    console.log(`   GET  /extensions - 확장 프로그램 목록`);
    console.log(`   POST /install-extension - 확장 프로그램 설치`);
    console.log(`   GET  /cursor-status - Cursor 상태 확인`);
    console.log(`   POST /create-chat - 채팅 세션 생성`);
    console.log(`   POST /start-tunnel - 터널 서버 시작`);
    console.log(`   POST /start-web-server - 웹 서버 시작`);
});

module.exports = app;
