"use strict";$(function(){function e(e){$(this).siblings(".file").replaceWith('<input class="file" type="file" accept=".sb2" />').on("change",n).trigger("click")}function n(e){var n=this.files[0],r=new FileReader;r.addEventListener("load",function(e){l.loadProject(c(r.result))}),r.readAsArrayBuffer(n)}function r(e){l.exportProject()}function o(){return s.addClass("loaded"),setTimeout(function(e){s.find(".loader").remove()},1e3),a()||(l=s.find(".ken-scratch")[0],s.find(".toolbar").on("click",".open",e).on("click",".save",r)),!0}function t(e,n){download(f(e),"project-"+d(6)+".sb2")}function i(e){if(!a()){var n=e.kenrobot||(e.kenrobot={});(n.view||(n.view={})).saveProject=t}e.JSeditorReady=o}function a(){var e=top.kenrobot;return!!(e&&e.postMessage&&e.view)}function c(e){for(var n="",r=new Uint8Array(e),o=r.byteLength,t=0;t<o;t++)n+=String.fromCharCode(r[t]);return window.btoa(n)}function f(e){for(var n=window.atob(e),r=n.length,o=new Uint8Array(r),t=0;t<r;t++)o[t]=n.charCodeAt(t);return o.buffer}function d(e,n){var r,o="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),t=[];if(n=n||o.length,e)for(r=0;r<e;r++)t[r]=o[0|Math.random()*n];else{var i;for(t[8]=t[13]=t[18]=t[23]="-",t[14]="4",r=0;r<36;r++)t[r]||(i=0|16*Math.random(),t[r]=o[19==r?3&i|8:i])}return t.join("")}var s,l;!function(){var e=$(".main");s=$(".player"),a()&&(e.find(".header").remove(),s.find(".toolbar").remove()),e.addClass("active"),i(window)}()});