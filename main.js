/**
 * plugin_id: s-c-panel
 */

const {
  Plugin,
  PluginSettingTab,
  Setting,
  SettingGroup,
  ExtraButtonComponent,
  Notice,
  Modal,
  FuzzySuggestModal,
  MarkdownView,
  EditorSuggest,
} = require('obsidian')

// 配置默认值
const DEFAULT_SETTINGS = {
  triggers: [':'],
  cmdrShowDesc: true,
  cmdrAutoClose: true,
  cmdAliases: {},
  scriptAliases: [],
}

const DESC = {
  triggers: '支持多个，一行一个。也能通过命令触发。<br>',
  cmdrAutoClose: '检索不到命令时自动关闭。<br>',
  ['查询语法']: `
空格 首空格后内容作为查询参数，空格分隔参数<br>
查询参数访问：<strong>app.plugins.plugins['s-c-panel'].q_args</strong><br>
?/？ 强制显示描述<br>
!/！ 强制显示隐藏
  `,
  cmdAliases: `
格式说明：<strong>[隐藏部分]显示名称{描述内容}</strong><br>
示例：[save]保存当前文件{保存当前编辑的文件}
  `,
  scriptAliases: `
格式说明：<strong>[隐藏部分]显示名称{描述内容} $脚本</strong><br>
支持多个，一行一个。<br>
<a href='https://github.com/oquhe/obsidian-scp/blob/master/README.md#%E8%84%9A%E6%9C%AC'>
脚本</a>使用 JSON 格式，可用转义：<strong>\\$ \\\\</strong>
  `
}
const I18N = {
  [DESC.triggers]: {
    en: 'Support multiple, one per line. It can also be triggered through commands. <br>'
  },
  [DESC.cmdrAutoClose]: {
    en: ''
  },
  [DESC['查询语法']]: {
    en: `
Space: The content after the first space is used as the query args, separated by spaces<br>
Access query args: <strong>app.plugins.plugins['s-c-panel'].q_args</strong><br>
?/？: Force display desc content<br>
!/！: Force display hide content
    `
  },
  [DESC.cmdAliases]: {
    en: `
Format specifies: <strong>[Hidden]Displayed{Desc}</strong>
    `
  },
  [DESC.scriptAliases]: {
    en: `
Format specifies: <strong>[Hidden]Displayed{Desc} $<em>Script</em></strong><br>
Support multiple, one per line. <br>
<a href='https://github.com/oquhe/obsidian-scp/blob/master/README.md#%E8%84%9A%E6%9C%AC'>
Script</a> JSON format. Available escapes in the <em>Script</em>: <strong>\\$ \\\\</strong>
    `
  },
  '打开': {
    en: 'Open'
  },
  '确认': {
    en: 'Yes',
  },
  '取消': {
    en: 'No',
  },
  '未找到命令': {
    en: 'Command not found',
  },
  '编辑': {
    en: 'Edit'
  },
  '添加': {
    en: 'Add'
  },
  '删除': {
    en: 'Delete'
  },
  '默认：': {
    en: 'Default: '
  },
  '触发符': {
    en: 'Trigger symbol'
  },
  '显示描述': {
    en: 'Show desc'
  },
  '无选项自动关闭': {
    en: 'Auto close without options'
  },
  '命令查询': {
    en: 'Commands Query'
  },
  '查询语法': {
    en: 'Instructions'
  },
  '别名管理': {
    en: 'Manage aliases'
  },
  '命令别名': {
    en: 'Give commands aliases'
  },
  '脚本别名': {
    en: 'Give scripts aliases'
  },
  '确认删除？': {
    en: 'Confirm deletion? '
  },
  '脚本解析错误': {
    en: 'Script parsing error'
  },
}
function i18n(text) {
  const translation = I18N?.[text]
  if (!translation) return text
  switch (i18next.language) {
    case 'zh':
      return text
    case 'zh-TW':
      return translation?.['zh-TW'] ?? text
    default:
      return translation?.[i18next.language] ?? translation?.en ?? text
  }
}


/**
 * 插件主体
 */
exports.default = class ScpPlugin extends Plugin {
  q_args = [] // 查询参数
  
  async onload() {
    await this.loadSettings()
    // 添加命令
    this.addCommand({
      id: 's-c-panel',
      name: i18n("打开"),
      icon: 'app-window',
      editorCallback: (editor, ctx) => {
        this?.editorSuggest.cmdTrigger(editor, ctx)
      },
    })
    
    // 布局加载完成时
    this.app.workspace.onLayoutReady(() => {
      // 添加配置面板
      this.addSettingTab(new ScpSettingTab(this.app, this))
      // 注册编辑建议
      if (this.settings.triggers.length) {
        this.editorSuggest = new ScpEditorSuggest(app, this)
        this.registerEditorSuggest(this.editorSuggest)
      }
    })
  }
  onunload() {
    
  }
  // 加载配置文件
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    )
  }
  // 保存配置文件
  async saveSettings() {
    await this.saveData(this.settings)
  }
  
}

/**
 * 命令项编辑建议
 */
class ScpEditorSuggest extends EditorSuggest {
  blankCmd = {
    id: null,
    name: i18n("未找到命令"),
    callback: ()=>{}
  }
  getItems() {
    const cmds = this.app.commands.listCommands()
    return cmds.concat(this.scriptCmds)
  }
  getItemText(cmd) {
    return (cmd.id in this.aliases)
      ? this.aliases[cmd.id]
      : cmd.name
  }

  exec(text, parsed=false) {
    let obj
    try {
      obj = parsed ? text : JSON.parse(text)
    } catch (e) {
      obj = i18n("脚本解析错误")
    }
    if (typeof obj === 'string') {
      this.pasteAtCursor(obj)
      return
    }
    if (typeof obj === 'number') {
      if (Number.isInteger(obj)) {
        this.moveCursor({ch: obj})
        return
      }
    }
    if (Array.isArray(obj)) {
      obj.forEach(o => this.exec(o, true))
      return
    }
    if (obj.constructor === Object) {
      const tag = obj?.tag
      if (typeof tag !== 'string') return
      switch (tag.toLowerCase()) {
        case 'cmd':
        case 'command':
          this.execCmd(obj)
          break
        case 'insert':
          this.insertAtCursor(obj)
          break
        case 'move':
          this.moveCursor(obj)
          break
      }
      return
    }
    this.pasteAtCursor(String(text))
  }
  execCmd(obj) {
    const cmds = this.app.commands.listCommands()
    let cmd
    if (obj?.id) cmd = cmds.find(c=>c.id===obj.id)
    if (!cmd && obj?.name) cmd = cmds.find(c=>c.name===obj.name)
    if (!cmd) return
    this.q_args = obj?.args
    this.plugin.q_args = this.q_args
    this.app.commands.executeCommand(cmd)
    this.q_args = []
    this.plugin.q_args = []
  }
  pasteAtCursor(text) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view) return
    view.editor.replaceSelection(text, 'input.complete')
  }
  insertAtCursor(obj) {
    if (!('text' in obj && typeof obj.text === 'string')) return
    if (!('ch' in obj && typeof obj.ch === 'number' && Number.isInteger(obj.ch))) {
      obj.ch = obj.text.length
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view) return
    const editor = view.editor
    if (obj.ch < 0) {
      editor.replaceSelection(obj.text, 'input.complete')
      let cursor = editor.getCursor()
      editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor)+obj.ch))
    } else {
      let cursor = editor.getCursor()
      editor.replaceSelection(obj.text, 'input.complete')
      editor.setCursor(cursor.line, cursor.ch+obj.ch)
    }
  }
  moveCursor(obj) {
    if (!('ch' in obj && typeof obj.ch === 'number' && Number.isInteger(obj.ch))) {
      obj.ch = 0
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view) return
    const editor = view.editor
    const cursor = editor.getCursor()
    if ('n' in obj && typeof obj.n === 'number' && Number.isInteger(obj.n)) {
      editor.setCursor(cursor.line+obj.n, obj.ch)
    } else {
      editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor)+obj.ch))
    }
  }

  processAliases(cmdAliases, scriptAliases) {
    let aliases = cmdAliases
    let scriptCmds = []
    scriptAliases.forEach(scriptAlias => {
      const arr = scriptAlias.split(/[^\\]\$/)
      if (arr.length < 2) return
      const name = arr.slice(0, -1).join('').trim()
      let text = arr.at(-1)
        .replace(/([^\\]|^)\\([$\\])/g, '$1$2')
      scriptCmds.push({ id: null, name: name,
        callback: ()=>this.exec(text)
      })
    })
    return {aliases, scriptCmds}
  }
  constructor(app, plugin) {
    super(app)
    this.plugin = plugin
    this.triggers = this.plugin.settings.triggers
    const { aliases, scriptCmds } = this.processAliases(this.plugin.settings.cmdAliases, this.plugin.settings.scriptAliases)
    this.aliases = aliases
    this.scriptCmds = scriptCmds
    this.fuzzyMatch = new FuzzyMatch(this.app, this)
  }
  cmdTrigger(editor, ctx) {
    if (this.isOpen) return
    const re = this.trigger(editor, ctx, true)
    if (re) return
    
    const cursor = editor.getCursor()
    const front = editor.getLine(cursor.line).slice(0, cursor.ch)
    this.curTrigger = front.slice(-5)
    if (this.curTrigger.length < 5) {
      this.curTrigger = { front: this.curTrigger }
    }
    this.fromCmd = true
    this.trigger(editor, ctx, true)
  }
  open() {
    const { aliases, scriptCmds } = this.processAliases(this.plugin.settings.cmdAliases, this.plugin.settings.scriptAliases)
    this.aliases = aliases
    this.scriptCmds = scriptCmds
    super.open()
  }
  close() {
    this.curTrigger = null
    this.fromCmd = null
    super.close()
  }
  onTrigger(cursor, editor) {
    const front = editor.getLine(cursor.line).slice(0, cursor.ch)
    // 已有触发符或命令触发
    if (this.curTrigger) {
      // front 触发符
      if (this.curTrigger?.front != null) {
        if (front.startsWith(this.curTrigger.front)) {
          const start = {
            line: cursor.line,
            ch: this.curTrigger.front.length
          }
          this.reLine = () => editor.replaceRange('', start, cursor)
          return { start,
            end: cursor,
            query: front.slice(start.ch)
          }
        }
        this.close()
        return
      }
      // 普通触发符
      const rePos = {
        line: cursor.line,
        ch: front.lastIndexOf(this.curTrigger)
      }
      if (rePos.ch === -1) {
        this.close()
        return
      }
      const start = {
        line: cursor.line,
        ch: rePos.ch + this.curTrigger.length
      }
      this.reLine = this.fromCmd
        ? ()=>editor.replaceRange('', start, cursor)
        : ()=>editor.replaceRange('', rePos, cursor)
      return { start,
        end: cursor,
        query: front.slice(start.ch),
      }
    }
    // 新触发符
    for (const t of this.triggers) {
      if (front.endsWith(t)) {
        const start = {
          line: cursor.line,
          ch: cursor.ch - t.length
        }
        this.curTrigger = t
        this.reLine = () => editor.replaceRange('', start, cursor)
        this.fromCmd = null
        return {start, end: cursor, query: ''}
      }
    }
    return
  }
  getSuggestions(context) {
    const query = context.query.trim()
    let arr = query.split(/\s+/)
    this.q_args = arr.slice(1)
    let q_query = arr[0]
    this.showDesc = /[?？]/.test(q_query)
    q_query = q_query.replace(/[?？]/g, '')
    this.showHide = /[!！]/.test(q_query)
    q_query = q_query.replace(/[!！]/g, '')
    let suggestions = this.fuzzyMatch.getSuggestions(q_query)
    if (!suggestions.length && !this.plugin.settings.cmdrAutoClose) suggestions = [{
      item: this.blankCmd,
      match: { matches: [] }
    }]
    return suggestions
  }
  selectSuggestion(fm, evt) {
    this.reLine()
    this.plugin.q_args = this.q_args
    this.close()
    let cmd = fm.item
    if (cmd.id) this.app.commands.executeCommand(cmd)
    else cmd.callback()
    /*
    if (!cmd.name.includes(i18n("重复上一个命令"))) {
      window.sessionStorage.setItem('LastCommand', cmd.id)
    }
    */
    this.q_args = []
    this.plugin.q_args = []
  }
  
  // 分割匹配区间
  splitMatches(matches, splitPoint) {
    if (!matches.length) return [[], []]
    for (let i = 0; i < matches.length; i++) {
      const [start, end] = matches[i]
      if (splitPoint <= start) {
        return [matches.slice(0, i), matches.slice(i)]
      }
      if (splitPoint < end) {
        return [
          [...matches.slice(0, i), [start, splitPoint]],
          [[splitPoint, end], ...matches.slice(i + 1)]
        ]
      }
    }
    return [matches, []]
  }
  // 将匹配区间转换为文本段，非强调、强调交替
  matchesToTextSegments(matches, text, start, end) {
    let segments = []
    let cur = start
    matches.forEach(match => {
      segments.push(text.slice(cur, match[0]))
      segments.push(text.slice(match[0], match[1]))
      cur = match[1]
    })
    segments.push(text.slice(cur, end))
    return segments
  }
  // 渲染文本段
  renderTextSegments(el, segments, shouldTrim=false) {
    if (!segments.length) return
    if (shouldTrim) {
      segments[0] = segments[0].slice(1)
      segments[segments.length-1] = segments.at(-1).slice(0, -1)
    }
    const fragment = new DocumentFragment()
    for (let i=0; i<segments.length; i++) {
      if (i % 2 === 0) {
        const spanEl = document.createElement('span')
        spanEl.textContent = segments[i]
        fragment.appendChild(spanEl)
        //el.createEl('span', { text: segments[i] })
      } else {
        const strongEl = document.createElement('strong')
        strongEl.textContent = segments[i]
        fragment.appendChild(strongEl)
        //const strongEl = el.createEl('strong', { text: segments[i] })
        //strongEl.style.color = 'var(--text-accent)'
      }
    }
    el.appendChild(fragment)
  }
  // 渲染建议项
  renderSuggestion(fm, el) {
    let text = this.fuzzyMatch.getItemText(fm.item)
    let matches = fm.match.matches
    
    // 处理别名
    const alias = fm.item.id
      ? this.aliases[fm.item.id]
      : fm.item.name
    if (!alias) {
      const nameSegments = this.matchesToTextSegments(matches, text, 0, text.length)
      const nameEl = el.createEl('div')
      this.renderTextSegments(nameEl, nameSegments)
      return
    }
    const hideAfter = Alias.hideAfter(alias)
    const descBefore = Alias.descBefore(alias)
    
    // 分割匹配区间
    const [hideMatches, remainingMatches] = this.splitMatches(matches, hideAfter)
    const [nameMatches, descMatches] = this.splitMatches(remainingMatches, descBefore)
    
    // 转换文本段
    const hideSegments = this.matchesToTextSegments(hideMatches, text, 0, hideAfter)
    const nameSegments = this.matchesToTextSegments(nameMatches, text, hideAfter, descBefore)
    const descSegments = this.matchesToTextSegments(descMatches, text, descBefore, text.length)
    
    
    const nameEl = el.createEl('div')
    // 显示描述
    if (descSegments.length && (this.showHide || this.plugin.settings.cmdrShowDesc)) {
      const descEl = el.createEl('div')
      descEl.className = 'scp desc'
      // 1. 显示描述和隐藏
      if (hideSegments.length && this.showHide) {
        this.renderTextSegments(nameEl, nameSegments)
        this.renderTextSegments(descEl, hideSegments)
        this.renderTextSegments(descEl, descSegments, true)
        return
      }
      // 2. 显示描述，不显示隐藏
      this.renderTextSegments(nameEl, nameSegments)
      this.renderTextSegments(descEl, descSegments, true)
      return
    }
    // 3. 不显示描述，显示隐藏
    if (hideSegments.length && this.showHide) {
      this.renderTextSegments(nameEl, hideSegments)
      this.renderTextSegments(nameEl, nameSegments)
      return
    }
    // 4. 不显示描述和隐藏
    this.renderTextSegments(nameEl, nameSegments)
    return
  }
}

// 别名工具类
class Alias {
  static getHide(alias) {
    const match = str.match(/^\[([^\]]+)\]/)
    return match ? match[1].trim() : ''
  }
  static getName(alias) {
    return alias
      .replace(/^\[([^\]]+)\]/, '')
      .replace(/\{([^{]+)\}$/, '')
      .trim()
  }
  static getDesc(alias) {
    const match = str.match(/\{([^{]+)\}$/)
    return match ? match[1].trim() : ''
  }
  static hideAfter(alias) {
    return alias.indexOf(']') + 1
  }
  static descBefore(alias) {
    const i = alias.lastIndexOf('{')
    return i===-1 ? alias.length : i
  }
}

// 设置面板
class ScpSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin)
    this.plugin = plugin
  }
  getCommands() {
    const cmds = this.app.commands.listCommands()
    const keys = Object.keys(this.plugin.settings.cmdAliases)
    return cmds.filter(cmd => keys.includes(cmd.id))
  }
  deleteAlias(commandId) {
    delete this.plugin.settings.cmdAliases[commandId]
    this.plugin.saveSettings()
    this.display()
  }
  // 快速创建 DocumentFragment
  createDF(htmlString) {
    const template = document.createElement('template')
    template.innerHTML = htmlString
    return template.content
  }
  display() {
    const { containerEl } = this
    containerEl.empty()
    new SettingGroup(containerEl)
      .addSetting(setting=>setting.setName(i18n("触发符"))
        .setDesc(this.createDF(`
${i18n(DESC.triggers)}
${i18n("默认：")}${DEFAULT_SETTINGS.triggers}
        `))
        .addTextArea(text => text
          .setValue(this.plugin.settings.triggers.join('\n'))
          .onChange(async (value) => {
            let arr = value.split('\n')
            this.plugin.settings.triggers = arr.filter(v=>v)
            this.plugin.saveSettings()
          })
          .then(() => {
            text.inputEl.className = 'scp input'
          })
        )
      )
      .addSetting(setting=>setting.setName(i18n("显示描述"))
        .setDesc(`${i18n("默认：")}${DEFAULT_SETTINGS.cmdrShowDesc}`)
        .addToggle(cp => cp
          .setValue(this.plugin.settings.cmdrShowDesc)
          .onChange(async (value) => {
            this.plugin.settings.cmdrShowDesc = value
            this.plugin.saveSettings()
          })
        )
      )
      .addSetting(setting=>setting.setName(i18n("无选项自动关闭"))
        .setDesc(this.createDF(`
${i18n(DESC.cmdrAutoClose)}
${i18n("默认：")}${DEFAULT_SETTINGS.cmdrAutoClose}
       `))
        .addToggle(cp => cp
          .setValue(this.plugin.settings.cmdrAutoClose)
          .onChange(async (value) => {
            this.plugin.settings.cmdrAutoClose = value
            this.plugin.saveSettings()
          })
        )
      )
    new SettingGroup(containerEl).setHeading(i18n("命令查询"))
      .addSetting(setting=>setting.setName(i18n("查询语法"))
        .setDesc(this.createDF(i18n(DESC['查询语法'])))
        .then(s => s.descEl.style.userSelect='text')
      )
    new SettingGroup(containerEl).setHeading(i18n("别名管理"))
      .addSetting(setting=>setting.setName(i18n("命令别名"))
        .setDesc(this.createDF(i18n(DESC.cmdAliases)))
        .addButton(button=>button.setButtonText(i18n("添加"))
          .setCta()
          .onClick(async () => {
            let arr = this.app.commands.listCommands()
            let aliases = this.plugin.settings.cmdAliases
            let commands = arr.reduce((acc, command) => {
              if (!Object.keys(aliases).includes(command.id)) {
                acc.push(command)
              }
              return acc
            }, [])
            new ChooseCommmandModal(this.app, commands, (command, evt) => {
              this.plugin.settings.cmdAliases[command.id] = command.name
              this.plugin.saveSettings()
              this.display()
            }).open()
          })
        )
        .addButton(button=>button.setButtonText(i18n("编辑"))
          .setCta()
          .onClick(async () => {
            new ChooseCommmandModal(this.app, this.getCommands(), (command, evt) => {
              new InputModal(
                this.app, i18n("编辑"), command.name,
                this.plugin.settings.cmdAliases[command.id],
                value => {
                  this.plugin.settings.cmdAliases[command.id] = value
                  this.plugin.saveSettings()
                  this.display()
                }
              ).open()
            }).open()
          })
        )
        .addButton(button=>button.setButtonText(i18n("删除"))
          .setCta().setWarning()
          .onClick(async () => {
            new ChooseCommmandModal(this.app, this.getCommands(), (cmd, evt) => this.deleteAlias(cmd.id)).open()
          })
        )
      )
      .addSetting(setting=>{ setting.settingEl.style.border='none'
        setting.infoEl.remove()
        const scrollEl = setting.controlEl
        scrollEl.style.display = 'grid'
        scrollEl.style.gridTemplateColumns = '2em 1fr 1.5fr'
        scrollEl.style.gridAutoRows = '2rem'
        scrollEl.style.overflowY = 'auto'
        scrollEl.style.width = '100%'
        scrollEl.style.maxHeight = '30vh'
        const aliases = this.plugin.settings.cmdAliases
        Object.keys(aliases).forEach(id => {
          const cmd = this.app.commands.commands[id]
          const delBtnEl =  scrollEl.createEl('button')
          delBtnEl.textContent = 'Х'
          delBtnEl.type = 'button'
          delBtnEl.onclick = (() => {
            new YNModal(app, i18n("确认删除？"), cmd.name, () => this.deleteAlias(id)).open()
          })
          delBtnEl.style.height = '2rem'
          delBtnEl.style.width = '2rem'
          const nameEl =  scrollEl.createEl('span')
          nameEl.textContent = cmd.name
          nameEl.style.color = 'rgb(255, 153, 153)'
          nameEl.style.fontWeight = 'bold'
          nameEl.style.textAlign = 'left'
          nameEl.style.whiteSpace = 'nowrap'
          nameEl.style.overflowX = 'auto'
          const inputEl = scrollEl.createEl('input')
          inputEl.type = 'text'
          inputEl.value = aliases[id]
          inputEl.onchange = (async () => {
            inputEl.value = inputEl.value.replace(/\s+/g, '')
            aliases[id] = inputEl.value
            this.plugin.saveSettings()
          })
        })
      })
      .addSetting(setting=>setting.setName(i18n("脚本别名"))
        .setDesc(this.createDF(i18n(DESC.scriptAliases)))
      )
      .addSetting(setting=>{
        setting.infoEl.remove()
        setting.settingEl.style.border='none'
        setting.addTextArea(text => text
          .setValue(this.plugin.settings.scriptAliases.join('\n'))
          .onChange(async (value) => {
            let arr = value.split('\n')
            text.inputEl.style.height = `${Math.min((Math.max(3,arr.length)),8)}lh`
            this.plugin.settings.scriptAliases = arr.filter(v=>v)
            this.plugin.saveSettings()
          })
          .then(() => {
            text.inputEl.className = 'scp input'
            text.inputEl.style.width = '100%'
            text.inputEl.style.height = '3lh'
          })
        )
      })
  }
}


// 选择命令面板
class ChooseCommmandModal extends FuzzySuggestModal {
  constructor(app, commands, onChooseItem) {
    super(app)
    this.commands = commands
    this.onChooseItem = onChooseItem
    this.modalEl.className = 'scp cmdr'
    this.inputEl.className = 'scp cmdr-input'
    this.resultContainerEl.className = 'scp cmdr-container'
  }
  getItems() {
    return this.commands
  }
  getItemText(command) {
    return command.name
  }
  //onChooseItem(command, evt) {}
}

// Yes&No 面板
class YNModal extends Modal {
  constructor(app, title, content, onConfirm) {
    super(app)
    this.title = title
    content = Array.isArray(content) ? content : [content]
    const fragment = new DocumentFragment()
    content.forEach(line => {
      const p = document.createElement('p')
      p.textContent = line
      fragment.appendChild(p)
    })
    this.content = fragment
    this.onConfirm = onConfirm
  }
  onOpen() {
    const { modalEl } = this
    modalEl.empty()
    modalEl.style.padding = '2rem'
    modalEl.style.width = '25rem'
    
    new Setting(modalEl).setName(this.title).setHeading()
    modalEl.appendChild(this.content)
    new Setting(modalEl)
      .then(v => {
        v.infoEl.remove()
        v.controlEl.style.border = 'none'
      })
      .addButton(button => button
        .setButtonText(i18n("取消"))
        .setCta()
        .onClick(()=>this.close())
      )
     .addButton(button => button
        .setButtonText(i18n("确认"))
        .setCta().setWarning()
        .onClick(()=>{
          this.close()
          this.onConfirm()
        })
      )
  }
}
// 输入框面板
class InputModal extends YNModal {
  constructor(app, title, content, defaultValue, onConfirm) {
    super(app, title, content, ()=>onConfirm(this.value))
    this.value = defaultValue
  }
  onOpen() {
    const inputEl = document.createElement('input')
    inputEl.type = 'text'
    inputEl.style.width = '100%'
    inputEl.className = 'scp input'
    inputEl.value = this.value
    inputEl.onchange = (async () => {
      inputEl.value = inputEl.value.replace(/\s+/g, '')
      this.value = inputEl.value
    })
    this.content.appendChild(inputEl)
    super.onOpen()
  }
}

/**
 * 模糊匹配
 */
class FuzzyMatch extends FuzzySuggestModal {
  constructor(app, owner) {
    super(app)
    this.getItems = ()=>owner.getItems()
    this.getItemText = item=>owner.getItemText(item)
  }
  //getSuggestions(query) {}
}