
function InitPage(dotNetObject) {

    navigator.mediaDevices.enumerateDevices()
        .then(gotDevices).then(getStream).catch(handleError);


    var videoSelect = document.querySelector('#videoSource');
    var videoElement = document.querySelector('video');

    function gotDevices(deviceInfos) {
        for (var i = deviceInfos.length - 1; i >= 0; --i) {
            var deviceInfo = deviceInfos[i];
            var option = document.createElement('option');
            option.value = deviceInfo.deviceId;
            if (deviceInfo.kind === 'videoinput') {
                option.text = deviceInfo.label || 'camera ' +
                    (videoSelect.length + 1);
                videoSelect.appendChild(option);
            } else {
                console.log('Found one other kind of source/device: ', deviceInfo);
            }
        }
    }


    
    function getStream() {

        if (window.stream) {
            window.stream.getTracks().forEach(function (track) {
                track.stop();
            });
        }

        var constraints = {
            video: {
                deviceId: { exact: videoSelect.value },
                width: { exact: 640 }, height: { exact: 480 }

            }
        };

        navigator.mediaDevices.getUserMedia(constraints).
            then(gotStream).catch(handleError);
    }

    function gotStream(stream) {
        window.stream = stream; // make stream available to console
        videoElement.srcObject = stream;
    }


    function handleError(error) {
        console.log('Error: ', error);
    }

    videoSelect.onchange = getStream;



    // Grab elements, create settings, etc.
    var video = document.getElementById('video');


    var canvas = document.getElementById('canvas');
    var context = canvas.getContext('2d');
    var video = document.getElementById('video');

    function calculateProportionalAspectRatio(srcWidth, srcHeight, maxWidth, maxHeight) {
        return (Math.min(maxWidth / srcWidth, maxHeight / srcHeight));
    }
    // Trigger photo take
    document.getElementById("snap").addEventListener("click", function () {
        
        var ratio = calculateProportionalAspectRatio(
            video.clientWidth, video.clientHeight, canvas.width, canvas.height);
        

        context.drawImage(video, 0, 0, video.clientWidth * ratio, video.clientHeight * ratio);

        //context.drawImage(video, 0, 0, video.clientHeight, video.clientWidth);

        var dataURL = canvas.toDataURL();

        var image_fmt = '';
        if (dataURL.match(/^data\:image\/(\w+)/))
            image_fmt = RegExp.$1;
        else
            throw "Cannot locate image format in Data URI";

        var raw_image_data = dataURL.replace(/^data\:image\/\w+\;base64\,/, '');
        // create a blob and decode our base64 to binary
        var blob = new Blob([base64DecToArr(raw_image_data)], { type: 'image/' + image_fmt });

        // stuff into a form, so servers can easily receive it as a standard file upload
        var form = new FormData();
        var form_elem_name = 'webcam';
        form.append(form_elem_name, blob, form_elem_name + "." + image_fmt.replace(/e/, ''));
        alert('Immagine in trasmissione verso https://' + window.location.hostname + '/QR/Capture');
        $.ajax({
            type: 'POST',
            //url: 'https://' + window.location.hostname + '/QR/Capture',

            url: '/QR/Capture',
            data: form,
            contentType: false, 
            processData: false,
            success: function (result) {
                alert('OK - QRCOde Riconosciuto');
                dotNetObject.invokeMethod('OKQRCode')
                

            },
            error: function (jqXHR, textStatus, errorThrown) {
                alert("Errore - QRCode non riconosciuto - Riaquisire l'immagine avendo cure di migliorare la qualità dell'immagine e lasciare un margine bianco");
            },
            beforeSend: function (jqXHR, settings) {
                //btn.button('loading');
            },
            complete: function (jqXHR, textStatus) {
                //btn.button('reset');
            }
        });



    });


    //$(document).ready(function () {


    //})



}
function b64ToUint6(nChr) {
    // convert base64 encoded character to 6-bit integer
    // from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
    return nChr > 64 && nChr < 91 ? nChr - 65
        : nChr > 96 && nChr < 123 ? nChr - 71
            : nChr > 47 && nChr < 58 ? nChr + 4
                : nChr === 43 ? 62 : nChr === 47 ? 63 : 0;
}

function base64DecToArr(sBase64, nBlocksSize) {
    // convert base64 encoded string to Uintarray
    // from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
    var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
        nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2,
        taBytes = new Uint8Array(nOutLen);

    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
        nMod4 = nInIdx & 3;
        nUint24 |= this.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
            for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++ , nOutIdx++) {
                taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
            }
            nUint24 = 0;
        }
    }
    return taBytes;
}

function StopStream() {

    if (window.stream) {
        window.stream.getTracks().forEach(function (track) {
            track.stop();
        });
    }

}
