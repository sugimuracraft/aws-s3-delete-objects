console.log('program started.');

const AWS = require('aws-sdk');
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

const bucket = 'bucket-name'
const key = 'path/to/delete/prefix';

let objects = [];
let nextKeyMarker = '';
let nextVersionIdMarker = '';
let totalCount = 0;


const listObjectVersions = () => {
  return new Promise((resolve, reject) => {

    const subtask = () => {
      return new Promise((resolve, reject) => {
        console.log('-- begin listObjectVersions');
        if (nextVersionIdMarker === null) {  // done this task when nextVersionIdMarker is null.
          resolve();
          return;
        }
        if (objects.length >= 10000) {
          console.log('---- queued objects full. idling');
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
          Prefix: key,
          MaxKeys: 1000
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
              resolve();
              return;
            }
            objects = objects.concat(data.Versions.map((object) => {
              return {
                versionId: object.VersionId,
                lastModified: object.LastModified
              };
            }));
            console.log(`---- queued object length=${objects.length}`);
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
        if (nextVersionIdMarker === null && objects.length <= 0) {
          console.log('delete completed');
          resolve();
          return;
        }
        if (objects.length <= 0) {
          console.log('---- queued objects empty');
          // idle 10 seconds.
          const id = setInterval(() => {
            clearInterval(id);
            subtask()
              .then(resolve)
              .catch(reject);
          }, 1000 * 10);
          return;
        }
        const versions = objects.splice(0, 1000);
        const params = {
          Bucket: bucket, 
          Delete: {
            Objects: versions.map((version) => {
              return {
                Key: key,
                VersionId: version.versionId
              }
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
            totalCount += versions.length;
            console.log(`LastDeleted LastModified: ${versions[versions.length - 1].lastModified}, totalCount=${totalCount}`);
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

Promise.all([listObjectVersions(), deleteObjects()])
  .then(() => {
    console.log('completed.');
  });
