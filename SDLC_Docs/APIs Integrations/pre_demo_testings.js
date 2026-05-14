

console.log(
    "WebSocket: ", typeof WebSocket, WebSocket,
);


try {
    recorderLib = require('node-record-lpcm16');
} catch (err) {
    console.warn('node-record-lpcm16 not available...');
    return;
}