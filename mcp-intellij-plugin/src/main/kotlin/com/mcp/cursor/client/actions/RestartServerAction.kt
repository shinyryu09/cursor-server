package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.ui.Messages
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*

/**
 * 서버 재시작 액션
 */
class RestartServerAction : AnAction("서버 재시작", "MCP 서버를 재시작합니다", null), DumbAware {
    
    private val logger = thisLogger()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        // 확인 다이얼로그
        val result = Messages.showYesNoDialog(
            project,
            "MCP 서버를 재시작하시겠습니까?\n\n이 작업은 현재 연결을 끊고 서버를 다시 시작합니다.",
            "서버 재시작 확인",
            "재시작",
            "취소",
            Messages.getQuestionIcon()
        )
        
        if (result != Messages.YES) {
            return
        }
        
        scope.launch {
            try {
                val mcpservice = MCPService.getInstance(project)
                
                // 기존 연결 정리
                mcpservice.cleanup()
                
                // 잠시 대기
                delay(1000)
                
                // 새로 연결 시도
                val isConnected = mcpservice.testConnection()
                
                ApplicationManager.getApplication().invokeLater {
                    if (isConnected) {
                        Messages.showInfoMessage(
                            project,
                            "✅ MCP 서버가 성공적으로 재시작되었습니다!\n\n사용 가능한 AI 모델이 로드되었습니다.",
                            "서버 재시작 완료"
                        )
                    } else {
                        Messages.showErrorDialog(
                            project,
                            "❌ 서버 재시작에 실패했습니다.\n\n설정에서 서버 경로를 확인해주세요.",
                            "서버 재시작 실패"
                        )
                    }
                }
                
            } catch (e: Exception) {
                logger.error("서버 재시작 오류", e)
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(
                        project,
                        "서버 재시작 중 오류가 발생했습니다: ${e.message}",
                        "오류"
                    )
                }
            }
        }
    }
    
    // dispose 메서드는 AnAction에서 지원하지 않음
}
