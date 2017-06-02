define(['vendor/jquery', 'vendor/mousetrap', 'app/common/util/util', 'app/common/util/emitor', 'app/common/config/config', '../config/menu'], function($1, Mousetrap, util, emitor, config, menu) {
	var scratch;
	var projectPath;

	function init() {
		scratch = document.getElementById("ken-scratch");
		emitor.on('app', 'start', onAppStart);

		kenrobot.view.saveProject = saveProject;

		kenrobot.on('app-menu', 'do-action', onMenuAction);
	}

	function onAppStart() {
		kenrobot.trigger("app-menu", "load", menu, "scratch2");
	}

	function onMenuAction(action, extra, li) {
		switch (action) {
			case "new-project":
				scratch.newProject();
				break;
			case "open-project":
				kenrobot.postMessage("app:showOpenDialog", {
					filters: [{name: "sb2", extensions: ["sb2"]}],
					properties: ["openFile"],
				}).then(path => {
					kenrobot.postMessage("app:readFile", path).then(content => {
						projectPath = path;

						scratch.loadProject(content);
						setProjectName(projectPath);
						util.message("打开成功");
					}, err => {
						util.message({
							text: "打开失败",
							type: "error",
						});
					});
				}, err => {
					util.message({
						text: "打开失败",
						type: "error",
					});
				});
				break;
			case "save-project":
				scratch.exportProject();
				break;
			case "save-as-project":
				scratch.exportProject(true);
				break;
			case "undelete":
				scratch.undelete();
				break;
			case "toggle-samll-stage":
				scratch.toggleSmallStage();
				break;
			case "toggle-turbo-mode":
				scratch.toggleTurboMode();
				break;
			case "edit-block-colors":
				scratch.editBlockColors();
				break;
		}
	}

	function saveProject(projectData, saveAs) {
		if(saveAs || !projectPath) {
			kenrobot.postMessage("app:showSaveDialog", {
				filters: [{name: "sb2", extensions: ["sb2"]}],
			}).then(path => {
				doSaveProject(path, projectData, saveAs);
			}, err => {
				util.message({
					text: "保存失败",
					type: "error",
				});
			});
		} else {
			doSaveProject(projectPath, projectData, saveAs);
		}
	}

	function doSaveProject(path, projectData, saveAs) {
		kenrobot.postMessage("app:writeFile", path, projectData).then(_ => {
			projectPath = path;
			saveAs && setProjectName(projectPath);
			util.message("保存成功");
		}, err => {
			util.message({
				text: "保存失败",
				type: "error",
			});
		});
	}

	function setProjectName(projectPath) {
		var names = projectPath.split(/\/|\\/);
		var name = names[names.length - 1];
		name = name.substring(0, name.indexOf("."));
		scratch.setProjectName(name);
	}

	return {
		init: init,
	};
});