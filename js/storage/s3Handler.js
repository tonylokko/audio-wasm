import { log } from '../utils/logger.js';

let s3Config = null;

export function initializeS3(config) {
    log('Initializing S3 with config:', {
        endpoint: config.endpoint,
        accessKey: config.accessKey,
        bucket: config.bucket
    });

    s3Config = config;

    return new AWS.S3({
        endpoint: config.endpoint,
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
        region: 'us-east-1',
        sslEnabled: true,
        httpOptions: {
            timeout: 30000
        }
    });
}

export async function uploadToS3(blob, filename) {
    const s3 = initializeS3(s3Config);
    const params = {
        Bucket: s3Config.bucket,
        Key: filename,
        Body: blob,
        ContentType: blob.type || 'application/octet-stream'
    };

    return new Promise((resolve, reject) => {
        s3.upload(params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

export async function getSignedUrl(key) {
    const s3 = initializeS3(s3Config);
    const params = {
        Bucket: s3Config.bucket,
        Key: key,
        Expires: 3600
    };

    return new Promise((resolve, reject) => {
        s3.getSignedUrl('getObject', params, (err, url) => {
            if (err) reject(err);
            else resolve(url);
        });
    });
}

export async function deleteRecording(key) {
    const s3 = initializeS3(s3Config);
    const params = {
        Bucket: s3Config.bucket,
        Key: key
    };

    return new Promise((resolve, reject) => {
        s3.deleteObject(params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

export async function listRecordings() {
    const s3 = initializeS3(s3Config);
    const params = {
        Bucket: s3Config.bucket,
        Prefix: 'recordings/',
        MaxKeys: 100
    };

    return new Promise((resolve, reject) => {
        s3.listObjectsV2(params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

export function setS3Config(config) {
    s3Config = config;
}
