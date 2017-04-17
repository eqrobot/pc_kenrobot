define(function() {
	var menu = [{
		id: "file",
		placeholder: "文件",
	}, {
		id: "edit",
		placeholder: "编辑",
	}, {
		id: "example",
		placeholder: "案例",
	}, {
		id: "options",
		placeholder: "选项",
		menu: [{
			id: "fullscreen",
			text: "全屏",
			action: "fullscreen",
		}, {
			text: "语言",
			action: "language",
		}, {
			text: "主题",
			action: "theme",
		}, "_", {
			text: "设置",
			action: "setting",
		}, "_", {
			placeholder: "切换",
			arrow: true,
			menuCls: "switches",
			menu: [{
				text: "教育版",
				action: "switch",
				cls: "check",
				extra: {
					type: "edu"
				},
			}, {
				text: "开发版",
				action: "switch",
				cls: "check",
				extra: {
					type: "ide"
				},
			}, {
				text: "scratch版",
				action: "switch",
				cls: "check",
				extra: {
					type: "scratch"
				},
			}]
		}]
	}, {
		id: "help",
		placeholder: "帮助",
		menu: [{
			text: "Arduino驱动下载",
			action: "download-arduino-driver",
		}, "_", {
			text: "检查更新",
			action: "check-update",
		}, {
			text: "啃萝卜官网",
			action: "visit-kenrobot",
		}, {
			text: "Arduino论坛",
			action: "visit-arduino",
		}, "_", {
			text: "建议反馈",
			action: "suggestion",
		}, {
			text: "关于啃萝卜",
			action: "about-kenrobot",
		}]
	}];

	return menu;
});