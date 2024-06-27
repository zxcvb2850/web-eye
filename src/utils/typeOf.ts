export const isString = (value: any): value is string => {
    return typeof value === 'string';
}

export const isNumber = (value: any): value is number => {
    return typeof value === 'number';
}

export const isBoolean = (value: any): value is boolean => {
    return typeof value === 'boolean';
}

export const isFunction = (value: any): value is Function => {
    return typeof value === 'function';
}

export const isObject = (value: any): value is Object => {
    return typeof value === 'object' && value !== null;
}

export const isArray = (value: any): value is Array<any> => {
    return Array.isArray(value);
}

export const isUndefined = (value: any): value is undefined => {
    return value === undefined;
}

export const isNull = (value: any): value is null => {
    return value === null;
}

export const isSymbol = (value: any): value is symbol => {
    return typeof value === 'symbol';
}

export const isDate = (value: any): value is Date => {
    return value instanceof Date;
}

export const isRegExp = (value: any): value is RegExp => {
    return value instanceof RegExp;
}

export const isPromise = (value: any): value is Promise<any> => {
    return value instanceof Promise;
}

export const isMap = (value: any): value is Map<any, any> => {
    return value instanceof Map;
}

export const isSet = (value: any): value is Set<any> => {
    return value instanceof Set;
}

export const isWindow = (value: any): value is Window => {
    return value instanceof Window;
}

export const isElement = (value: any): value is Element => {
    return value instanceof Element;
}

// 是否是指定类型
export const isType = (value: any, type: string): boolean => {
    return typeOf(value) === type;
}

// 返回目标是什么类型
export const typeOf = (value: any): string => {
    return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
}