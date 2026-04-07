declare module 'slice-js' {
    declare async function slice(fileName: string, name: string, tester: (...args:any[])=>any);
}

export = slice;