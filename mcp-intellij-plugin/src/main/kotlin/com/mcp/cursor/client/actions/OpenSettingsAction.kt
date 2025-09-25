package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

/**
 * 설정 패널 열기 액션
 */
class OpenSettingsAction : AnAction("서버 설정 패널", "MCP 서버 설정 패널을 엽니다", null) {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow = toolWindowManager.getToolWindow("MCP Cursor Settings")
        
        if (toolWindow != null) {
            toolWindow.activate(null)
        }
    }
}
