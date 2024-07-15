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
_support.devices = {
    winScreen: `${_global.screen.width}x${_global.screen.height}`,
    docScreen: `${docScreenW()}x${docScreenH()}`,
}

function getSupport(): KingWebEye{
    _global.__king_web_eye__ = (_global.__king_web_eye__ || ({} as KingWebEye));
    return _global.__king_web_eye__;
}
