// Apple On-Device OpenAI 스타일의 설정 파일
module.exports = {
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        name: 'Cursor Server',
        version: '1.0.0',
        description: 'OpenAI-compatible API server for Cursor CLI and Editor integration'
    },
    models: {
        cursor_cli: {
            enabled: true,
            timeout: 30000,
            context_length: 8192,
            capabilities: {
                chat_completion: true,
                function_calling: false,
                streaming: false
            }
        },
        cursor_cli_fast: {
            enabled: true,
            timeout: 15000,
            context_length: 4096,
            capabilities: {
                chat_completion: true,
                function_calling: false,
                streaming: false
            }
        },
        cursor_editor: {
            enabled: true,
            port: 3001,
            timeout: 10000,
            context_length: 16384,
            capabilities: {
                chat_completion: true,
                function_calling: false,
                streaming: true
            }
        }
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: 'logs/server.log',
        console: true
    },
    cors: {
        allowedOrigins: [
            'xcode://',
            'vscode://',
            'intellij://',
            'http://localhost:*',
            'http://127.0.0.1:*'
        ],
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
    },
    workspace: {
        autoDetect: true,
        defaultPath: process.cwd(),
        supportedHeaders: [
            'x-xcode-project-path',
            'x-project-path',
            'x-workspace-path',
            'x-intellij-project-path',
            'x-vscode-workspace',
            'x-jetbrains-project',
            'x-codebase-path',
            'x-source-path',
            'x-project-root',
            'x-workspace-root'
        ]
    }
};
