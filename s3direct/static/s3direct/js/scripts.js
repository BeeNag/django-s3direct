const Cookies = require('js-cookie');
const Minio = require('minio');


(function(){

    "use strict"

    const request = function (method, url, data, headers, el, cb) {
        let req = new XMLHttpRequest()
        req.open(method, url, true)

        Object.keys(headers).forEach(function (key) {
            req.setRequestHeader(key, headers[key])
        });

        req.onload = function () {
            cb(req.status, req.responseText)
        };

        req.onerror = req.onabort = function () {
            disableSubmit(false)
            error(el, 'Sorry, failed to upload file.')
        };

        req.send(data)
    };

    const parseNameFromUrl = function (url) {
        return decodeURIComponent((url + '').replace(/\+/g, '%20'));
    };

    const parseJson = function (json) {
        let data;
        try {
            data = JSON.parse(json);
        }
        catch (e) {
            data = null;
        }
        return data
    };

    const updateProgressBar = function (element, progressRatio) {
        const bar = element.querySelector('.bar');
        bar.style.width = Math.round(progressRatio * 100) + '%';
    };

    const error = function(el, msg) {
        el.className = 's3direct form-active'
        el.querySelector('.file-input').value = ''
        alert(msg)
    };

    let concurrentUploads = 0;

    const disableSubmit = function(status) {
        const submitRow = document.querySelector('.submit-row')
        if( ! submitRow) return

        const buttons = submitRow.querySelectorAll('input[type=submit],button[type=submit]');

        if (status === true) concurrentUploads++
        else concurrentUploads--

        ;[].forEach.call(buttons, function(el){
            el.disabled = (concurrentUploads !== 0)
        })
    }

    const beginUpload = function (element) {
        disableSubmit(true);
        element.className = 's3direct progress-active'
    };

    const finishUpload = function (element, awsBucketUrl, objectKey) {
        const link = element.querySelector('.file-link');
        const url = element.querySelector('.file-url');
        url.value = awsBucketUrl + '/' + objectKey;
        link.setAttribute('href', url.value);
        link.innerHTML = parseNameFromUrl(url.value).split('/').pop();

        element.className = 's3direct link-active';
        element.querySelector('.bar').style.width = '0%';
        disableSubmit(false);
    };

    const initiateUpload = function (element, objectKey, aKey, sKey, awsRegion, awsBucket, file) {
        return new Promise(function (resolve, reject) {
            const minioClient = new Minio.Client({
                endPoint: 'minio',
                port: 9000,
                useSSL: false,
                access_key: aKey,
                secret_key: sKey
            });
        }).then(function (client) {
            beginUpload(element);
            return new Promise(function (resolve, reject) {
                client.makeBucket(awsBucket, awsRegion, function (err) {
                    if (err) return console.log(err);
                    console.log('Bucket created successfully in '+awsRegion)
                    let metaData = {
                        'Content-Type': 'application/octet-stream',
                        'X-Amz-Meta-Testing': 1234,
                        'example': 5678
                    }
                    // Using fPutObject API to upload file to the bucket
                    client.fPutObject(awsBucket, file, objectKey, metaData, function (err, etag) {
                        if (err) return console.log(err);
                    })
                })
            }).then(
                function (awsS3ObjectKey) {
                    console.log('Successfully uploaded to:', awsS3ObjectKey);
                    finishUpload(element, awsBucketUrl, awsS3ObjectKey);
                },
                function (reason) {
                    console.error('Failed to upload because:', reason);
                    return error(element, reason)
                }
            )
        });
    };

    const checkFileAndInitiateUpload = function(event) {
        console.log('Checking file and initiating upload…')
        const element             = event.target.parentElement,
              csrfInput           = document.querySelector('input[name=csrfmiddlewaretoken]'),
              file                = element.querySelector('.file-input').files[0],
              dest                = element.querySelector('.file-dest').value,
              csrfCookieNameInput = element.querySelector('.csrf-cookie-name'),
              destinationCheckUrl = element.getAttribute('data-policy-url'),
              form                = new FormData(),
              csrfToken           = csrfInput ? csrfInput.value : Cookies.get(csrfCookieNameInput.value),
              headers             = {'X-CSRFToken': csrfToken };

        form.append('dest', dest)
        form.append('name', file.name)
        form.append('type', file.type)
        form.append('size', file.size)
        request('POST', destinationCheckUrl, form, headers, element, function(status, response) {
            const uploadParameters = parseJson(response)
            switch(status) {
                case 200:
                    initiateUpload(
                        element,
                        uploadParameters.object_key,
                        uploadParameters.access_key_id,
                        uploadParameters.secret_key_id,
                        uploadParameters.region,
                        uploadParameters.bucket,
                        file
                    );
                    break;
                case 400:
                case 403:
                case 500:
                    error(element, uploadParameters.error)
                    break;
                default:
                    error(element, 'Sorry, could not get upload URL.')
            }
        })
    }

    const removeUpload = function (e) {
        e.preventDefault()

        const el = e.target.parentElement
        el.querySelector('.file-url').value = ''
        el.querySelector('.file-input').value = ''
        el.className = 's3direct form-active'
    };

    const addHandlers = function (el) {
        console.log('Adding django-s3direct handlers…');
        const url = el.querySelector('.file-url'),
              input = el.querySelector('.file-input'),
              remove = el.querySelector('.file-remove'),
              status = (url.value === '') ? 'form' : 'link';

        el.className = 's3direct ' + status + '-active'

        remove.addEventListener('click', removeUpload, false)
        input.addEventListener('change', checkFileAndInitiateUpload, false)
    };

    document.addEventListener('DOMContentLoaded', function(event) {
        [].forEach.call(document.querySelectorAll('.s3direct'), addHandlers)
    });

    document.addEventListener('DOMNodeInserted', function(event){
        if(event.target.tagName) {
            const el = event.target.querySelectorAll('.s3direct');
            [].forEach.call(el, function (element, index, array) {
                addHandlers(element);
            });
        }
    })

})()
