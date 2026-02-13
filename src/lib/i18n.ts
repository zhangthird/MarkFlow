export type Language = 'zh' | 'en'

export const translations = {
  zh: {
    // Toolbar
    hideSidebar: '隐藏侧边栏',
    showSidebar: '显示侧边栏',
    openFolder: '打开文件夹',
    save: '保存',
    saveShortcut: '保存 (Ctrl+S)',
    search: '搜索',
    searchShortcut: '搜索 (Ctrl+F)',
    switchToLight: '切换到亮色模式',
    switchToDark: '切换到暗色模式',
    exitFocusMode: '退出专注模式',
    focusMode: '专注模式',
    exportPDF: '导出 PDF',
    
    // Formatting
    bold: '粗体',
    italic: '斜体',
    code: '代码',
    math: '公式',
    heading1: '标题 1',
    heading2: '标题 2',
    heading3: '标题 3',
    bulletList: '无序列表',
    orderedList: '有序列表',
    quote: '引用',
    link: '链接',
    image: '图片',
    table: '表格',
    horizontalRule: '分割线',
    undo: '撤销',
    redo: '重做',
    codeBlock: '代码块',
    mathBlock: '公式块',
    
    // Sidebar
    documents: '文档',
    newFile: '新建文件',
    newMarkdownFile: '新建 Markdown',
    newExcalidrawFile: '新建 Excalidraw',
    newFolder: '新建文件夹',
    rename: '重命名',
    delete: '删除',
    noFiles: '暂无文件',
    createFileToStart: '创建新文件开始写作',
    
    // Editor
    clickToStart: '点击此处开始写作...',
    noFileSelected: '未选择文件',
    selectFileOrCreate: '从侧边栏选择文件或创建新文件',
    
    // Status bar
    markdown: 'Markdown',
    utf8: 'UTF-8',
    unsaved: '未保存',
    words: '字',
    characters: '字符',
    lines: '行',
    
    // Search
    searchPlaceholder: '搜索文件内容...',
    noResults: '无结果',
    
    // Focus mode
    pressEscToExit: '按 Esc 退出专注模式',
    
    // Messages
    folderOpened: '已打开文件夹',
    openFolderFailed: '打开文件夹失败',
    browserNotSupported: '您的浏览器不支持文件系统访问 API，请使用 Chrome 或 Edge 浏览器',
    fileSaved: '文件已保存',
    saveFailed: '保存失败',
    
    // Sample content
    sampleTitle: '欢迎使用 MarkFlow',
    sampleSubtitle: '这是一个 **WYSIWYG** Markdown 编辑器，支持实时渲染。',
    features: '功能特性',
    liveRendering: '**实时渲染**：编辑时即可看到格式化效果',
    mathSupport: '**数学公式**：支持 LaTeX 公式',
    cleanInterface: '**简洁界面**：极简设计，专注写作',
    mathExample: '数学公式示例',
    inlineFormula: '行内公式：',
    blockFormula: '块级公式：',
    codeBlock: '代码块',
    lists: '列表',
    firstItem: '第一项',
    secondItem: '第二项',
    thirdItem: '第三项',
    unorderedList: '无序列表',
    anotherItem: '另一项',
    nestedItem: '嵌套项',
    quoteText: '预测未来的最好方式就是创造它。',
    tableHeader: '表格',
    feature: '功能',
    status: '状态',
    startEditing: '开始编辑体验吧！',
  },
  en: {
    // Toolbar
    hideSidebar: 'Hide Sidebar',
    showSidebar: 'Show Sidebar',
    openFolder: 'Open Folder',
    save: 'Save',
    saveShortcut: 'Save (Ctrl+S)',
    search: 'Search',
    searchShortcut: 'Search (Ctrl+F)',
    switchToLight: 'Switch to Light Mode',
    switchToDark: 'Switch to Dark Mode',
    exitFocusMode: 'Exit Focus Mode',
    focusMode: 'Focus Mode',
    exportPDF: 'Export PDF',
    
    // Formatting
    bold: 'Bold',
    italic: 'Italic',
    code: 'Code',
    math: 'Formula',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletList: 'Bullet List',
    orderedList: 'Ordered List',
    quote: 'Quote',
    link: 'Link',
    image: 'Image',
    table: 'Table',
    horizontalRule: 'Horizontal Rule',
    undo: 'Undo',
    redo: 'Redo',
    codeBlock: 'Code Block',
    mathBlock: 'Formula Block',
    
    // Sidebar
    documents: 'Documents',
    newFile: 'New File',
    newMarkdownFile: 'New Markdown',
    newExcalidrawFile: 'New Excalidraw',
    newFolder: 'New Folder',
    rename: 'Rename',
    delete: 'Delete',
    noFiles: 'No files yet',
    createFileToStart: 'Create a new file to get started',
    
    // Editor
    clickToStart: 'Click here to start writing...',
    noFileSelected: 'No File Selected',
    selectFileOrCreate: 'Select a file from the sidebar or create a new one',
    
    // Status bar
    markdown: 'Markdown',
    utf8: 'UTF-8',
    unsaved: 'Unsaved',
    words: 'words',
    characters: 'characters',
    lines: 'lines',
    
    // Search
    searchPlaceholder: 'Search in files...',
    noResults: 'No results',
    
    // Focus mode
    pressEscToExit: 'Press Esc to exit focus mode',
    
    // Messages
    folderOpened: 'Folder opened',
    openFolderFailed: 'Failed to open folder',
    browserNotSupported: 'Your browser does not support File System Access API. Please use Chrome or Edge.',
    fileSaved: 'File saved',
    saveFailed: 'Failed to save',
    
    // Sample content
    sampleTitle: 'Welcome to MarkFlow',
    sampleSubtitle: 'This is a **WYSIWYG** Markdown editor with live rendering.',
    features: 'Features',
    liveRendering: '**Live Rendering**: See your formatted text as you type',
    mathSupport: '**Math Formulas**: Support for LaTeX equations',
    cleanInterface: '**Clean Interface**: Minimal, distraction-free writing experience',
    mathExample: 'Math Example',
    inlineFormula: 'Inline formula: ',
    blockFormula: 'Block formula: ',
    codeBlock: 'Code Blocks',
    lists: 'Lists',
    firstItem: 'First item',
    secondItem: 'Second item',
    thirdItem: 'Third item',
    unorderedList: 'Bullet point',
    anotherItem: 'Another bullet',
    nestedItem: 'Nested bullet',
    quoteText: 'The best way to predict the future is to create it.',
    tableHeader: 'Table',
    feature: 'Feature',
    status: 'Status',
    startEditing: 'Start editing to see the magic!',
  }
}

export type TranslationKey = keyof typeof translations.zh
