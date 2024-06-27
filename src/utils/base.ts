import {_global} from "../utils";

// 获取当前时间
export const getTimestamp = (): number => {
    return new Date().getTime()
}

// 分割
export const localStorageKey = "_king_web_eye_router_";
const splitStr = "|||";

// 设置缓存数据
export function setCacheData(key: string, value: string, time = getTimestamp()): void{
    const data = `${value}${splitStr}${time}`;
    _global.localStorage.setItem(key, data);
}

// 获取缓存数据
export function getCacheData(key: string): {value: string | null, time: number} {
    const data = _global.localStorage.getItem(key);
    if(data && data.indexOf(splitStr) > -1){
        const [value, time] = data.split(splitStr);
        return {value, time: Number(time)};
    }

    return {value: data, time: 0};
}