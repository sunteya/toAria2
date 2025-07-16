import { decode64, strAnsi2Unicode, Decryption } from './decode.js';

// 全局配置变量 - 保持原来的逻辑结构
let enabled = 0;
let size = 0;
let path = "";
let token = null;

// 初始化配置 - 在文件加载时读取
function initConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["enabled", "size", "path"], (result) => {
            enabled = result.enabled === 1 || result.enabled === "1" ? 1 : 0;
            size = (result.size || 10) * 1024 * 1024;
            path = result.path || "";
            
            // 处理 token
            const reg = /\/\/token:([\w-]+)@[\w.-]+(:\d+)?\//;
            if (reg.test(path)) {
                const tokenResult = reg.exec(path);
                token = tokenResult[1];
                path = path.replace("token:" + token + "@", "");
            } else {
                token = null;
            }
            
            showEnable();
            resolve();
        });
    });
}

function changeEnable(tab) {
    if (enabled == 1) {
        chrome.action.setBadgeText({ "text": 'dis' });
        chrome.action.setBadgeBackgroundColor({ color: '#880000' });
        enabled = 0;
        chrome.storage.local.set({ enabled: 0 });
    } else {
        chrome.action.setBadgeText({ "text": 'en' });
        chrome.action.setBadgeBackgroundColor({ color: '#008800' });
        enabled = 1;
        chrome.storage.local.set({ enabled: 1 });
    }
}

function showEnable() {
    if (enabled == 1) {
        chrome.action.setBadgeText({ "text": 'en' });
        chrome.action.setBadgeBackgroundColor({ color: '#008800' });
    } else {
        chrome.action.setBadgeText({ "text": 'dis' });
        chrome.action.setBadgeBackgroundColor({ color: '#880000' });
    }
}

async function add(down) {
    //console.debug(down);
    if (checkconfig() === 0) {
        return 0;
    }
    if (enabled == 0) {
        return 0;
    }
    if (Math.abs(down.fileSize) > size) {
        const ifpostback = await send(down);
        if (ifpostback == "base64_error") {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icon.png",
                title: "失败！",
                message: "添加任务至 aria2 出错！"
            });
        } else {
            chrome.downloads.cancel(down.id, function(s) {});
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icon.png",
                title: "成功！",
                message: "下载已送往aria2，请前往确认"
            });
        }
    }
}

function checkconfig() {
    if (!path || !size) {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "注意！",
            message: "插件尚未配置！"
        });
        chrome.tabs.create({ "url": "options.html" }, function(s) {});
        chrome.storage.local.set({ enabled: 0 }, () => {
            enabled = 0;
            showEnable();
        });
        return 0;
    } else {
        return 1;
    }
}

async function send(down) {
    const aria2_obj = combination(down);
    return await postaria2obj(aria2_obj);
}

function postaria2obj(addobj) {
    let url = path + "?tm=" + Date.now();
    let headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    };
    
    const ifregurl = aria2url_reg(path);
    if (ifregurl) {
        headers["Authorization"] = "Basic " + btoa(ifregurl);
    }
    
    return fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(addobj)
    }).then(response => {
        if (response.ok) {
            return "ok";
        } else {
            return "base64_error";
        }
    }).catch(() => {
        return "base64_error";
    });
}

function aria2url_reg(url) {
    if (url.split("@")[0] == url) {
        return null;
    }
    const match = url.split("@")[0].match(/^(http:\/\/|https:\/\/)?(.*)/);
    return match ? match[2] : null;
}

function combination(down) {
    const obj = { "header": "Referer: " + (down.referrer || "") };
    if (down.filename != '') {
        obj["out"] = decodeURIComponent(down.filename);
    }
    const params = [
        [down.finalUrl], obj
    ];
    if (!!token) {
        params.unshift("token:" + token);
    }
    return [{
        "jsonrpc": "2.0",
        "method": "aria2.addUri",
        "id": Date.now().toString(),
        "params": params
    }];
}

async function rightadd(info, tab) {
    if (checkconfig() === 0) {
        return 0;
    }
    const down = { filename: '' };
    down.referrer = info.pageUrl;
    const urlma = /^\s*(http:|https:|ftp:|magnet:|thunder:|flashget:|qqdl:\?)/;
    let errorcode = 0;
    let errnum = 0;
    let len = 0;
    let downarr = [];
    
    if (info.selectionText) {
        downarr = info.selectionText.match(/(http:|https:|ftp:|magnet:|thunder:|flashget:|qqdl:\?)\S+/g) || [];
        len = downarr.length;
    }
    
    if (urlma.test(info.linkUrl)) {
        down.finalUrl = Decryption(info.linkUrl);
        len = 1;
        if (await send(down) === "base64_error") {
            errorcode = 1;
        }
    } else if (len >= 1) {
        for (let j = 0; j < len; j++) {
            down.finalUrl = Decryption(downarr[j]);
            if (await send(down) === "base64_error") {
                errorcode = 2;
                errnum++;
            }
        }
        if (errnum == len) {
            errorcode = 1;
        }
    } else {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "失败！",
            message: "未发现可以下载的链接地址！"
        });
        return 0;
    }
    
    if (errorcode == 1) {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "失败！",
            message: "添加任务至 aria2 出错！"
        });
    } else if (errorcode == 2) {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "失败！",
            message: "添加" + len + "个任务至 aria2 中有" + errnum + "个出错！"
        });
    } else {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "成功！",
            message: len + "个下载已送往aria2，请前往确认"
        });
    }
}

// 初始化配置，然后注册事件监听器
initConfig().then(() => {
    chrome.downloads.onDeterminingFilename.addListener(add);
    chrome.contextMenus.create({
        id: "addToAria2",
        title: "添加到Aria2",
        contexts: ["selection", "link"]
    });
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "addToAria2") {
            rightadd(info, tab);
        }
    });
    chrome.action.onClicked.addListener(changeEnable);
});
