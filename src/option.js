$(document).ready(function() {
    // 读取配置
    chrome.storage.local.get(["path", "size", "enabled"], (result) => {
        if (result.path) {
            $('#path').val(result.path);
        }
        if (result.size) {
            $('#size').val(result.size);
        }
    });

    $("#size").blur(function() {
        save_options('size');
    });
    $("#path").blur(function() {
        save_options('path');
    });

    function save_options(name) {
        this.tmp = $.trim($('#' + name).val());
        if (!this.tmp) {
            show(name, "不可为空");
            $('#' + name).focus();
            return false;
        } else {
            const updateObj = {};
            updateObj[name] = this.tmp;
            updateObj['enabled'] = 1;
            chrome.storage.local.set(updateObj, () => {
                showEnable();
                show(name, "已保存");
            });
        }
    }

    function show(name, msg) {
        $('#' + name).next('span').html(msg);
        setTimeout(function() {
            $('#' + name).next('span').html('');
        }, 3000);
    }

    function showEnable() {
        chrome.storage.local.get(["enabled"], (result) => {
            const enabled = result.enabled === 1 || result.enabled === "1";
            if (enabled) {
                chrome.action.setBadgeText({ "text": 'en' });
                chrome.action.setBadgeBackgroundColor({ color: '#008800' });
            } else {
                chrome.action.setBadgeText({ "text": 'dis' });
                chrome.action.setBadgeBackgroundColor({ color: '#880000' });
            }
        });
    }
});
