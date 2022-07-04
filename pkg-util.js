import * as fs from "fs";
import {ManifestModel, RepositoryModel, StateModel} from "./pkg-data-models.js";
import * as path from "path";

let running = false;

export const STATUS_DOWNLOADING = 'downloading';
export const STATUS_REMOVING = 'removing';
export const STATUS_INSTALLING = 'installing';
export const STATUS_INSTALLED = 'installed';


/**
 *
 * @return {Object<string,StateModel>}
 */
export const getStates = function () {
    let data = read('state');
    let result = {};

    Object.keys(data).forEach(key => {
        result[key] = new StateModel(data[key]);
    })

    return result;
}

/**
 *
 * @param {Object<string,StateModel>} state
 */
export const setStates = function (state) {
    let data = {};

    Object.keys(state).forEach(key => {
        data[key] = state[key].getData();
    });

    write(data, 'state');
}

/**
 *
 * @param {string} name
 * @param {StateModel|null} state
 */
export const setPackageState = function (name, state) {
    let states = getStates();

    if (state === null) {
        delete states[name];
    } else {
        states[name] = state;
    }
    setStates(states);
}

/**
 *
 * @param {string} name
 * @param {ManifestModel|null} manifest
 */
export const setPackageMetadata = function (name, manifest) {
    let metadata = getMetadata();

    if (manifest === null) {
        delete metadata[name];
    } else {
        metadata[name] = manifest;
    }

    writeMetadata(metadata);
}

/**
 *
 * @return {Object<string,ManifestModel>}
 */
export const getMetadata = function () {
    let data = read('metadata');
    let result = {};

    Object.keys(data).forEach(key => {
        result[key] = new ManifestModel(data[key]);
    })
    return result;
}

/**
 *
 * @param {Object<string,ManifestModel>} metadata
 */
export const writeMetadata = function (metadata) {
    let data = {};

    console.log(metadata);

    Object.keys(metadata).forEach(key => {
        data[key] = metadata[key].getData();
    });

    write(data, 'metadata');
}

/**
 *
 * @return {Object<string,RepositoryModel>}
 */
export const getSources = function () {
    let data = read('sources');
    let result = {};

    Object.keys(data).forEach(key => {
        result[key] = new RepositoryModel(data[key]);
    });

    return result;
}

/**
 *
 * @param {Object<string, RepositoryModel>} sources
 */
export const setSources = function (sources) {
    let data = {};

    Object.keys(sources).forEach(value => {
        data[value] = sources[value].getData();
    })

    write(sources, 'sources');
}

/**
 * @return Lock
 */
export const getLock = function () {
    return JSON.parse(fs.readFileSync(getPath('lock'), {
        encoding: 'utf-8'
    }));
}

/**
 *
 * @param {boolean} state
 */
export const setLock = function (state) {
    let lock = getLock();
    if (lock.locked && !running && state) {
        throw new LockedError();
    }

    running = state;

    fs.writeFileSync(getPath('lock'), JSON.stringify({locked: state}), {
        encoding: 'utf-8'
    });
}

export const getPkgPath = function () {
    return path.dirname(new URL('', import.meta.url).pathname);
}

/**
 *
 * @param {Object<string,*>} data
 * @param {DataType} datatype
 */
const write = function (data, datatype) {
    let lock = getLock();
    if (lock.locked && !running) {
        throw new LockedError();
    }

    fs.writeFileSync(getPath(datatype), JSON.stringify(data), {
        encoding: 'utf-8'
    })
}

/**
 *
 * @param {DataType} datatype
 */
const read = function (datatype) {
    let lock = getLock();
    if (lock.locked && !running) {
        throw new LockedError();
    }

    return JSON.parse(fs.readFileSync(getPath(datatype), {
        encoding: 'utf-8'
    }));
}

/**
 *
 * @param {DataType} datatype
 * @return {string}
 */
const getPath = function (datatype) {
    return new URL(`data/${datatype}.json`, import.meta.url).pathname;
}

export const createDefaultData = function () {
    let metadataPath = getPath('metadata');
    let sourcesPath = getPath('sources');
    let statePath = getPath('state');
    let lockPath = getPath('lock');

    !fs.existsSync(metadataPath) && fs.writeFileSync(metadataPath, '{}');
    !fs.existsSync(sourcesPath) && fs.writeFileSync(sourcesPath, JSON.stringify(
        [
            {
                "url": "https://api.tenorium.net/repo/",
                "branches": ["general", "experimental"],
                "active-branches": ["general"]
            }
        ]
    ));
    !fs.existsSync(statePath) && fs.writeFileSync(statePath, JSON.stringify(
        {
            "core": {
                "status": "installed",
                "oldVersion": null,
                "version": "0.1.0"
            },
            "cli": {
                "status": "installed",
                "oldVersion": null,
                "version": "0.1.0"
            },
            "pkg": {
                "status": "installed",
                "oldVersion": null,
                "version": "0.1.0"
            }
        }
    ));
    !fs.existsSync(lockPath) && fs.writeFileSync(lockPath, JSON.stringify({lock: false}));
}

export class LockedError extends Error {
    constructor() {
        super('LockedError');
        this.name = 'LockedError';
        this.message = 'Pkg locked';
        this.stack = new Error().stack
    }
}

/**
 * @typedef PackageVersion
 * @type Object
 * @property {!('version')} type
 * @property {!string} sha-256
 * @property {!Object<string, string>} dependencies
 * @property {!Object<string, string>} nodeDependencies
 */

/**
 * @typedef PackageVersionAlias
 * @type Object
 * @property {!('alias')} type
 * @property {!string} alias
 */

/**
 * @typedef Manifest
 * @type Object
 * @property {boolean=false} system
 * @property {boolean=false} chainUpdate
 * @property {Object<(!'latest')|string,PackageVersion|PackageVersionAlias>} versions
 */

/**
 * @typedef StateList
 * @type Object<string,State>
 */

/**
 * @typedef State
 * @type Object
 * @property {STATUS_INSTALLED|STATUS_INSTALLING|STATUS_REMOVING,STATUS_DOWNLOADING} status
 * @property {string|null} oldVersion
 * @property {string} version
 */

/**
 * @typedef Repository
 * @type Object
 * @property {string[]} active-branches
 * @property {string[]} branches
 * @property {string} url
 */

/**
 * @typedef Sources
 * @type Repository[]
 */

/**
 * @typedef DataType
 * @type {('metadata'|'sources'|'state'|'lock')}
 */

/**
 * @typedef Lock
 * @type Object
 * @property {boolean} locked
 */
