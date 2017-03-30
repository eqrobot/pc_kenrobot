define(function() {
	var configs = {
		//基本配置
		base: {
			url: {
				kenrobot: "http://www.kenrobot.com",
				arduino: "http://www.arduino.cn",
				arduinoDriver: "http://ide.kenrobot.com/download/arduino-driver-x{BIT}.7z",
				support: "http://www.arduino.cn/forum-101-1.html",
				about: "http://www.kenrobot.com/index.php?app=square&mod=Index&act=help",
				checkUpdate: "http://www.kenrobot.com/?app=public&mod=Download&act=checkupdate"
			}
		},
		//调试模式
		debug: {
			debug: true,
		}
	}

	function extend(target) {
		var sources = Array.from(arguments).slice(1);
		sources.forEach(function(source) {
			for (var prop in source) {
				target[prop] = source[prop];
			}
		});
		return target;
	}

	return extend({}, configs.base, configs.debug.debug ? configs.debug : {});
});