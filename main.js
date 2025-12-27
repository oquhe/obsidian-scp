
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
  cmdrShowAlias: true,
  cmdrAliasAsName: false,
  cmdrAutoClose: false,
  commandAlias: {},
}

// 插件主体
exports.default = class ScpPlugin extends Plugin {
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
          console.log('滚动')
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
    this.addCommand({
      id: 'scp-cs',
      name: '测试',
      editorCallback: (editor, view) => {
        let obj = scpViewPlugin
        console.log(obj)
        suggestAllMembers(this.app, obj)
      }
    })
    
    // 布局加载完成时
    this.app.workspace.onLayoutReady(() => {
      
    })
    
    
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
      .setDesc(`命令面板位于光标上方时从下往上放置选项，默认：${DEFAULT_SETTINGS.cmdrTurn}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrTurn)
        .onChange(async (value) => {
          this.plugin.settings.cmdrTurn = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('显示别名')
      .setDesc(`存在别名时，别名作为描述显示在命令面板上，默认：${DEFAULT_SETTINGS.cmdrShowAlias}`)
      .addToggle(cp => cp
        .setValue(this.plugin.settings.cmdrShowAlias)
        .onChange(async (value) => {
          this.plugin.settings.cmdrShowAlias = value
          this.plugin.saveSettings()
        })
      )
    new Setting(containerEl)
      .setName('别名替换名称')
      .setDesc(`存在别名时，别名替换名称显示在命令面板上，默认：${DEFAULT_SETTINGS.cmdrAliasAsName}`)
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
    containerEl.createEl('h2', {text: '命令别名'})
    new Setting(containerEl)
      .setDesc(this.createDF(`<span>
先添加命令，添加后才能编辑别名。<br>
别名用于在简单命令面板作为描述或筛选文本。<br>
如果想同时使用原名和别名，应在别名中放入原名。<br>
不能有空格，推荐用“|”、“-”或“丨(gun)”等作为分割符。<br>
例：save|保存当前文件<br>
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
                value = value.replace(/\s+/g, '')
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
            value = value.replace(/\s+/g, '')
            text.inputEl.value = value
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
滚动容器 .scp.scroller<br>
单行配置项 .scp.setting-inline<bt>
      </span>`))
      .then(cp => cp.descEl.style.userSelect='auto')
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
    return super.getSuggestions(arr[0])
  }
  onChooseItem(command, evt) {
    this.component.unload()
    this.controller.abort()
    this.observer?.disconnect()
    if (this.reLine) this.reLine()
    command.q_args = this.q_args.join(' ')
    this.app.commands.executeCommand(command)
    if (!command.name.includes('重复上一个命令')) {
      window.sessionStorage.setItem('LastCommand', command.id)
    }
    command.q_args = null
    this.close()
  }
  onNoSuggestion() {
    super.onNoSuggestion()
    if (this.plugin.settings.cmdrAutoClose) {
      this.close()
    }
  }
  renderSuggestion(fm, el) {
    let strs = []
    let text = this.getItemText(fm.item)
    let cur = 0
    fm.match.matches.forEach(match => {
      strs.push(text.slice(cur, match[0]))
      strs.push(text.slice(...match))
      cur = match[1]
    })
    strs.push(text.slice(cur))
    let line
    if ((fm.item.id in this.alias) && !this.plugin.settings.cmdrAliasAsName) {
      el.createEl('div', {text: fm.item.name})
      if (!this.plugin.settings.cmdrShowAlias) {
        return
      }
      line = el.createEl('div')
      line.style['font-size'] = 'var(--font-ui-smaller)'
      line.style['color'] = 'var(--text-muted)'
    } else {
      line = el.createEl('div')
    }
    for(let i=0; i<strs.length-1; i+=2) {
      line.createEl('span', {text: strs[i]})
      let keyEl = line.createEl('span', {text: strs[i+1]})
      keyEl.style.color = 'var(--text-accent)'
    }
    line.createEl('span', {text: strs.at(-1)})
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

