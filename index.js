const AWS = require('aws-sdk');
const commandLineArgs = require('command-line-args');


console.log('program started.');
const optionDefinitions = [
  {
    name: 'profile',
    type: String
  },
  {
    name: 'bucket',
    type: String
  },
  {
    name: 'prefix',
    type: String
  },
  {
    name: 'versions',
    type: Boolean
  }
];
const options = commandLineArgs(optionDefinitions);
if (!options.hasOwnProperty('profile')) {
  options['profile'] = 'default';
}
if (!options.hasOwnProperty('bucket')) {
  console.error('specify bucket.');
  process.exit(1);
}
if (!options.hasOwnProperty('prefix')) {
  console.error('specify prefix.');
  process.exit(1);
}
if (!options.hasOwnProperty('versions')) {
  options['versions'] = false;
}
console.log(options);

AWS.config.credentials = new AWS.SharedIniFileCredentials({
  profile: options['profile']
});
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

const bucket = options.bucket;
const prefix = options.prefix;

const maxKeys = 1000;
let targetObjects = [];
let nextContinuationToken = '';
let nextKeyMarker = '';
let nextVersionIdMarker = '';
let totalCount = 0;


const listObjects = () => {
  return new Promise((resolve, reject) => {

    const subtask = () => {
      return new Promise((resolve, reject) => {
        console.log('-- begin listObjects');
        if (nextContinuationToken === null) {  // done this task when nextContinuationToken is null.
          resolve();
          return;
        }
        if (targetObjects.length >= 10000) {
          console.log('---- queued targetObjects full. idling');
          // idle 10 seconds.
          const id = setInterval(() => {
            clearInterval(id);
            subtask()
            .then(resolve)
            .catch(reject);
          }, 1000 * 10);
          return;
        }
        const params = {
          Bucket: bucket, 
          Prefix: prefix,
          MaxKeys: maxKeys
        };
        if (nextContinuationToken !== '') {
          params['ContinuationToken'] = nextContinuationToken;
        }
        s3.listObjectsV2(params, function(err, data) {
          if (err) {
            console.error(err, err.stack);
            reject();
            return;
          }
          console.log(`-- end listObjects, Count=${data.Contents.length}. NextContinuationToken=${data.NextContinuationToken}`);
          if (data.Contents.length <= 0) {
            nextContinuationToken = null;
            resolve();
            return;
          }
          targetObjects = targetObjects.concat(data.Contents.map((object) => {
            return {
              Key: object.Key
            };
          }));
          console.log(`---- queued targetObjects length=${targetObjects.length}`);
          if (!data.NextContinuationToken) {
            nextContinuationToken = null;
          } else {
            nextContinuationToken = data.NextContinuationToken;
          }
          subtask()
          .then(resolve)
          .catch(reject);
        });
      });
    }
    
    subtask()  // begin first task.
    .then(resolve)  // resolved when all task done.
    .catch(reject);
  
  });
}

const listObjectVersions = () => {
  return new Promise((resolve, reject) => {

    const subtask = () => {
      return new Promise((resolve, reject) => {
        console.log('-- begin listObjectVersions');
        if (nextVersionIdMarker === null) {  // done this task when nextVersionIdMarker is null.
          resolve();
          return;
        }
        if (targetObjects.length >= 10000) {
          console.log('---- queued targetObjects full. idling');
          // idle 10 seconds.
          const id = setInterval(() => {
            clearInterval(id);
            subtask()
            .then(resolve)
            .catch(reject);
          }, 1000 * 10);
          return;
        }
        const params = {
          Bucket: bucket, 
          Prefix: prefix,
          MaxKeys: maxKeys
        };
        if (nextVersionIdMarker !== '') {
          params['KeyMarker'] = nextKeyMarker;
          params['VersionIdMarker'] = nextVersionIdMarker;
        }
        s3.listObjectVersions(params, function(err, data) {
          if (err) {
            console.error(err, err.stack);
            reject();
          }
          else {
            console.log(`-- end listObjectVersions, Count=${data.Versions.length}. NextVersionIdMarker=${data.NextVersionIdMarker}`);
            if (data.Versions.length <= 0) {
              nextKeyMarker = null;
              nextVersionIdMarker = null;
              resolve();
              return;
            }
            targetObjects = targetObjects.concat(data.Versions.map((object) => {
              return {
                versionId: object.VersionId,
                lastModified: object.LastModified
              };
            }));
            console.log(`---- queued targetObjects length=${targetObjects.length}`);
            if (!data.NextVersionIdMarker) {
              nextKeyMarker = null;
              nextVersionIdMarker = null;
            } else {
              nextKeyMarker = data.NextKeyMarker;
              nextVersionIdMarker = data.NextVersionIdMarker;
            }
            subtask()
            .then(resolve)
            .catch(reject);
          }
        });
      });
    }
    
    subtask()  // begin first task.
    .then(resolve)  // resolved when all task done.
    .catch(reject);
  
  });
}

const deleteObjects = () => {
  return new Promise((resolve, reject) => {

    const subtask = () => {
      return new Promise((resolve, reject) => {
        console.log('-- begin deleteObjects');
        if (nextContinuationToken === null
            && nextVersionIdMarker === null
            && targetObjects.length <= 0) {
          console.log('delete completed');
          resolve();
          return;
        }
        if (targetObjects.length <= 0) {
          console.log('---- queued targetObjects empty');
          // idle some seconds.
          const id = setInterval(() => {
            clearInterval(id);
            subtask()
              .then(resolve)
              .catch(reject);
          }, 1000 * 2);
          return;
        }
        const objects = targetObjects.splice(0, 1000);
        const params = {
          Bucket: bucket, 
          Delete: {
            Objects: objects.map((object) => {
              if (!object.hasOwnProperty('VersionId')) {
                return {
                  Key: object.Key
                };
              }
              return {
                Key: object.Key,
                VersionId: object.VersionId
              };
            }),
            Quiet: false
          }
        };
        s3.deleteObjects(params, function(err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred.
            reject();
          }
          else {
            totalCount += objects.length;
            console.log(`LastDeleted LastModified: ${objects[objects.length - 1].lastModified}, totalCount=${totalCount}`);
            subtask()
              .then(resolve)
              .catch(reject);
          }
        });
      });
    };

    subtask()  // begin first task.
    .then(resolve)  // resolved when all task done.
    .catch(reject);

  });
}

let listTask;
if (options.versions) {
  listTask = listObjectVersions;
  // force complete about listObjects.
  nextContinuationToken = null;
}
else {
  listTask = listObjects;
  // force complete about listObjectVersions.
  nextKeyMarker = null;
  nextVersionIdMarker = null;
}
Promise
.all([listTask(), deleteObjects()])
.then(() => {
  console.log('completed.');
});
