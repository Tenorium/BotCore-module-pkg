import {getPkgPath} from "./pkg-util.js";
import * as fs from "fs";
import * as path from "path";
import globSync from "glob/sync.js";

/**
 *
 * @param {string} packageName
 * @param {string} scriptPath
 * @param {'uninstall', 'install'} scriptType
 */
export const addScript = function (packageName, scriptPath, scriptType) {
    let scriptFolder = path.join(getPkgPath(), `data/scripts/${packageName}`);

    if (!fs.existsSync(scriptFolder)) {
        fs.mkdirSync(scriptFolder);
    }

    if (!fs.existsSync(scriptPath)) {
        return;
    }

    fs.copyFileSync(scriptPath, `${scriptFolder}/${scriptType}.js`);
}

/**
 *
 * @param {string} packageName
 * @param {ScriptType} scriptType
 */
export const removeScript = function (packageName, scriptType) {
    let scriptFolder = path.join(getPkgPath(), `data/scripts/${packageName}`);

    if (!hasScript(packageName, scriptType)) {
        return;
    }

    fs.rmSync(`${scriptFolder}/${scriptType}.js`);

    if (fs.readdirSync(scriptFolder).length === 0) {
        fs.rmdirSync(scriptFolder);
    }
}

/**
 *
 * @param packageName
 * @param {ScriptType} scriptType
 */
export const hasScript = function (packageName, scriptType) {
    let scriptFolder = path.join(getPkgPath(), `data/scripts/${packageName}`);

    return fs.existsSync(`${scriptFolder}/${scriptType}.js`);
}

/**
 *
 * @param {string} packageName
 * @param {ScriptType} scriptType
 */
export const runScript = async function (packageName, scriptType) {
    let scriptFolder = path.join(getPkgPath(), `data/scripts/${packageName}`);

    if (!hasScript(packageName, scriptType)) {
        return;
    }

    await import(value).run;
}

/**
 * @typedef ScriptType
 * @type {'uninstall'|'install'}
 */