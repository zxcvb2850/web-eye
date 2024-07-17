import packageJson from "../../package.json";
import {webEyeSDK, Window} from "../types";
import {docScreenW, docScreenH} from './index';

export const _global = getGlobal();
function getGlobal(): Window{
    return window as unknown as Window;
}

export let _support = getSupport();
_support.name = packageJson.name;
_support.version = packageJson.version;
_support.devices = {
    winScreen: `${_global.screen.width}x${_global.screen.height}`,
    docScreen: `${docScreenW()}x${docScreenH()}`,
}

function getSupport(): webEyeSDK{
    _global.__web_eye_sdk__ = (_global.__web_eye_sdk__ || ({} as webEyeSDK));
    return _global.__web_eye_sdk__;
}
