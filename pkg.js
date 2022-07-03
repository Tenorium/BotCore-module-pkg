import splitargs from "splitargs";
import ModuleManager from "../../core/ModuleManager/index.js";
import AbstractModule from "../../core/abstractModule.js";
import {Worker} from "worker_threads";
import {workerData} from "node:worker_threads";
import {getPkgPath} from "./pkg-util.js";
import {listInstalledPackages} from "./pkg-core.js";
import path from "path";

/**
 *
 * @param {'install'|'remove'} command
 * @param {ThreadExitCallback} onExit
 * @param args
 */
const runThread = function(command, onExit, ...args) {
    let workerCode = "("+(async() => {
        const {workerData: {basePath, pkgPath, command, args}} = require('node:worker_threads');
        const path = require("path");

        global.basePath = basePath;

        let core = await import(path.join(pkgPath, 'pkg-core.js'));

        switch (command) {
            case "install":
                await core.install(args[0], args[1] ?? undefined);
                console.log('Finished!');
                break;
            case "remove":
                await core.remove(args[0]);
                break;
        }
    }).toString() + ")()";

    let worker = new Worker(
        workerCode,
        {
            eval: true,
            workerData: {
                basePath,
                pkgPath: getPkgPath(),
                command,
                args
            }
        });

    worker.on("message", function (value) {
        console.log(value);
    });

    worker.on('exit', onExit);
}

export default class PKG extends AbstractModule {
    /**
     * @todo help command
     */
    load() {
        /**
         *
         * @type {CliModule}
         */
        let cli = ModuleManager.getModule('cli');

        cli.addCommand(
            'pkg',
            function (input, rl) {
                let args = splitargs(input);

                if (args[0] !== 'pkg') {
                    return;
                }

                let exitCallback = exitCode => {
                    console.log("exit");
                    cli.resumeCli();
                };

                switch (args[1]) {
                    case 'remove':
                        cli.pauseCli();
                        runThread('remove', exitCallback, args[2]);
                        break;
                    case 'install':
                        cli.pauseCli();
                        runThread('install', exitCallback, args[2], args[3]);
                        break;
                    case 'list-installed':
                        listInstalledPackages();
                        break;
                    // case 'help':
                    //     console.log('')
                    //     break;
                }
            },
            function (line) {

                let args = splitargs(line);
                if (args[0] !== 'pkg') {
                    if ('pkg'.startsWith(line)) {
                        return ['pkg'];
                    }
                    return null;
                }

                let subcommands = ['remove', 'install', 'list', /*'help'*/];
                let filtered = subcommands.filter(value => value.startsWith(args[1]));
                let arr = filtered;
                if (!filtered.length) {
                    arr = subcommands;
                }

                return arr.map(value => 'pkg ' + value);
            }
        );
    }

    unload() {

    }
}

/**
 * @callback ThreadExitCallback
 * @param {integer} exitCode
 */