package com.mcp.cursor.client.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*
import java.awt.BorderLayout
import java.awt.Dimension
import javax.swing.*

/**
 * AI 코드 생성 액션
 */
class GenerateCodeAction : AnAction() {
    
    private val logger = thisLogger()
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val document = editor.document
        val caretModel = editor.caretModel
        
        val mcpservice = MCPService.getInstance(project)
        
        // 코드 생성 요청 다이얼로그
        val dialog = CodeGenerationDialog(project, mcpservice) { prompt, model ->
            generateCode(project, document, caretModel, prompt, model)
        }
        
        dialog.show()
    }
    
    private fun generateCode(
        project: com.intellij.openapi.project.Project,
        document: com.intellij.openapi.editor.Document,
        caretModel: com.intellij.openapi.editor.CaretModel,
        prompt: String,
        model: String
    ) {
        val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
        val mcpservice = MCPService.getInstance(project)
        
        scope.launch {
            try {
                // 현재 파일의 컨텍스트 가져오기
                val context = document.text
                val language = getLanguageFromDocument(document)
                
                // 로딩 다이얼로그 표시
                ProgressManager.getInstance().run(
                    object : Task.Backgroundable(project, "코드 생성 중", true) {
                        override fun run(indicator: com.intellij.openapi.progress.ProgressIndicator) {
                            // 백그라운드 작업
                        }
                    }
                )
                
                // AI 코드 생성 요청
                val codePrompt = "다음 요청에 따라 $language 코드를 생성해주세요:\n\n$prompt"
                val generatedCode = withContext(Dispatchers.IO) {
                    mcpservice.sendChatMessage(codePrompt, model)
                }
                
                // 진행률 다이얼로그는 자동으로 닫힘
                
                // 생성된 코드를 에디터에 삽입
                ApplicationManager.getApplication().invokeLater {
                    WriteCommandAction.runWriteCommandAction(project) {
                        val offset = caretModel.offset
                        document.insertString(offset, "\n$generatedCode\n")
                        caretModel.moveToOffset(offset + generatedCode.length + 2)
                    }
                }
                
            } catch (e: Exception) {
                logger.error("코드 생성 오류", e)
                Messages.showErrorDialog(
                    project,
                    "코드 생성 중 오류가 발생했습니다: ${e.message}",
                    "오류"
                )
            }
        }
    }
    
    private fun getLanguageFromDocument(document: com.intellij.openapi.editor.Document): String {
        // 파일 확장자나 내용을 기반으로 언어 추정
        // 실제로는 PsiFile을 통해 정확한 언어를 가져와야 함
        return "java" // 기본값
    }
    
    override fun update(e: AnActionEvent) {
        val project = e.project
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = project != null && editor != null
    }
}

/**
 * 코드 생성 다이얼로그
 */
class CodeGenerationDialog(
    private val project: com.intellij.openapi.project.Project,
    private val mcpservice: MCPService,
    private val onGenerate: (String, String) -> Unit
) : JDialog() {
    
    private val promptField = JBTextArea().apply {
        rows = 5
        lineWrap = true
        wrapStyleWord = true
        // placeholderText = "생성하고 싶은 코드에 대해 설명해주세요..."
    }
    
    private val modelComboBox = JComboBox<String>()
    
    init {
        setupUI()
        loadModels()
        setupEventListeners()
    }
    
    private fun setupUI() {
        title = "AI 코드 생성"
        isModal = true
        defaultCloseOperation = DISPOSE_ON_CLOSE
        setSize(500, 400)
        setLocationRelativeTo(null)
        
        val mainPanel = JPanel(BorderLayout())
        
        // 상단 패널
        val topPanel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            add(JLabel("모델 선택:"))
            add(modelComboBox)
            add(Box.createVerticalStrut(10))
            add(JLabel("코드 생성 요청:"))
        }
        
        // 중간 패널
        val centerPanel = JPanel(BorderLayout()).apply {
            add(JScrollPane(promptField), BorderLayout.CENTER)
        }
        
        // 하단 패널
        val bottomPanel = JPanel().apply {
            add(JButton("생성").apply {
                addActionListener {
                    val prompt = promptField.text.trim()
                    val model = modelComboBox.selectedItem?.toString() ?: ""
                    
                    if (prompt.isEmpty()) {
                        Messages.showWarningDialog(project, "코드 생성 요청을 입력해주세요.", "경고")
                        return@addActionListener
                    }
                    
                    onGenerate(prompt, model)
                    dispose()
                }
            })
            add(JButton("취소").apply {
                addActionListener { dispose() }
            })
        }
        
        mainPanel.add(topPanel, BorderLayout.NORTH)
        mainPanel.add(centerPanel, BorderLayout.CENTER)
        mainPanel.add(bottomPanel, BorderLayout.SOUTH)
        
        add(mainPanel)
    }
    
    private fun loadModels() {
        val models = mcpservice.getAvailableModels()
        models.forEach { model ->
            if (model.available) {
                modelComboBox.addItem(model.id)
            }
        }
        
        if (models.isEmpty()) {
            modelComboBox.addItem("사용 가능한 모델 없음")
        }
    }
    
    private fun setupEventListeners() {
        // Enter 키로 생성
        promptField.addKeyListener(object : java.awt.event.KeyAdapter() {
            override fun keyPressed(e: java.awt.event.KeyEvent) {
                if (e.keyCode == java.awt.event.KeyEvent.VK_ENTER && e.isControlDown) {
                    val prompt = promptField.text.trim()
                    val model = modelComboBox.selectedItem?.toString() ?: ""
                    
                    if (prompt.isNotEmpty()) {
                        onGenerate(prompt, model)
                        dispose()
                    }
                }
            }
        })
    }
}

