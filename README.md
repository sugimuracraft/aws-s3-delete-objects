# aws-s3-delete-objects
A tiny tool for AWS S3.
This is a tool to delete the target files (1,000 or more) from the bucket that stores a large number of files.

# Setup

## pre-required
- node command
- npm command
## aws credential
add or confirm your credential.
```bash
$ cat << EOF >> ~/.aws/credentials
[default]
aws_access_key_id = AKI00000000000000000
aws_secret_access_key = 0000000000000000000000000000000000000000
EOF
```

## node_modules
```bash
$ npm install
```
# Usage
## configure target bucket and path.
open index.js, and edit following.
```js
const bucket = 'bucket-name'
const key = 'path/to/delete/prefix';
```

## execute
```bash
$ npm start
```
