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
[example-account]
aws_access_key_id = AKI00000000000000000
aws_secret_access_key = 0000000000000000000000000000000000000000
EOF
```

## node_modules
```bash
$ npm install
```
# Usage

## delete objects which start with prefix.
```bash
$ node index.js \
    --profile "example-account" \
    --bucket "bucket-name" \
    --prefix "path/to/delete/prefix"
```

## delete objects with object list.
* list.txt
```
path/to/delete/1.txt
path/to/delete/2.txt
path/to/delete/3.txt
dir/to/delete
```

```bash
$ cat list.txt \
  | xargs -n 1 \
      node index.js \
        --profile "example-account" \
        --bucket "bucket-name" \
        --prefix 
```

## delete versioned objects.
```bash
$ node index.js \
    --profile "example-account" \
    --bucket "bucket-name" \
    --versions \
    --prefix "path/to/delete/prefix"
```
