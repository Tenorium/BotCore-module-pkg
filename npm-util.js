import {spawn} from "child_process";

/**
 * Install packages
 * @param {PackageRecord[]} packages
 * @return {Promise<unknown>}
 */
export const install = function (packages) {
    let command = 'npm';
    let args = ['install']
    packages.forEach(packageObject => {
        args.push(`${packageObject.name}@${packageObject.version}`)
    });

    return runNpmCommand(command, args);
}

/**
 *
 * @param {PackageRecord[]} packages
 */
export const uninstall = function (packages) {
    let command = 'npm';
    let args = ['uninstall']
    packages.forEach(packageObject => {
        args.push(`${packageObject.name}@${packageObject.version}`)
    });

    return runNpmCommand(command, args);
}

/**
 *
 * @param {string} command
 * @param {string[]} args
 * @return {Promise<unknown>}
 */
const runNpmCommand = function (command, args) {
    return new Promise((resolve, reject) => {
        let npmProcess = spawn(command, args, {
            cwd: basePath
        });
        npmProcess.stdout.setEncoding('utf-8');
        npmProcess.stdout.on('data', function (data) {
            console.log(data);
        });

        npmProcess.stderr.setEncoding('utf-8');
        npmProcess.stderr.on('data', function (data) {
            console.error(data);
        });

        npmProcess.on('close', code => {
            if (code !== 0) {
                reject();
            }
            resolve();
        });
    })
}

/**
 * @typedef PackageRecord
 * @type Object
 * @property {string} name
 * @property {string} version
 */