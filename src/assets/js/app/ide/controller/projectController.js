define(['vendor/jquery', 'app/common/util/util', 'app/common/util/emitor', 'app/common/util/progress', '../view/code'], function($1, util, emitor, progress, code) {
	var currentProject;
	var savePath;

	function init() {
		emitor.on('app', 'start', onAppStart)
		    .on('project', 'new', onProjectNew)
			.on('project', 'open', onProjectOpen)
			.on('project', 'save', onProjectSave)
			.on('project', 'upload', onProjectUpload)
			.on('project', 'check', onProjectCheck)
			.on('code', 'copy', onCodeCopy);

		kenrobot.on("project", "open", onProjectOpen);
	}

	function openProject(projectInfo) {
		currentProject && (currentProject.project_data = getProjectData());
		currentProject = projectInfo;

		var projectData = projectInfo.project_data;
		code.setData(projectData.code);
	}

	function onAppStart() {
		openProject(getDefaultProject());
	}

	function onProjectNew() {
		savePath = null;
		openProject(getDefaultProject());
		util.message("新建成功");
	}

	function onProjectOpen(projectInfo) {
		if(projectInfo) {
			openProject(projectInfo);
			util.message({
				text: "打开成功",
				type: "success"
			});
		} else {
			kenrobot.postMessage("app:openProject").then(function(result) {
				savePath = result.path;
				openProject(result.projectInfo);
				util.message({
					text: "打开成功",
					type: "success"
				});
			}, function(err) {
				util.message({
					text: "打开失败",
					type: "error",
				});
			});
		}
	}

	function onProjectSave(saveAs) {
		var projectInfo = getCurrentProject();
		projectInfo.project_data = getProjectData();
		saveAs = saveAs == true ? true : savePath == null;

		doProjectSave(projectInfo, saveAs).then(function() {
			util.message({
				text: "保存成功",
				type: "success"
			});
		}, function() {
			util.message({
				text: "保存失败",
				type: "warning",
			});
		});
	}

	function onProjectUpload() {
		var projectInfo = getCurrentProject();
		projectInfo.project_data = getProjectData();
		var saveAs = savePath == null;
		var boardData = {type: "uno", fqbn: "arduino:avr:uno:cpu=atmega32"}

		doProjectSave(projectInfo, saveAs).then(function() {
			emitor.trigger("ui", "lock", "build", true);
			util.message("保存成功，开始编译");
			kenrobot.postMessage("app:buildProject", savePath, {type: boardData.type, fqbn: boardData.fqbn}).then(function(target) {
				util.message("编译成功，正在上传");
				setTimeout(function() {
					var uploadProgressHelper = {};
					kenrobot.postMessage("app:upload", target, {type: boardData.type}).then(function() {
						emitor.trigger("ui", "lock", "build", false);
						util.message({
							text: "上传成功",
							type: "success"
						});
					}, function(err) {
						if(err.status == "SELECT_PORT") {
							kenrobot.trigger("port", "show", {
								ports: err.ports,
								callback: function(port) {
									if(!port) {
										emitor.trigger("ui", "lock", "build", false);
										util.message("上传取消");
										return
									}
									util.message("正在上传");
									uploadProgressHelper = {}
									kenrobot.postMessage("app:upload2", target, port.comName, {type: boardData.type}).then(function() {
										emitor.trigger("ui", "lock", "build", false);
										util.message({
											text: "上传成功",
											type: "success"
										});
									}, function(err1) {
										emitor.trigger("ui", "lock", "build", false);
										showErrorConfirm("上传失败", err1);
									}, function(progressData) {
										emitor.trigger("progress", "upload", progress.matchUploadProgress(uploadProgressHelper, progressData.data, boardData.type), "upload");
									});
								}
							});
						} else if(err.status == "NOT_FOUND_PORT") {
							emitor.trigger("ui", "lock", "build", false);
							kenrobot.trigger("no-arduino", "show");
						} else {
							emitor.trigger("ui", "lock", "build", false);
							showErrorConfirm("上传失败", err);
						}
					}, function(progressData) {
						emitor.trigger("progress", "upload", progress.matchUploadProgress(uploadProgressHelper, progressData.data, boardData.type), "upload");
					});
				}, 2000);
			}, function(err) {
				emitor.trigger("ui", "lock", "build", false);
				showErrorConfirm("编译失败", err);
			}, function(progressData) {
				emitor.trigger("progress", "upload", progress.matchBuildProgress(progressData.data), "build");
			});
		}, function() {
			util.message({
				text: "保存失败",
				type: "warning",
			});
		});
	}

	function onProjectCheck() {
		var projectInfo = getCurrentProject();
		projectInfo.project_data = getProjectData();
		var boardData = {type: "uno", fqbn: "arduino:avr:uno:cpu=atmega32"}

		util.message("正在验证，请稍候");
		doProjectSave(projectInfo, true, true).then(function(path) {
			emitor.trigger("ui", "lock", "build", true);
			kenrobot.postMessage("app:buildProject", path, {type: boardData.type, fqbn: boardData.fqbn}).then(function() {
				emitor.trigger("ui", "lock", "build", false);
				util.message("验证成功");
			}, function(err) {
				emitor.trigger("ui", "lock", "build", false);
				showErrorConfirm("验证失败", err);
			}, function(progressData) {
				emitor.trigger("progress", "check", progress.matchBuildProgress(progressData.data))
			});
		}, function() {
			util.message({
				text: "保存失败",
				type: "warning",
			});
		});
	}

	function showErrorConfirm(message, err) {
		util.confirm({
			text: message,
			cancelLabel: "确定",
			confirmLabel: "查看日志",
			onConfirm: function() {
				kenrobot.delayTrigger(500, "error", "show", {output: [message, err]});
			}
		});
	}

	function doProjectSave(projectInfo, saveAs, isTemp) {
		var promise = $.Deferred();

		kenrobot.postMessage("app:saveProject", saveAs ? null : savePath, projectInfo, isTemp).then(function(result) {
			projectInfo.updated_at = result.updated_at;
			if(saveAs && !isTemp) {
				savePath = result.path;
				projectInfo.project_name = result.project_name;
			}
			promise.resolve(result.path);
		}, function() {
			promise.reject();
		});

		return promise;
	}

	function onCodeCopy() {
		kenrobot.postMessage("app:copy", code.getData(), "code").then(function() {
			util.message("复制成功");
		}, function(err) {
			util.message({
				text: "复制失败",
				type: "warning"
			});
		})
	}

	function getProjectData() {
		return {
			hardware: null,
			software: null,
			code: code.getData(),
		};
	}

	function getCurrentProject() {
		return currentProject;
	}

	function getDefaultProject() {
		var now = new Date();
		return {
			project_name: "我的项目",
			project_data: {},
			created_at: now,
			updated_at: now,
		};
	}

	function convertProject(projectInfo) {
		if (typeof projectInfo.project_data == "string") {
			try {
				projectInfo.project_data = JSON.parse(projectInfo.project_data);
			} catch (ex) {
				projectInfo.project_data = {};
			}
		}

		if (typeof projectInfo.created_at == "string") {
			projectInfo.created_at = new Date(projectInfo.created_at);
		}

		if (typeof projectInfo.updated_at == "string") {
			projectInfo.updated_at = new Date(projectInfo.updated_at);
		}

		return projectInfo;
	}

	return {
		init: init,
	}
});