"use strict";!function(e,r){var t=require("path"),o=process.defaultApp||/[\\/]electron-prebuilt[\\/]/.test(process.execPath)||/[\\/]electron[\\/]/.test(process.execPath);module.paths.push(o?t.resolve("app","node_modules"):t.resolve(__dirname,"..","..","app.asar","node_modules"));var n=require("electron"),i=n.ipcRenderer,a=n.webFrame,s=require("q"),c=[],l={},u=0;function p(e,r,t){var o=l[r];if(o){var n;"notify"==t?n=o.notify:(delete l[r],n=t?o.resolve:o.reject);for(var i=arguments.length,a=Array(i>3?i-3:0),s=3;s<i;s++)a[s-3]=arguments[s];n.apply(this,a)}}a.setZoomFactor(1),a.setVisualZoomLevelLimits(1,1),a.setLayoutZoomLevelLimits(0,0);var f={},h={};function v(e,r){return e+"_"+r}function d(e,r){var t=v(e,r),o=f[t];if(!o)return this;o=o.concat().sort(function(e,r){return r.options.priority-e.options.priority});for(var n=arguments.length,i=Array(n>2?n-2:0),a=2;a<n;a++)i[a-2]=arguments[a];for(var s=0;s<o.length;s++){o[s].callback.apply(this,i)}return this}var y={};r.postMessage=function(e){c.indexOf(e)<0&&(i.on(e,p),c.push(e));var r=s.defer();l[++u]=r;for(var t=arguments.length,o=Array(t>1?t-1:0),n=1;n<t;n++)o[n-1]=arguments[n];return i.send.apply(this,[e,u].concat(o)),r.promise},r.listenMessage=function(e,r){var t=this;return i.on(e,function(e,o){r.apply(t,o)}),this},r.on=function(e,r,t,o){(o=o||{}).priority=o.priority||0,o.canReset=!1!==o.canReset;var n=v(e,r),i=f[n];return i||(i=[],f[n]=i),i.push({callback:t,options:o}),this},r.off=function(e,r,t){var o=v(e,r),n=f[o];if(!n)return this;for(var i=0;i<n.length;i++)if(n[i].callback==t){n.splice(i,1);break}return this},r.trigger=d,r.delayTrigger=function(e,r,t){for(var o=arguments.length,n=Array(o>3?o-3:0),i=3;i<o;i++)n[i-3]=arguments[i];var a=this,s=v(r,t),c=h[s];return c&&clearTimeout(c),c=setTimeout(function(){delete h[s],d.apply(a,[r,t].concat(n))},e),h[s]=c,this},r.reset=function(){for(var e in f){for(var r=f[e],t=r.length-1;t>=0;t--)r[t].options.canReset&&r.splice(t,1);0==r.length&&delete f[e]}for(var e in h){var o=h[e];o&&clearTimeout(o),delete h[e]}return h={},Object.keys(y).forEach(function(e){delete y[e]}),this},r.view=y,r.isPC=!0}(window,window.kenrobot||(window.kenrobot={}));