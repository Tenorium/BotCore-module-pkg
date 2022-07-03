import axios from "axios";
import {getSources} from "./pkg-util.js";
import {VersionOfPackageNotFound} from "./error/VersionOfPackageNotFound.js";
import {arrayIncludesAll} from "../../utils.js";
import semver from "semver";
import {install} from "./npm-util.js";
import * as core from "./pkg-core.js";
import {VersionOfDependencyNotFound} from "./error/VersionOfDependencyNotFound.js";
import {EOL} from "os";
import * as fs from "fs";
import sha256 from "sha256-file";
import ProgressBar from "progress";
import {ManifestModel} from "./pkg-data-models.js";

const URL_TYPE_INFO = 'info';
const URL_TYPE_DOWNLOAD = 'download';

/**
 *
 * @param {string} name
 * @param {string} version
 * @throws {VersionOfPackageNotFound}
 * @throws {VersionOfDependencyNotFound}
 */
export const downloadPackage = async function (name, version = 'latest') {
    /**
     * @type {{manifest: ManifestModel, url: string}[]}
     */
    let info = await downloadInfo(name);

    let prevRecord = getManifestAndUrlFromInfo(info, version);

    if (typeof prevRecord === 'undefined') {
        throw new VersionOfPackageNotFound();
    }

    let versionName = resolveAlias(prevRecord.manifest, version);
    let currentVersion = prevRecord.manifest.getVersions()[versionName];

    if (Object.keys(currentVersion.getDependencies()).length > 0) {
        for (const dependencyName of Object.keys(currentVersion.getDependencies())) {
            try {
                await core.install(dependencyName, currentVersion.getDependencies()[dependencyName]);
            } catch (e) {
                if (e instanceof VersionOfPackageNotFound) {
                    throw new VersionOfDependencyNotFound(`Failed to resolve ${dependencyName} (v=${currentVersion.dependencies[dependencyName]}) as dependency for ${name}`);
                }
            }
        }
    }

    if (Object.keys(currentVersion.getNodeDependencies()).length > 0) {
        let npmPackages = Object.keys(currentVersion.getNodeDependencies()).map(value => ({
            name: value,
            version: currentVersion.getNodeDependencies()[value]
        }));
        await install(npmPackages);
    }

    let {baseUrl, branch} = parseUrl(prevRecord.url);

    console.log(`Downloading ${name}...`);

    let url = `${baseUrl}/package/${branch}/${name}/download/${versionName}`;
    let filePath = new URL(`data/tmp/${name}-${versionName}.zip`, import.meta.url).pathname;
    let writeStream = fs.createWriteStream(filePath);
    let fileExist = fs.existsSync(filePath);

    if (fileExist) {
        if (checkHashSum(filePath, currentVersion["sha-256"])) {
            return;
        }

        fs.rmSync(filePath);
    }

    const {headers, data} = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    const totalLength = headers['content-length'];

    const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
        width: 40,
        complete: '=',
        incomplete: ' ',
        renderThrottle: 1,
        total: parseInt(totalLength)
    });

    data.on('data', (chunk) => {
        progressBar.tick(chunk.length);
    });

    data.pipe(writeStream);

    return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
    });
}

/**
 *
 * @param {string} name
 * @return {Promise<
 * {
 *   manifest: ManifestModel,
 *   url: string
 * }[]>}
 */
export const downloadInfo = async function (name) {
    let requests = getUrlsForInfo(name).map(value => {
        return axios.get(value).catch(e => e);
    });

    requests = await Promise.all(requests);
    let errors = requests.filter(result => (result instanceof Error));
    requests = requests.filter(result => !(result instanceof Error));

    if (errors.length > 0) {
        for (const error of errors) {
            console.log('Error when processing request to repository.' +EOL+
                `URL: ${error.config.url}` +EOL+
            `Error type: ${error.constructor.name}` +EOL+
            `Error message: ${error.message}`);
        }
    }

    let results = [];
    requests.forEach(value => {
        if (value.status === 200) {
            let manifest = new ManifestModel(value.data);
            results.push({manifest, url: value.config.url})
        }
    })

    return results;
}

/**
 *
 * @param {{
 *   manifest: ManifestModel,
 *   url: string
 * }[]} info
 * @param {string} version
 *
 * @return {{
 *     manifest: ManifestModel,
 *     url: string
 * }}
 */
export const getManifestAndUrlFromInfo = function (info, version) {
    if (info.length === 0) {
        throw new VersionOfPackageNotFound(`Package not found`);
    }

    let prevRecord;

    for (const record of info) {
        if (version !== 'latest' && !Object.keys(record.manifest.getVersions()).includes(version)) {
            continue;
        }

        if (version === 'latest') {
            if (!prevRecord) {
                prevRecord = record;
                continue;
            }

            if (semver.gt(
                resolveAlias(record.manifest, version),
                resolveAlias(prevRecord.manifest, version)
            )) {
                prevRecord = record;
            }
            continue;
        }

        prevRecord = record;
        break;
    }

    return prevRecord;
}
/**
 *
 * @param {!string} name
 * @return {string[]}
 */
const getUrlsForInfo = function (name) {
    let urls = [];
    let sources = getSources();

    Object.keys(sources).forEach(key => {
        let repo = sources[key];
        repo.getActiveBranches().forEach(branch => {
            urls.push(new URL(`package/${branch}/${name}/info`, repo.getUrl()).href)
        })
    })

    return urls;
}

/**
 *
 * @param {string} url
 * @return {ParsedInfoUrl|ParsedDownloadUrl|null}
 */
const parseUrl = function (url) {
    const infoRegexp = /(.*)\/package\/(.*)\/(.*)\/info/;
    const downloadRegexp = /(.*)\/package\/(.*)\/(.*)\/download\/(.*)/

    if (infoRegexp.test(url)) {
        let data = infoRegexp.exec(url);

        return {
            type: URL_TYPE_INFO,
            baseUrl: data[1],
            branch: data[2],
            name: data[3]
        }
    }

    if (downloadRegexp.test(url)) {
        let data = downloadRegexp.exec(url);

        return {
            type: URL_TYPE_DOWNLOAD,
            baseUrl: data[1],
            branch: data[2],
            name: data[3],
            version: data[4]
        }
    }

    return null;
}

/**
 *
 * @param {ManifestModel} manifest
 * @param {string} alias
 */
export const resolveAlias = function (manifest, alias) {
    let versionType = manifest.getVersions()[alias]?.getType() ?? null;

    if (versionType === null) {
        return null;
    }

    if (versionType === 'version') {
        return alias;
    }

    return resolveAlias(manifest, manifest.getVersions()[alias].getAlias());
}

const checkHashSum = function (path, hashsum) {
    let hash = sha256(path);

    return hash === hashsum;
}

/**
 * @typedef ParsedInfoUrl
 * @type Object
 * @property {URL_TYPE_INFO} type
 * @property {string} baseUrl
 * @property {string} branch
 * @property {string} name
 */

/**
 * @typedef {ParsedInfoUrl} ParsedDownloadUrl
 * @type Object
 * @property {string} version
 * @property {URL_TYPE_DOWNLOAD} type
 */