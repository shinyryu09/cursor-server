package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.ui.Messages

/**
 * MCP Cursor 설정 액션
 */
class SettingsAction : AnAction("MCP Cursor Settings", "MCP Cursor 서버 설정을 엽니다", null) {
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        try {
            ShowSettingsUtil.getInstance().showSettingsDialog(project, "MCP Cursor")
        } catch (ex: Exception) {
            Messages.showErrorDialog(
                project,
                "설정 창을 열 수 없습니다: ${ex.message}",
                "MCP Cursor 설정 오류"
            )
        }
    }
    
    override fun update(e: AnActionEvent) {
        val project = e.project
        e.presentation.isEnabledAndVisible = project != null
    }
}

