import {UAParser} from "ua-parser-js";
import packageJson from "../../package.json";
import {KingWebEye, Window} from "../types";
import {docScreenW, docScreenH} from './index';

export const _global = getGlobal();
function getGlobal(): Window{
    return window as unknown as Window;
}

export let _support = getSupport();
_support.name = packageJson.name;
_support.version = packageJson.version;
const ua = new UAParser().getResult();
_support.devices = {
    browser: ua.browser.name,
    browserVersion: ua.browser.version,
    os: ua.os.name,
    osVersion: ua.os.version,
    device: ua.device?.model || "PC",
    winScreen: `${_global.screen.width}x${_global.screen.height}`,
    docScreen: `${docScreenW()}x${docScreenH()}`,
    ua: ua.ua,
}

function getSupport(): KingWebEye{
    _global.__king_web_eye__ = (_global.__king_web_eye__ || ({} as KingWebEye));
    return _global.__king_web_eye__;
}
