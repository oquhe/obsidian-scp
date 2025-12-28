
/*
plugin_id:s-c-panel
*/

const {
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  Modal,
  FuzzySuggestModal,
  ButtonComponent,
  Component
} = require('obsidian')

// 设置默认值
const DEFAULT_SETTINGS = {
  cmdrHeight: '300',
  cmdrOlnyBelow: false,
  cmdrScrollIntoView: false,
  cmdrDelay: 5,
  cmdrTurn: true,
  cmdrShowDesc: true,
  cmdrAliasAsName: false,
  cmdrAutoClose: false,
  commandAlias: {},
}

// 插件主体
exports.default = class ScpPlugin extends Plugin {
  q_args = [] // 查询参数
  async onload() {
    await this.loadSettings()
    this.commandModal = null
    
    // 添加命令
    this.addCommand({
      id: "s-c-panel",
      name: "打开",
      icon: "app-window",
      callback: () => {
        if (this.commandModal) return
        // 尝试滚动获取更好的视野
        if (this.settings.cmdrScrollIntoView) {
          let editor = this.app.workspace.activeEditor.editor
          let cursor = editor.getCursor()
          editor.scrollIntoView(
            {from: cursor, to: cursor},
            true
          )
          this.CommandModal = true
          setTimeout(() => {
            new CommandModal(this.app, this).open()
          }, this.settings.cmdrDelay)
          return
        }
        new CommandModal(this.app, this).open()
      },
    })
    
    /*
    // 布局加载完成时
    this.app.workspace.onLayoutReady(() => {
      console.log(app.plugins.plugins['s-c-panel'].q_args)
    })
    */
    /*
    // 添加Ribbon（左侧边栏）
    this.addRibbonIcon("circle", "Click me", () => {
      new Notice("Hello, ribbon!");
    })

    // 添加状态栏
    this.addStatusBarItem().createEl("span", { text: "Hello status bar 👋" });
    */
    
    // 添加配置面板
    this.addSettingTab(new SCPSettingTab(this.app, this))
    
  }
  onunload() {}

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

const {
  ViewPlugin
} = require('@codemirror/view')
// 视图插件
class ScpViewPlugin {
  constructor(view) {
    console.log('构造', view)
  }
  update(update) {
    console.log('更新', update)
  }
  destroy() {
    console.log('销毁')
  }
}
const scpViewPlugin = ViewPlugin.fromClass(ScpViewPlugin)
exports.scpViewPlugin= scpViewPlugin

// 别名的一些静态方法
class Alias {
  static getHide(alias) {
    const match = str.match(/^\[([^\]]+)\]/)
    return match ? match[1].trim() : ''
  }
  static getName(alias) {
    return alias.replace(/^\[[^\]]*\](.*?)\{[^{}]*\}$/, '$1').trim()
  }
  static getDesc(alias) {
    const match = str.match(/\{([^{}]+)\}$/)
    return match ? match[1].trim() : ''
  }
  static hideAfter(alias) {
    if (alias.startsWith('[')) {
      return alias.indexOf(']') + 1
    }
    return 0
  }
  static descBefore(alias) {
    if (alias.endsWith('}')) {
      return alias.lastIndexOf('{')
    }
    return alias.length
  }
}

// 设置面板
class SCPSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin)
    this.plugin = plugin
  }
  getCommands() {
    let arr = this.app.commands.listCommands()
    let keys = Object.keys(this.plugin.settings.commandAlias)
    return arr.filter(command => keys.includes(command.id))
  }
  deleteAlias(commandId) {
    delete this.plugin.settings.commandAlias[commandId]
    this.plugin.saveSettings()
    new Notice('重进配置页生效')
  }
  // 危险操作，仅限测试
  #deleteAllAlias() {
    this.plugin.settings.commandAlias = {}
    this.plugin.saveSettings()
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
    containerEl.createEl('h2', {text: '命令面板'})
    new Setting(containerEl)
      .setName('高度')
      .setDesc(this.createDF(`<span>
命令面板的最大高度。<br>
请输入数字，默认：${DEFAULT_SETTINGS.cmdrHeight}，单位：xp
      </span>`))
      .addText(text => text
        .setValue(this.plugin.settings.cmdrHeight)
        .then(text => {
          text.inputEl.className = 'scp short-input'
        })
        .onChange(async (value) => {
          this.plugin.settings.cmdrHeight = value
          this.plugin.saveSettings()
        })
      )
      .then(s=>s.settingEl.className = 'scp setting-inline')
    new Setting(containerEl)
      .setName('固定在下')
      .setDesc(`命令面板只出现在光标下方，默认：${DEFAULT_SETTINGS.cmdrOlnyBelow}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrOlnyBelow)
        .onChange(async (value) => {
          this.plugin.settings.cmdrOlnyBelow = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('滚动视野')
      .setDesc(`尝试滚动使光标位置在屏幕中间，瞬移可能引起不适，默认：${DEFAULT_SETTINGS.cmdrScrollIntoView}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrScrollIntoView)
        .onChange(async (value) => {
          this.plugin.settings.cmdrScrollIntoView = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('延迟')
      .setDesc(this.createDF(`<span>
延迟开启命令面板。仅在开启滚动视野时生效。<br>
请输入数字，默认：${DEFAULT_SETTINGS.cmdrDelay}，单位：毫秒
      </span>`))
      .addText(text => text
        .setValue(this.plugin.settings.cmdrDelay.toString())
        .then(text => {
          text.inputEl.className = 'scp short-input'
        })
        .onChange(async (value) => {
          value = parseInt(value)
          this.value = value.toString() 
          this.plugin.settings.cmdrDelay = value
          this.plugin.saveSettings()
        })
      )
      .then(s=>s.settingEl.className = 'scp setting-inline')
    new Setting(containerEl)
      .setName('上方时翻转')
      .setDesc(`命令面板位于光标上方时从下往上放置建议项，默认：${DEFAULT_SETTINGS.cmdrTurn}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrTurn)
        .onChange(async (value) => {
          this.plugin.settings.cmdrTurn = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('显示描述')
      .setDesc(`结尾大括号内容作为描述显示，若没有则别名作为描述显示，默认：${DEFAULT_SETTINGS.cmdrShowDesc}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrShowDesc)
        .onChange(async (value) => {
          this.plugin.settings.cmdrShowDesc = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('替换名称')
      .setDesc(`别名不作为描述显示，而是作为名称显示，默认：${DEFAULT_SETTINGS.cmdrAliasAsName}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrAliasAsName)
        .onChange(async (value) => {
          this.plugin.settings.cmdrAliasAsName = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('无选项自动关闭')
      .setDesc(`检索不到命令时自动关闭，默认：${DEFAULT_SETTINGS.cmdrAutoClose}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrAutoClose)
        .onChange(async (value) => {
          this.plugin.settings.cmdrAutoClose = value
          this.plugin.saveSettings()
        })
      )
    containerEl.createEl('h2', {text: '查询'})
    new Setting(containerEl)
      .setName('查询语法')
      .setDesc(this.createDF(`<span>
空格 空格之后的内容作为查询参数，多个参数用空格隔开<br>
&emsp;&emsp; 通过<code>app.plugins.plugins['s-c-panel'].q_args</code>访问参数，命令执行后会清空参数<br>
?/？ 强制显示描述，取消替换名称<br>
!/！ 强制显示隐藏
      </span>`))
      .then(s => s.descEl.style.userSelect='text')
    containerEl.createEl('h2', {text: '命令别名'})
    new Setting(containerEl)
      .setDesc(this.createDF(`<span>
先添加命令，添加后才能编辑别名。<br>
别名用于在简单命令面板作为名称/描述文本。<br>
使用结尾大括号可指定描述文本。<br>
开头中括号为隐藏，不会显示在面板上<br>
例：[save]保存{保存当前文件}<br>
      </span>`))
      .addButton(button => button
        .setButtonText('添加')
        .setCta()
        .onClick(async () => {
          let arr = this.app.commands.listCommands()
          let alias = this.plugin.settings.commandAlias
          let commands = arr.reduce((acc, command) => {
            if (!Object.keys(alias).includes(command.id)) {
              acc.push(command)
            }
            return acc
          }, [])
          new ChooseCommmandModal(this.app, commands, (command, evt) => {
            this.plugin.settings.commandAlias[command.id] = command.name
            this.plugin.saveSettings()
            new Notice('重进配置页生效')
          }).open()
        })
      )
      .addButton(button => button
        .setButtonText('编辑')
        .setCta()
        .onClick(async () => {
          new ChooseCommmandModal(this.app, this.getCommands(), (command, evt) => {
            new InputModal(
              this.app, '编辑', command.name,
              this.plugin.settings.commandAlias[command.id],
              value => {
                this.plugin.settings.commandAlias[command.id] = value
                this.plugin.saveSettings()
                new Notice('重进配置页生效')
              }
            ).open()
          }).open()
        })
      )
      .addButton(button => button
        .setButtonText('删除')
        .setCta()
        .setWarning()
        .onClick(async () => {
          new ChooseCommmandModal(this.app, this.getCommands(), (command, evt) => this.deleteAlias(command.id)).open()
        })
      )
      .then(view => {
        view.controlEl.style.padding = '0'
        view.controlEl.style.margin = '0'
      })
    let alias = this.plugin.settings.commandAlias
    let scrollEl = containerEl.createEl('div')
    scrollEl.className = 'scp scroller'
    Object.keys(alias).forEach(key => {
      let command = this.app.commands.commands[key]
      let line = scrollEl.createEl('div')
      line.style.height = '30px'
      new Setting(line)
        .then(view => view.settingEl.className='scp setting-inlin')
        .addButton(button => button
          .setButtonText('✘')
          .setCta().setWarning()
          .onClick(async () => {
            new YNModal(this.app, '确认删除？', command.name, () => {
              this.deleteAlias(key)
            }).open()
          })
          .then(btn => {
            btn.buttonEl.style.width = '15px'
            btn.buttonEl.style.height = '15px'
          })
        )
        .addText(text => text
          .setValue(command.name)
          .then(text => {
            text.inputEl.readOnly = true
            text.inputEl.style.color = 'rgb(255, 153, 153)'
            text.inputEl.style['font-weight'] = 'bold'
            text.inputEl.style.width = '40%'
            text.inputEl.style.padding = '10px'
            text.inputEl.style.height = '20px'
          })
        )
        .addText(text => text
          .setValue(alias[key])
          .then(text => {
            text.inputEl.className = 'scp input'
          })
          .onChange(async (value) => {
            alias[key] = value
            this.plugin.saveSettings()
          })
        )
    })
    containerEl.createEl('h2', {text: 'CSS 样式类名'})
    new Setting(containerEl)
      .setName('可以使用 CSS 代码片段修改样式')
      .setDesc(this.createDF(`<span>
插件元素 .scp<br>
命令面板 .scp.cmdr<br>
命令面板内容 .scp.cmdr-container<br>
全宽输入框 .scp.full-input<br>
输入框 .scp.input<br>
短输入框 .scp.short-input<br>
描述文本 .scp.desc<br>
滚动容器 .scp.scroller<br>
单行配置项 .scp.setting-inline<bt>
      </span>`))
      .then(s => s.descEl.style.userSelect='text')
  }
}


// 输入框面板
class InputModal extends Modal {
  constructor(app, title, content, defaultValue, onYes) {
    super(app)
    this.title = title
    this.content = content
    this.defaultValue = defaultValue
    this.onYes = onYes
  }
  onOpen() {
    const { contentEl } = this
    let el = contentEl.createEl("h1", { text: this.title })
    new Setting(el)
      .setName(`命令：${this.content}`)
      .then(view => {
        view.controlEl.style['flex-flow'] = 'row wrap'
      })
      .addText(text => text
        .setValue(this.defaultValue)
        .then(text => {
          text.inputEl.className = 'scp full-input'
        })
        .onChange(async (value) => {
          value = value.replace(/\s+/g, '')
          text.inputEl.value = value
          this.value = value
        })
      )
      .addButton(btn => btn
        .setButtonText("取消")
        .setCta()
        .onClick(() => this.close())
        .then(btn => btn.buttonEl.style.flex = '1 1 45%')
      )
      .addButton(btn => btn
        .setButtonText("确认")
        .setCta().setWarning()
        .onClick(() => {
          this.close()
          this.onYes(this.value)
        })
        .then(btn => btn.buttonEl.style.flex = '1 1 45%')
      )
  }
}
// 确认&取消面板
class YNModal extends Modal {
  constructor(app, title, content, onYes) {
    super(app)
    this.title = title
    this.content = content
    this.onYes = onYes
  }
  onOpen() {
    const { contentEl } = this
    let el = contentEl.createEl("h1", { text: this.title })
    new Setting(el)
      .setName(this.content)
      .addButton(btn => btn
        .setButtonText("取消")
        .setCta()
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText("确认")
        .setCta().setWarning()
        .onClick(() => {
          this.close()
          this.onYes()
        })
      )
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


// 执行命令面板
class CommandModal extends FuzzySuggestModal {
  constructor(app, plugin) {
    super(app)
    this.plugin = plugin
    this.component = new Component()
    this.controller = new AbortController()
    this.observer = null
    this.reLine = null
    this.alias = this.plugin.settings.commandAlias
    this.isPop = false
    this.q_args = []
    this.forceShowDesc = false
    this.forceShowHide = false
    
    let el = document.createElement('div')
    this.modalEl = el
    el.appendChild(this.resultContainerEl)
    el.popover = 'manual'
    el.isPop = false
    if(app.isMobile){
  	  this.limit = 50
  	}
  	
  	el.className = 'scp cmdr'
  	this.resultContainerEl.className = 'scp cmdr-container'
  }
  getItems() {
    return this.app.commands.listCommands()
  }
  getItemText(command) {
    if (command.id in this.alias) {
      return this.alias[command.id]
    }
    return command.name
  }
  getSuggestions(query) {
    let arr = query.split(' ')
    this.q_args = arr.slice(1)
    let q_query = arr[0]
    this.forceShowDesc = /[?？]/.test(q_query)
    q_query = q_query.replace(/[?？]/g, '')
    this.forceShowHide = /[!！]/.test(q_query)
    q_query = q_query.replace(/[!！]/g, '')
    return super.getSuggestions(q_query)
  }
  onChooseItem(command, evt) {
    this.component.unload()
    this.controller.abort()
    this.observer?.disconnect()
    if (this.reLine) this.reLine()
    this.plugin.q_args = this.q_args
    this.app.commands.executeCommand(command)
    /*
    if (!command.name.includes('重复上一个命令')) {
      window.sessionStorage.setItem('LastCommand', command.id)
    }
    */
    this.plugin.q_args = []
    this.close()
  }
  onNoSuggestion() {
    super.onNoSuggestion()
    if (this.plugin.settings.cmdrAutoClose) {
      this.close()
    }
  }
  matchesDivide(matches, m) {
    let len = matches.length
    for(var i=0;i<len;i++) {
      let [s, e] = matches[i]
      if (m <= s) {
        return [
          matches.slice(0, i),
          matches.slice(i, len)
        ]
      }
      if (m < e) {
        return [
          [...matches.slice(0, i), [s, m]],
          [[m, e], ...matches.slice(i, len)]
        ]
      }
    }
    return [matches, []]
  }
  // 通过 matches 获取 ss
  // Ss: 字符串数组，未匹配字段、匹配字段，交替放入
  msToSections(ms, text, start, end) {
    let ss = []
    let cur = start
    ms.forEach(match => {
      ss.push(text.slice(cur, match[0]))
      ss.push(text.slice(match[0], match[1]))
      cur = match[1]
    })
    ss.push(text.slice(cur, end))
    return ss
  }
  // 添加 Ss span 元素，匹配字段使用强调色
  addSections(el, ss, trim) {
    if (ss.length===0) return
    if (trim) {
      ss[0] = ss[0].slice(1)
      ss[ss.length-1] = ss.at(-1).slice(0, -1)
    }
    for(let i=0; i<ss.length-1; i+=2) {
      el.createEl('span', {text: ss[i]})
      let keyEl = el.createEl('span', {text: ss[i+1]})
      keyEl.style.color = 'var(--text-accent)'
    }
    el.createEl('span', {text: ss.at(-1)})
  }
  // 渲染建议项
  renderSuggestion(fm, el) {
    let text = this.getItemText(fm.item)
    let matches = fm.match.matches
    let hideAfter = 0
    let descBefore = text.length
    if (fm.item.id in this.alias) {
      const alias = this.alias[fm.item.id]
      hideAfter = Alias.hideAfter(alias)
      descBefore = Alias.descBefore(alias)
    }
    let [hideMs, rightMs] = this.matchesDivide(matches, hideAfter)
    let [nameMs, descMs] = this.matchesDivide(rightMs, descBefore)
    // alias: [hide]_n_ame_{_desc}
    // Ss: 未匹配字段、匹配字段，交替放入
    let hideSs = this.msToSections(hideMs, text, 0, hideAfter)
    let nameSs = this.msToSections(nameMs, text, hideAfter, descBefore)
    let descSs = this.msToSections(descMs, text, descBefore, text.length)
    
    let nameEl = el.createEl('div')
    // 无别名
    if (!(fm.item.id in this.alias)) {
      this.addSections(nameEl, nameSs)
      return
    }
    // 有描述
    if (descSs.length!==0) {
      this.addSections(nameEl, nameSs)
      // 显示描述
      if (this.forceShowDesc || this.plugin.settings.cmdrShowDesc) {
        let descEl = el.createEl('div')
        descEl.className = 'scp desc'
        if (this.forceShowHide) { // 强制显示隐藏
          this.addSections(descEl, hideSs)
        }
        this.addSections(descEl, descSs, true)
      }
      return
    }
    // 无描述，强制别名作为描述
    if (this.forceShowDesc) {
      el.createEl('div', {text: fm.item.name})
      let descEl = el.createEl('div')
      descEl.className = 'scp desc'
      if (this.forceShowHide) { // 强制显示隐藏
        this.addSections(descEl, hideSs)
      }
      this.addSections(descEl, descSs)
    }
    // 无描述，别名替换名称
    if (this.plugin.settings.cmdrAliasAsName) {
      if (this.forceShowHide) { // 强制显示隐藏
        this.addSections(nameEl, hideSs)
      }
      this.addSections(nameEl, nameSs)
      return
    }
    el.createEl('div', {text: fm.item.name})
    // 无描述，不替换名称，不显示描述
    if (!this.plugin.settings.cmdrShowDesc) {
      return
    }
    // 无描述，不替换名称，显示描述
    let descEl = el.createEl('div')
    descEl.className = 'scp desc'
    if (this.forceShowHide) { // 强制显示隐藏
      this.addSections(descEl, hideSs)
    }
    this.addSections(descEl, descSs)
  }
  open() {
    let el = this.modalEl
    if(el.isPop) return
    el.isPop = true
    document.body.appendChild(el)
    
    // 原始编辑器内容
    let raw_editor = this.app.workspace.activeEditor.editor
    let raw_cursor = raw_editor.getCursor()
    let raw_line = raw_editor.getLine(raw_cursor.line)
    let raw_front = raw_line.slice(0, raw_cursor.ch)
    this.reLine = () => {
      let new_line = raw_editor.getLine(raw_cursor.line)
      let front = new_line.slice(0, raw_cursor.ch)
      if (front===raw_front) {
        raw_editor.replaceRange('', 
          {line: raw_cursor.line, ch: new_line.length},
          {line: raw_cursor.line+1, ch: 0})
        raw_editor.setLine(raw_cursor.line, raw_line)
        raw_editor.setCursor(raw_cursor)
      }
    }
    
    // 获取光标位置以设置命令面板位置
    let selection =  window.getSelection()
    if (selection.rangeCount>0) {
      let range = selection.getRangeAt(0)
      let rect = range.getBoundingClientRect()
      if (rect.height == 0) {
        // 插入临时元素来测量位置
        const span = document.createElement('span')
        span.textContent = '\u200b' // 零宽度空格
        range.insertNode(span)
        rect = span.getBoundingClientRect()
        span.parentNode.removeChild(span)
      }
      let cmdrHeight = parseInt(this.plugin.settings.cmdrHeight)
      cmdrHeight = cmdrHeight ? cmdrHeight : parseInt(DEFAULT_SETTINGS.cmdrHeight)
      this.resultContainerEl.style['flex-direction'] = 'column'
      el.style.maxHeight = `${cmdrHeight}px`
      if ((rect.top > cmdrHeight) && !this.plugin.settings.cmdrOlnyBelow) {
        el.style.top = `${rect.top-cmdrHeight}px`
        if (this.plugin.settings.cmdrTurn) {
          this.resultContainerEl.style['flex-direction'] = 'column-reverse'
        }
        this.observer = new ResizeObserver(entries => {
          let entry = entries[0]
          const size = Array.isArray(entry.borderBoxSize)
            ? entry.borderBoxSize[0] 
            : entry.borderBoxSize
          if (size) {
            entry.target.style.top = `${rect.top-size.blockSize}px`
          }
        })
        this.observer.observe(el)
      } else {
        el.style.top = `${rect.bottom}px`
      }
    }
    
    
    el.showPopover()
    this.inputEl.value = ''
    this.inputEl.dispatchEvent(new Event('input'))
    this.component.load()
    
    /* 疑似无用
    // 监听失去焦点时关闭
    let activeEl =  document.activeElement
    activeEl.addEventListener('blur', event => {
      this.close()
    }, {signal: this.controller.signal})
    */
    // 监听触摸外部时关闭
    window.addEventListener('touchstart', event => {
      const touch = event.touches[0]
      if (touch.target === el || el.contains(touch.target)) return
      this.close()
    }, {signal: this.controller.signal})
    // 监听编辑器内容改变时更新查询文本
    this.component.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
      let cursor = editor.getCursor()
      let line = editor.getLine(cursor.line)
      let front = line.slice(0, cursor.ch)
      if (cursor.line==raw_cursor.line+1) {
        if (front==='') { // 换行
          let fms = this.getSuggestions(this.inputEl.value)
          if (fms.length > 0) {
            const cmd = fms[0].item
            this.onChooseItem(cmd, null)
            return
          }
        }
        this.close()
        return
      }
      if ((!front.startsWith(raw_front))||(cursor.line!=raw_cursor.line)) {
        this.close()
        return
      }
      let query = front.slice(raw_front.length)
      this.inputEl.value = query
      this.inputEl.dispatchEvent(new Event('input'))
    }))
    
  }
  close() {
    this.inputEl.value = ''
    this.inputEl.dispatchEvent(new Event('input'))
    let el = this.modalEl
    if(!el.isPop) return
    el.hidePopover()
    document.body.removeChild(el)
    this.component.unload()
    this.controller.abort()
    this.observer?.disconnect()
    this.reLine = null
    el.isPop = false
    this.plugin.commandModal = null
  }
}

